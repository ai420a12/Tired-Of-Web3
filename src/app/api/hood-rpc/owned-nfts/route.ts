import { NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  isAccessDenied,
  requireAccessKey,
} from "@/lib/require-access";
import { resolveApiVariant } from "@/lib/hood-rpc-chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_LIKE = /^(0x)?[0-9a-fA-F]{64}$/;
const MAX_ADDRS = 80;
const MAX_NFTS = 120;

export type OwnedNftRow = {
  owner: string;
  contract: string;
  tokenId: string;
  tokenType: "ERC721" | "ERC1155";
  balance: string;
};

function alchemyKey(): string | null {
  return (process.env.ALCHEMY_API_KEY || "").trim() || null;
}

function parseTokenId(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const n = s.startsWith("0x") ? BigInt(s) : BigInt(s);
    if (n < BigInt(0)) return null;
    return n.toString();
  } catch {
    return null;
  }
}

function pushNft(
  rows: OwnedNftRow[],
  seen: Set<string>,
  owner: string,
  contractRaw: string,
  tokenIdRaw: unknown,
  tokenTypeRaw: string,
  balanceRaw?: unknown,
) {
  const contract = contractRaw.toLowerCase();
  const tokenId = parseTokenId(tokenIdRaw);
  if (!isAddress(contract) || !tokenId) return;
  const key = `${contract}:${tokenId}`;
  if (seen.has(key)) return;
  seen.add(key);
  const kind = tokenTypeRaw.toUpperCase();
  if (kind === "ERC20") return;
  rows.push({
    owner: owner.toLowerCase(),
    contract,
    tokenId,
    tokenType: kind.includes("1155") ? "ERC1155" : "ERC721",
    balance: String(balanceRaw || "1"),
  });
}

async function alchemyNftApi(key: string, owner: string): Promise<OwnedNftRow[]> {
  const rows: OwnedNftRow[] = [];
  const seen = new Set<string>();
  let pageKey: string | undefined;
  for (let i = 0; i < 8 && rows.length < MAX_NFTS; i++) {
    const q = new URLSearchParams({
      owner,
      withMetadata: "false",
      pageSize: "100",
    });
    if (pageKey) q.set("pageKey", pageKey);
    const res = await fetch(
      `https://eth-mainnet.g.alchemy.com/nft/v3/${key}/getNFTsForOwner?${q}`,
      { cache: "no-store" },
    );
    if (!res.ok) break;
    const data = (await res.json()) as {
      ownedNfts?: {
        tokenId?: string;
        id?: { tokenId?: string };
        balance?: string;
        tokenType?: string;
        contract?: { address?: string; tokenType?: string };
      }[];
      pageKey?: string;
    };
    for (const nft of data.ownedNfts || []) {
      pushNft(
        rows,
        seen,
        owner,
        nft.contract?.address || "",
        nft.tokenId || nft.id?.tokenId,
        nft.contract?.tokenType || nft.tokenType || "ERC721",
        nft.balance,
      );
      if (rows.length >= MAX_NFTS) break;
    }
    pageKey = data.pageKey;
    if (!pageKey) break;
  }
  return rows;
}

/** Fresh buys often miss the NFT index — pull recent inbound transfers instead. */
async function alchemyInboundNfts(
  key: string,
  owner: string,
): Promise<OwnedNftRow[]> {
  const res = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [
        {
          fromBlock: "0x0",
          toBlock: "latest",
          toAddress: owner,
          category: ["erc721", "erc1155"],
          withMetadata: false,
          excludeZeroValue: false,
          maxCount: "0x32",
          order: "desc",
        },
      ],
    }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    result?: {
      transfers?: {
        category?: string;
        erc721TokenId?: string;
        tokenId?: string;
        erc1155Metadata?: { tokenId?: string; value?: string }[];
        rawContract?: { address?: string };
      }[];
    };
  };
  const rows: OwnedNftRow[] = [];
  const seen = new Set<string>();
  for (const t of json.result?.transfers || []) {
    const contract = t.rawContract?.address || "";
    const is1155 = (t.category || "").toLowerCase().includes("1155");
    if (is1155) {
      for (const m of t.erc1155Metadata || []) {
        pushNft(rows, seen, owner, contract, m.tokenId, "ERC1155", m.value);
      }
    } else {
      pushNft(
        rows,
        seen,
        owner,
        contract,
        t.erc721TokenId || t.tokenId,
        "ERC721",
        "1",
      );
    }
    if (rows.length >= MAX_NFTS) break;
  }
  return rows;
}

async function stillOwned(
  key: string,
  nft: OwnedNftRow,
): Promise<boolean> {
  const data =
    nft.tokenType === "ERC1155"
      ? encodeBalanceOf(nft.owner, nft.tokenId)
      : encodeOwnerOf(nft.tokenId);
  const res = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: nft.contract, data }, "latest"],
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as { result?: string };
  const raw = (json.result || "").toLowerCase();
  if (!raw || raw === "0x") return false;
  if (nft.tokenType === "ERC1155") {
    try {
      return BigInt(raw) > BigInt(0);
    } catch {
      return false;
    }
  }
  const owner = `0x${raw.slice(-40)}`;
  return owner === nft.owner.toLowerCase();
}

