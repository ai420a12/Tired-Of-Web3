import { ROBINHOOD_CHAIN_ID } from "@/lib/factory-balance";
import {
  quoteLiveGas,
  type GasSpeed,
} from "@/lib/live-gas";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const RH_CHAIN_HEX = `0x${ROBINHOOD_CHAIN_ID.toString(16)}`;
const RH_RPC = "https://rpc.mainnet.chain.robinhood.com";

const RH_ADD = {
  chainId: RH_CHAIN_HEX,
  chainName: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: [RH_RPC],
  blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
};

function provider(): EthereumProvider {
  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (!eth) throw new Error("NO_WALLET");
  return eth;
}

function toHex(n: bigint): string {
  return `0x${n.toString(16)}`;
}

/**
 * Live L2 / L1 fees — pin MetaMask to the chain's real base fee
 * instead of stale 2021-style gwei presets.
 */
export async function quoteMintFees(
  chain: "robinhood" | "ethereum",
  mode: GasSpeed = "fast",
  manualGwei?: number,
): Promise<{
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}> {
  const fees = await quoteLiveGas({ chain, mode, manualGwei });
  return {
    maxFeePerGas: toHex(fees.maxFeePerGas),
    maxPriorityFeePerGas: toHex(fees.maxPriorityFeePerGas),
  };
}

export function estimateMintCostEth(opts: {
  valueHex?: string;
  gasHex?: string;
  maxFeePerGasHex?: string;
}): number {
  const value = opts.valueHex ? BigInt(opts.valueHex) : BigInt(0);
  const gas = opts.gasHex ? BigInt(opts.gasHex) : BigInt(0);
  const maxFee = opts.maxFeePerGasHex ? BigInt(opts.maxFeePerGasHex) : BigInt(0);
  const wei = value + gas * maxFee;
  return Number(wei) / 1e18;
}

export async function ensureMintChain(chain: "robinhood" | "ethereum") {
  const eth = provider();
  const chainId = chain === "ethereum" ? "0x1" : RH_CHAIN_HEX;
  const current = String(
    (await eth.request({ method: "eth_chainId" })) || "",
  ).toLowerCase();
  if (current === chainId) return;

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (err) {
    const code = Number((err as { code?: number })?.code);
    if (chain === "robinhood" && (code === 4902 || code === -32603)) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [RH_ADD],
      });
      return;
    }
    throw err;
  }
}

export async function sendMintWithMetaMask(opts: {
  chain: "robinhood" | "ethereum";
  from: string;
  to: string;
  data: string;
  value?: string;
  gas?: string;
  gasMode?: GasSpeed;
  manualGwei?: number;
}): Promise<string> {
  const eth = provider();
  await ensureMintChain(opts.chain);
  const fees = await quoteMintFees(
    opts.chain,
    opts.gasMode || "fast",
    opts.manualGwei,
  );
  const tx: Record<string, string> = {
    from: opts.from,
    to: opts.to,
    data: opts.data,
    value: opts.value || "0x0",
    type: "0x2",
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  };
  if (opts.gas) tx.gas = opts.gas;
  const hash = await eth.request({
    method: "eth_sendTransaction",
    params: [tx],
  });
  if (typeof hash !== "string" || !hash.startsWith("0x")) {
    throw new Error("NO_TX_HASH");
  }
  return hash;
}

export function walletErrorText(err: unknown): string {
  const e = err as { code?: number; message?: string; shortMessage?: string };
  if (e?.code === 4001) return "MetaMask rejected";
  return e?.shortMessage || e?.message || "MINT_FAILED";
}
