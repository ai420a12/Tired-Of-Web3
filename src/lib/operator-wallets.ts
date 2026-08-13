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

export function normalizePk(raw: string): Hex | null {
  const v = raw.trim();
  if (!KEY_RE.test(v)) return null;
  return (v.startsWith("0x") ? v : `0x${v}`) as Hex;
}

export function addressFromPk(pk: Hex): Address {
  return privateKeyToAccount(pk).address;
}

export function parseAddress(raw: string): Address | null {
  const v = raw.trim();
  if (!isAddress(v)) return null;
  return v as Address;
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
