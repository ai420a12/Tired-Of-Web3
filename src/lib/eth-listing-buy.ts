/**
 * Silent ETH OpenSea listing buys using an in-browser session private key.
 * Key never uploads to our servers. No MetaMask popups on snipe.
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
  orderHash: string;
  protocolAddress: string;
  /** Session / hot wallet that pays + receives (from private key) */
  sessionPrivateKey: string;
  priceEth: number;
  tokenName: string;
  apiBase?: string;
  gasMode?: GasMode;
};

export type ListingBuyResult = {
  txHashes: string[];
  explorerUrl: string;
  from: Address;
};

const RPCS = [
  "https://ethereum.publicnode.com",
  "https://1rpc.io/eth",
  "https://rpc.ankr.com/eth",
] as const;

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

async function withRpc<T>(
  fn: (url: string) => Promise<T>,
): Promise<T> {
  let last: unknown;
  for (const url of RPCS) {
    try {
      return await fn(url);
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error("RPC_FAILED");
}

async function fetchFulfillment(
  apiBase: string,
  buyer: Address,
  orderHash: string,
  protocolAddress: string,
) {
  const res = await fetch(`${apiBase}/buy-listing`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orderHash,
      protocolAddress,
      chain: "ethereum",
      buyer,
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

/** Instant snipe — signs + broadcasts with elevated gas, no wallet UI. */
export async function buyEthListingWithSessionKey(
  input: SessionBuyInput,
): Promise<ListingBuyResult> {
  const pk = normalizePk(input.sessionPrivateKey);
  const account = privateKeyToAccount(pk);
  const apiBase = input.apiBase || "/api/hood-rpc/eth";
  const mode = input.gasMode || "hyper";
  const { priorityX, maxX, floorPriority } = gasMultipliers(mode);

  const txs = await fetchFulfillment(
    apiBase,
    account.address,
    input.orderHash,
    input.protocolAddress,
  );

  const txHashes: string[] = [];

  await withRpc(async (rpcUrl) => {
    const publicClient = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });
    const walletClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(rpcUrl),
    });

    const fees = await publicClient.estimateFeesPerGas().catch(() => null);
    let maxPriorityFeePerGas =
      (fees?.maxPriorityFeePerGas ?? parseGwei("2")) * priorityX;
    if (maxPriorityFeePerGas < floorPriority) {
      maxPriorityFeePerGas = floorPriority;
    }
    const base = fees?.maxFeePerGas ?? parseGwei("30");
    const maxFeePerGas =
      base * maxX + maxPriorityFeePerGas > maxPriorityFeePerGas
        ? base * maxX + maxPriorityFeePerGas
        : maxPriorityFeePerGas * BigInt(2);

    for (const tx of txs) {
      const hash = await walletClient.sendTransaction({
        to: tx.to as Address,
        data: tx.data as Hex,
        value: BigInt(tx.value || "0x0"),
        maxFeePerGas,
        maxPriorityFeePerGas,
      });
      txHashes.push(hash);
      // Don't wait full receipt — fire next tx / return fast for snipes
      await publicClient
        .waitForTransactionReceipt({ hash, timeout: 90_000 })
        .catch(() => null);
    }
  });

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
  if (/user rejected|denied/i.test(msg)) {
    return "> BUY CANCELLED";
  }
  switch (msg) {
    case "BAD_SESSION_KEY":
      return "> ARM A VALID SESSION PRIVATE KEY FIRST";
    case "NO_SESSION_KEY":
      return "> ARM SNIPER KEY · PASTE HOT WALLET PK";
    case "FULFILL_FAILED":
      return "> LISTING UNAVAILABLE · MAY BE SOLD";
    case "RPC_FAILED":
      return "> RPC FAILED · RETRY SNIPE";
    default:
      if (msg.length < 90) return `> ${msg.toUpperCase()}`;
      return "> SNIPE FAILED · RETRY";
  }
}
