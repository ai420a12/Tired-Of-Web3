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
const MAX_ADDRS = 40;
const MAX_NFTS = 80;

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

async function alchemyNfts(owner: string): Promise<OwnedNftRow[]> {
  const key = alchemyKey();
  if (!key) return [];
  const rows: OwnedNftRow[] = [];
  let pageKey: string | undefined;
  for (let i = 0; i < 8 && rows.length < MAX_NFTS; i++) {
    const q = new URLSearchParams({
      owner,
      withMetadata: "false",
      pageSize: "100",
    });
    q.append("excludeFilters[]", "SPAM");
    if (pageKey) q.set("pageKey", pageKey);
    const res = await fetch(
      `https://eth-mainnet.g.alchemy.com/nft/v3/${key}/getNFTsForOwner?${q}`,
      { cache: "no-store" },
    );
    if (!res.ok) break;
    const data = (await res.json()) as {
      ownedNfts?: {
        tokenId?: string;
        balance?: string;
        contract?: { address?: string; tokenType?: string };
      }[];
      pageKey?: string;
    };
    for (const nft of data.ownedNfts || []) {
      const contract = (nft.contract?.address || "").toLowerCase();
      const tokenId = parseTokenId(nft.tokenId);
      if (!isAddress(contract) || !tokenId) continue;
      const kind = (nft.contract?.tokenType || "ERC721").toUpperCase();
      if (kind === "ERC20") continue;
      rows.push({
        owner: owner.toLowerCase(),
        contract,
        tokenId,
        tokenType: kind === "ERC1155" ? "ERC1155" : "ERC721",
        balance: String(nft.balance || "1"),
      });
      if (rows.length >= MAX_NFTS) break;
    }
    pageKey = data.pageKey;
    if (!pageKey) break;
  }
  return rows;
}

async function blockscoutNfts(owner: string): Promise<OwnedNftRow[]> {
  const rows: OwnedNftRow[] = [];
  let url: string | null =
    `https://robinhoodchain.blockscout.com/api/v2/addresses/${owner}/nft?type=ERC-721,ERC-1155`;
  for (let i = 0; i < 6 && url && rows.length < MAX_NFTS; i++) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) break;
    const data = (await res.json()) as {
      items?: {
        id?: string;
        value?: string;
        token?: { address_hash?: string; address?: string; type?: string };
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
    url = `https://robinhoodchain.blockscout.com/api/v2/addresses/${owner}/nft?${q}`;
  }
  return rows;
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
  const nfts: OwnedNftRow[] = [];
  for (const owner of addrs) {
    const rows =
      variant === "eth"
        ? await alchemyNfts(owner)
        : await blockscoutNfts(owner);
    nfts.push(...rows);
    if (nfts.length >= MAX_NFTS) break;
  }

  return NextResponse.json({
    ok: true,
    chain: variant,
    nfts: nfts.slice(0, MAX_NFTS),
  });
}
