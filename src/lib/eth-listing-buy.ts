/**
 * Silent ETH listing snipes — session private key signs in-browser.
 * Broadcast via our Alchemy relay (no MetaMask, no popup windows).
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseGwei,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

export type GasMode = "normal" | "fast" | "hyper";

export type SessionBuyInput = {
  orderHash?: string;
  protocolAddress: string;
  sessionPrivateKey: string;
  priceEth: number;
  tokenName: string;
  apiBase?: string;
  gasMode?: GasMode;
  contract?: string;
  tokenId?: string;
};

export type ListingBuyResult = {
  txHashes: string[];
  explorerUrl: string;
  from: Address;
};

const SIGN_RPC = "https://ethereum.publicnode.com";

function normalizePk(raw: string): Hex {
  const v = raw.trim();
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(v)) {
    throw new Error("BAD_SESSION_KEY");
  }
  return (v.startsWith("0x") ? v : `0x${v}`) as Hex;
}

export function addressFromSessionKey(raw: string): Address {
  return privateKeyToAccount(normalizePk(raw)).address;
}

function gasMultipliers(mode: GasMode): {
  priorityX: bigint;
  maxX: bigint;
  floorPriority: bigint;
} {
  switch (mode) {
    case "hyper":
      return {
        priorityX: BigInt(12),
        maxX: BigInt(3),
        floorPriority: parseGwei("40"),
      };
    case "fast":
      return {
        priorityX: BigInt(6),
        maxX: BigInt(2),
        floorPriority: parseGwei("15"),
      };
    default:
      return {
        priorityX: BigInt(3),
        maxX: BigInt(2),
        floorPriority: parseGwei("3"),
      };
  }
}

async function fetchFulfillment(
  apiBase: string,
  buyer: Address,
  input: SessionBuyInput,
) {
  const res = await fetch(`${apiBase}/buy-listing`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orderHash: input.orderHash,
      protocolAddress: input.protocolAddress,
      chain: "ethereum",
      buyer,
      contract: input.contract,
      tokenId: input.tokenId,
    }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    code?: string;
    transactions?: { to: string; data: string; value: string }[];
  };
  if (!res.ok || !data.ok || !data.transactions?.length) {
    throw new Error(data.error || data.code || "FULFILL_FAILED");
  }
  return data.transactions;
}

async function broadcastRaw(apiBase: string, signedTx: Hex): Promise<Hex> {
  const res = await fetch(`${apiBase}/broadcast`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ signedTx }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    hash?: string;
    error?: string;
  };
  if (!res.ok || !data.ok || !data.hash) {
    throw new Error(data.error || "BROADCAST_FAILED");
  }
  return data.hash as Hex;
}

/** Instant snipe — no MetaMask, no new browser tabs. */
export async function buyEthListingWithSessionKey(
  input: SessionBuyInput,
): Promise<ListingBuyResult> {
  const pk = normalizePk(input.sessionPrivateKey);
  const account = privateKeyToAccount(pk);
  const apiBase = input.apiBase || "/api/hood-rpc/eth";
  const mode = input.gasMode || "hyper";
  const { priorityX, maxX, floorPriority } = gasMultipliers(mode);

  const txs = await fetchFulfillment(apiBase, account.address, input);

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(SIGN_RPC),
  });
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(SIGN_RPC),
  });

  const fees = await publicClient.estimateFeesPerGas().catch(() => null);
  let maxPriorityFeePerGas =
    (fees?.maxPriorityFeePerGas ?? parseGwei("2")) * priorityX;
  if (maxPriorityFeePerGas < floorPriority) {
    maxPriorityFeePerGas = floorPriority;
  }
  const base = fees?.maxFeePerGas ?? parseGwei("30");
  const maxFeePerGas = base * maxX + maxPriorityFeePerGas;

  const txHashes: string[] = [];
  let nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });

  for (const tx of txs) {
    const value = BigInt(tx.value || "0x0");
    let gas = BigInt(650000);
    try {
      gas = await publicClient.estimateGas({
        account: account.address,
        to: tx.to as Address,
        data: tx.data as Hex,
        value,
      });
      gas = (gas * BigInt(130)) / BigInt(100);
    } catch {
      /* keep fallback */
    }
    const signedTx = await walletClient.signTransaction({
      to: tx.to as Address,
      data: tx.data as Hex,
      value,
      nonce,
      maxFeePerGas,
      maxPriorityFeePerGas,
      gas,
      chainId: 1,
    });
    const hash = await broadcastRaw(apiBase, signedTx);
    txHashes.push(hash);
    nonce += 1;
  }

  return {
    txHashes,
    from: account.address,
    explorerUrl: `https://etherscan.io/tx/${txHashes[txHashes.length - 1]}`,
  };
}

export function buyErrorToast(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "BUY_FAILED";
  switch (msg) {
    case "BAD_SESSION_KEY":
      return "> ARM A VALID SESSION PRIVATE KEY FIRST";
    case "NO_SESSION_KEY":
      return "> ARM SNIPER KEY · PASTE HOT WALLET PK";
    case "FULFILL_FAILED":
    case "NO_TX":
      return "> NO BUY TX · LISTING SOLD OR UNAVAILABLE";
    case "BROADCAST_FAILED":
      return "> BROADCAST FAILED · CHECK ETH + GAS ON HOT WALLET";
    case "RPC_FAILED":
      return "> RPC FAILED · RETRY SNIPE";
    default:
      if (/insufficient funds/i.test(msg)) {
        return "> HOT WALLET NEEDS MORE ETH";
      }
      if (msg.length < 90) return `> ${msg.toUpperCase()}`;
      return "> SNIPE FAILED · RETRY";
  }
}
