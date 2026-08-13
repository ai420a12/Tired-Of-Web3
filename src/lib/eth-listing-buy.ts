/**
 * Silent ETH listing snipe — signs in this tab with a session squad key.
 * No MetaMask popup. Broadcast via Alchemy relay.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseGwei,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { broadcastSigned } from "@/lib/operator-tx";

export type GasMode = "normal" | "fast" | "hyper";

export type SilentBuyInput = {
  orderHash?: string;
  protocolAddress: string;
  sessionPrivateKey: Hex;
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
  from: string;
};

const SIGN_RPC = "https://ethereum.publicnode.com";

function gasMultipliers(mode: GasMode): {
  priorityX: bigint;
  maxX: bigint;
  floorPriority: bigint;
} {
  switch (mode) {
    case "normal":
      return {
        priorityX: BigInt(3),
        maxX: BigInt(2),
        floorPriority: parseGwei("3"),
      };
    case "fast":
      return {
        priorityX: BigInt(6),
        maxX: BigInt(2),
        floorPriority: parseGwei("15"),
      };
    default:
      return {
        priorityX: BigInt(12),
        maxX: BigInt(3),
        floorPriority: parseGwei("40"),
      };
  }
}

async function fetchFulfillment(input: SilentBuyInput, buyer: Address) {
  const apiBase = input.apiBase || "/api/hood-rpc/eth";
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

/** Click-to-snipe. No wallet popup. */
export async function buyEthListingSilent(
  input: SilentBuyInput,
): Promise<ListingBuyResult> {
  const account = privateKeyToAccount(input.sessionPrivateKey);
  const apiBase = input.apiBase || "/api/hood-rpc/eth";
  const mode = input.gasMode || "hyper";
  const { priorityX, maxX, floorPriority } = gasMultipliers(mode);

  const txs = await fetchFulfillment(input, account.address);

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

  let nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });

  const txHashes: string[] = [];
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
    const hash = await broadcastSigned(apiBase, signedTx, "eth");
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
    case "NO_SESSION_KEY":
      return "> GENERATE OR PASTE SQUAD KEYS FIRST";
    case "FULFILL_FAILED":
    case "NO_TX":
      return "> NO BUY TX · LISTING SOLD OR UNAVAILABLE";
    default:
      if (/insufficient funds/i.test(msg)) return "> SQUAD WALLET NEEDS MORE ETH";
      if (msg.length < 90) return `> ${msg.toUpperCase()}`;
      return "> SNIPE FAILED · RETRY";
  }
}
