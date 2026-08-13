/**
 * Silent ETH listing snipe — signs in this tab with a session squad key.
 * No MetaMask popup. Broadcast via Alchemy relay.
 */
import {
  createPublicClient,
  createWalletClient,
  formatEther,
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
const SEAPORT_GAS_FALLBACK = BigInt(300000);

function eth4(wei: bigint): string {
  return Number(formatEther(wei)).toFixed(4);
}

/** Fast snipe gas from the live base fee — not 2021-style 40 gwei floors. */
async function quoteSnipeGas(
  publicClient: ReturnType<typeof createPublicClient>,
  mode: GasMode,
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const block = await publicClient.getBlock({ blockTag: "latest" });
  const fees = await publicClient.estimateFeesPerGas().catch(() => null);
  const baseFee =
    block.baseFeePerGas ?? fees?.maxFeePerGas ?? parseGwei("1");
  const netTip = fees?.maxPriorityFeePerGas ?? parseGwei("0.05");

  const spec =
    mode === "normal"
      ? { tipFloor: parseGwei("0.2"), tipCap: parseGwei("2"), tipX: BigInt(1), baseBps: BigInt(1125) }
      : mode === "fast"
        ? { tipFloor: parseGwei("0.4"), tipCap: parseGwei("3"), tipX: BigInt(2), baseBps: BigInt(1250) }
        : { tipFloor: parseGwei("0.5"), tipCap: parseGwei("5"), tipX: BigInt(3), baseBps: BigInt(1500) };

  let tip = netTip * spec.tipX;
  if (tip < spec.tipFloor) tip = spec.tipFloor;
  if (tip > spec.tipCap) tip = spec.tipCap;

  return {
    maxPriorityFeePerGas: tip,
    maxFeePerGas: (baseFee * spec.baseBps) / BigInt(1000) + tip,
  };
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

  const { maxFeePerGas, maxPriorityFeePerGas } = await quoteSnipeGas(
    publicClient,
    mode,
  );

  let nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });

  const txHashes: string[] = [];
  for (const tx of txs) {
    const value = BigInt(tx.value || "0x0");
    let gas = SEAPORT_GAS_FALLBACK;
    try {
      gas = await publicClient.estimateGas({
        account: account.address,
        to: tx.to as Address,
        data: tx.data as Hex,
        value,
      });
      gas = (gas * BigInt(115)) / BigInt(100);
    } catch {
      /* keep fallback */
    }
    const bal = await publicClient.getBalance({ address: account.address });
    const gasCap = gas * maxFeePerGas;
    const need = value + gasCap;
    if (bal < need) {
      throw new Error(
        `insufficient funds · has ${eth4(bal)} ETH · listing ${eth4(value)} + gas ~${eth4(gasCap)} · needs ~${eth4(need)} ETH`,
      );
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

export function buyErrorLine(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "BUY_FAILED";
  switch (msg) {
    case "NO_SESSION_KEY":
      return "Generate or paste squad keys first";
    case "FULFILL_FAILED":
    case "NO_TX":
      return "No buy tx · listing sold or unavailable";
    default:
      if (/insufficient funds/i.test(msg)) {
        return msg.length < 140 ? msg : "Squad wallet needs more ETH for price + gas";
      }
      if (/Could not build buy tx/i.test(msg)) {
        return "Listing sold or OpenSea could not build the buy tx";
      }
      if (msg.length < 110) return msg;
      return "Snipe failed · retry";
  }
}

export function buyErrorToast(err: unknown): string {
  return `> ${buyErrorLine(err).toUpperCase()}`;
}