function pad32(hexNoPrefix: string): string {
  return hexNoPrefix.replace(/^0x/, "").padStart(64, "0");
}

function encodeOwnerOf(tokenId: string): string {
  const id = BigInt(tokenId).toString(16);
  return `0x6352211e${pad32(id)}`;
}

function encodeBalanceOf(owner: string, tokenId: string): string {
  const id = BigInt(tokenId).toString(16);
  return `0x00fdd58e${pad32(owner.replace(/^0x/, ""))}${pad32(id)}`;
}

async function alchemyNfts(owner: string): Promise<OwnedNftRow[]> {
  const key = alchemyKey();
  if (!key) return [];
  const [indexed, inbound] = await Promise.all([
    alchemyNftApi(key, owner),
    alchemyInboundNfts(key, owner),
  ]);
  const indexedKeys = new Set(indexed.map((n) => `${n.contract}:${n.tokenId}`));
  const extra: OwnedNftRow[] = [];
  for (const nft of inbound) {
    const k = `${nft.contract}:${nft.tokenId}`;
    if (indexedKeys.has(k)) continue;
    const ok = await stillOwned(key, nft).catch(() => true);
    if (ok) extra.push(nft);
  }
  return [...indexed, ...extra].slice(0, MAX_NFTS);
}

async function blockscoutNfts(
  owner: string,
  host: string,
): Promise<OwnedNftRow[]> {
  const rows: OwnedNftRow[] = [];
  const seen = new Set<string>();
  const starts = [
    `https://${host}/api/v2/addresses/${owner}/nft?type=ERC-721`,
    `https://${host}/api/v2/addresses/${owner}/nft?type=ERC-1155`,
    `https://${host}/api/v2/addresses/${owner}/nft`,
  ];
  for (const start of starts) {
    let url: string | null = start;
    for (let i = 0; i < 4 && url && rows.length < MAX_NFTS; i++) {
      const res = await fetch(url, { cache: "no-store" }).catch(() => null);
      if (!res?.ok) break;
      const data = (await res.json()) as {
        items?: {
          id?: string;
          value?: string;
          token?: {
            address_hash?: string;
            address?: string;
            type?: string;
          };
        }[];
        next_page_params?: Record<string, string | number>;
      };
      for (const item of data.items || []) {
        const contract = (
          item.token?.address_hash ||
          item.token?.address ||
          ""
        ).toLowerCase();
        const tokenId = parseTokenId(item.id);
        if (!isAddress(contract) || !tokenId) continue;
        const key = `${contract}:${tokenId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const kind = (item.token?.type || "ERC-721").toUpperCase();
        rows.push({
          owner: owner.toLowerCase(),
          contract,
          tokenId,
          tokenType: kind.includes("1155") ? "ERC1155" : "ERC721",
          balance: String(item.value || "1"),
        });
        if (rows.length >= MAX_NFTS) break;
      }
      const next = data.next_page_params;
      if (!next || !Object.keys(next).length) break;
      const q = new URLSearchParams(
        Object.fromEntries(
          Object.entries(next).map(([k, v]) => [k, String(v)]),
        ),
      );
      url = `https://${host}/api/v2/addresses/${owner}/nft?${q}`;
    }
  }
  return rows;
}

async function nftsForOwner(
  variant: "eth" | "hood",
  owner: string,
): Promise<OwnedNftRow[]> {
  if (variant === "eth") {
    const alchemy = await alchemyNfts(owner).catch(() => []);
    if (alchemy.length) return alchemy;
    return blockscoutNfts(owner, "eth.blockscout.com").catch(() => []);
  }
  return blockscoutNfts(owner, "robinhoodchain.blockscout.com").catch(() => []);
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

export async function POST(req: Request) {
  const access = await requireAccessKey(req);
  if (isAccessDenied(access)) return access;

  let body: { addresses?: unknown };
  try {
    body = (await req.json()) as { addresses?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.addresses)) {
    return NextResponse.json({ error: "addresses required" }, { status: 400 });
  }

  const addrs: string[] = [];
  for (const raw of body.addresses.slice(0, MAX_ADDRS)) {
    const v = String(raw || "").trim();
    if (KEY_LIKE.test(v)) {
      return NextResponse.json(
        { error: "Private keys are not accepted", code: "NO_KEYS" },
        { status: 400 },
      );
    }
    if (isAddress(v)) addrs.push(v.toLowerCase());
  }

  const variant = resolveApiVariant(req);
  const batches = await mapPool(addrs, 6, (owner) => nftsForOwner(variant, owner));
  const nfts: OwnedNftRow[] = [];
  const seen = new Set<string>();
  for (const rows of batches) {
    for (const nft of rows || []) {
      const key = `${nft.owner}:${nft.contract}:${nft.tokenId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      nfts.push(nft);
      if (nfts.length >= MAX_NFTS) break;
    }
    if (nfts.length >= MAX_NFTS) break;
  }

  return NextResponse.json({
    ok: true,
    chain: variant,
    nfts,
  });
}
