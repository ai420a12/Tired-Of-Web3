import {
  generatePrivateKey,
  privateKeyToAccount,
} from "viem/accounts";
import type { Address, Hex } from "viem";
import { isAddress } from "viem";

export type SquadWallet = {
  id: number;
  address: Address;
  label: string;
  logBal: string;
  live: string;
  usd: string;
  nfts: number;
  time: string;
  activity: string;
  /** True when a session private key is held in memory (never serialized). */
  hasKey: boolean;
};

const KEY_RE = /^(0x)?[0-9a-fA-F]{64}$/;
const KEY_IN_LINE_RE = /(?:0x)?[0-9a-fA-F]{64}/;

export function normalizePk(raw: string): Hex | null {
  const v = raw.trim();
  if (!KEY_RE.test(v)) return null;
  return (v.startsWith("0x") ? v : `0x${v}`) as Hex;
}

/** Pull a private key out of pasted generate-output, CSV, or labeled lines. */
export function extractPrivateKey(raw: string): Hex | null {
  const v = raw.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!v) return null;
  const direct = normalizePk(v);
  if (direct) return direct;
  const labeled = v.match(
    /(?:private\s*key|privkey|secret|pk|key)\s*[:=]\s*(0x)?([0-9a-fA-F]{64})/i,
  );
  if (labeled) return normalizePk(`${labeled[1] || ""}${labeled[2]}`);
  if (parseAddress(v)) return null;
  const embedded = v.match(KEY_IN_LINE_RE);
  if (!embedded) return null;
  return normalizePk(embedded[0]);
}

export type ParsedPasteWallet = {
  address: Address;
  pk?: Hex;
};

/** Parse pasted keys/addresses. A private key always wins over the same address. */
export function parsePasteWallets(raw: string): ParsedPasteWallet[] {
  const lines = raw
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 120);
  const byAddr = new Map<string, ParsedPasteWallet>();
  for (const line of lines) {
    const pk = extractPrivateKey(line);
    if (pk) {
      const address = addressFromPk(pk);
      byAddr.set(address.toLowerCase(), { address, pk });
      continue;
    }
    const address = extractAddress(line);
    if (!address) continue;
    const key = address.toLowerCase();
    if (!byAddr.has(key)) byAddr.set(key, { address });
  }
  return [...byAddr.values()];
}

export function addressFromPk(pk: Hex): Address {
  return privateKeyToAccount(pk).address;
}

export function parseAddress(raw: string): Address | null {
  const v = raw.trim();
  if (!isAddress(v)) return null;
  return v as Address;
}

export function extractAddress(raw: string): Address | null {
  const direct = parseAddress(raw.trim());
  if (direct) return direct;
  const m = raw.match(/0x[a-fA-F0-9]{40}/);
  return m ? parseAddress(m[0]) : null;
}

export function generateSquadWallet(id: number): {
  wallet: SquadWallet;
  pk: Hex;
} {
  const pk = generatePrivateKey();
  const address = privateKeyToAccount(pk).address;
  return {
    pk,
    wallet: emptyRow(id, address, `Wallet ${id}`, true, "Generated · session key"),
  };
}

export function emptyRow(
  id: number,
  address: Address,
  label: string,
  hasKey: boolean,
  activity: string,
): SquadWallet {
  return {
    id,
    address,
    label,
    logBal: "0.0000 ETH",
    live: "0.0000 ETH",
    usd: "$0.00",
    nfts: 0,
    time: "just now",
    activity,
    hasKey,
  };
}

export function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
