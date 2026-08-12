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

function alchemyRpcUrl(): string | null {
  const key = (process.env.ALCHEMY_API_KEY || "").trim();
  if (key) return `https://eth-mainnet.g.alchemy.com/v2/${key}`;
  const direct = (process.env.ETH_RPC_URL || "").trim();
  return direct || null;
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

export async function getAccessKeyBalance(owner: Address): Promise<bigint> {
  const rpc = alchemyRpcUrl() || "https://ethereum.publicnode.com";
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpc, { timeout: 12_000 }),
  });
  return client.readContract({
    address: ACCESS_KEY_CONTRACT,
    abi: ERC721_BALANCE_OF_ABI,
    functionName: "balanceOf",
    args: [owner],
  });
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
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
