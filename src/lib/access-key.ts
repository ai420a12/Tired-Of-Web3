import { createHmac, timingSafeEqual } from "crypto";
import {
  createPublicClient,
  http,
  isAddress,
  verifyMessage,
  type Address,
  type Hex,
} from "viem";
import { mainnet } from "viem/chains";
import {
  ACCESS_COOKIE_MAX_AGE_SEC,
  ACCESS_KEY_CONTRACT,
} from "@/lib/access-key-shared";

export type { Address };
export {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE_SEC,
  ACCESS_KEY_CHAIN_ID,
  ACCESS_KEY_CONTRACT,
  ACCESS_OPENSEA_URL,
} from "@/lib/access-key-shared";

const ERC721_BALANCE_OF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

function ethRpcCandidates(): string[] {
  const out: string[] = [];
  const alchemy = (process.env.ALCHEMY_API_KEY || "").trim();
  // Ignore redacted / obviously invalid placeholders
  if (alchemy && alchemy.length >= 20 && !alchemy.includes("SENSITIVE")) {
    out.push(`https://eth-mainnet.g.alchemy.com/v2/${alchemy}`);
  }
  for (const raw of [
    process.env.ETH_RPC_URL,
    process.env.ALCHEMY_RPC_URL,
  ]) {
    const v = (raw || "").trim();
    if (v.startsWith("http")) out.push(v);
  }
  out.push(
    "https://1rpc.io/eth",
    "https://eth.drpc.org",
    "https://ethereum-rpc.publicnode.com",
    "https://ethereum.publicnode.com",
  );
  return [...new Set(out)];
}

async function balanceOfViaRpc(owner: Address, rpcUrl: string): Promise<bigint> {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { timeout: 10_000 }),
  });
  return client.readContract({
    address: ACCESS_KEY_CONTRACT,
    abi: ERC721_BALANCE_OF_ABI,
    functionName: "balanceOf",
    args: [owner],
  });
}

/** OpenSea account NFTs for this collection — backup when RPCs flap. */
async function balanceOfViaOpenSea(owner: Address): Promise<bigint | null> {
  const key = (process.env.OPENSEA_API_KEY || "").trim();
  if (!key || key.length < 16 || key.includes("SENSITIVE")) return null;
  const url =
    `https://api.opensea.io/api/v2/chain/ethereum/account/${owner}/nfts` +
    `?collection=tired-of-web3&limit=1`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-API-KEY": key,
      "User-Agent": "TiredOfWeb3/access-gate",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`OpenSea ownership HTTP ${res.status}`);
  }
  const data = (await res.json()) as { nfts?: unknown[] };
  const count = Array.isArray(data.nfts) ? data.nfts.length : 0;
  // Endpoint is paginated — any NFT means balance >= 1 (enough for access)
  return BigInt(count > 0 ? 1 : 0);
}

export async function getAccessKeyBalance(owner: Address): Promise<bigint> {
  const errors: string[] = [];
  for (const rpc of ethRpcCandidates()) {
    try {
      return await balanceOfViaRpc(owner, rpc);
    } catch (err) {
      errors.push(
        `${rpc}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  try {
    const viaOs = await balanceOfViaOpenSea(owner);
    if (viaOs != null) return viaOs;
  } catch (err) {
    errors.push(
      `opensea: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  throw new Error(`All ownership checks failed. ${errors.slice(0, 3).join(" | ")}`);
}

function signingSecret(): string {
  return (
    process.env.ACCESS_GATE_SECRET ||
    process.env.WL_ADMIN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "tow-dev-access-gate"
  );
}

export function normalizeAddress(raw: string): Address | null {
  const v = (raw || "").trim();
  if (!isAddress(v)) return null;
  return v.toLowerCase() as Address;
}

export function buildAccessMessage(address: Address, issuedAt: number): string {
  return [
    "Tired Of Web3 — Access Key verification",
    "",
    `Wallet: ${address}`,
    `IssuedAt: ${issuedAt}`,
    "",
    "Sign this message to prove you control this wallet and unlock Hood_RPC + ETH_RPC.",
  ].join("\n");
}

export function parseIssuedAt(message: string): number | null {
  const m = message.match(/^IssuedAt:\s*(\d+)\s*$/m);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export async function verifyWalletSignature(opts: {
  address: Address;
  message: string;
  signature: string;
}): Promise<boolean> {
  try {
    return await verifyMessage({
      address: opts.address,
      message: opts.message,
      signature: opts.signature as Hex,
    });
  } catch {
    return false;
  }
}

function signPayload(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("hex");
}

export function createAccessToken(address: Address, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ACCESS_COOKIE_MAX_AGE_SEC;
  const body = `${address.toLowerCase()}.${exp}`;
  return `v1.${body}.${signPayload(body)}`;
}

export function readAccessToken(
  token: string | undefined | null,
): { address: Address; exp: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [, addressRaw, expRaw, sig] = parts;
  const address = normalizeAddress(addressRaw);
  const exp = Number(expRaw);
  if (!address || !Number.isFinite(exp)) return null;
  if (Math.floor(Date.now() / 1000) > exp) return null;
  const body = `${address}.${exp}`;
  const expected = signPayload(body);
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { address, exp };
}

export function accessCookieOptions(maxAge = ACCESS_COOKIE_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    // Always Secure in prod so the access session never rides cleartext HTTP
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
