import { ROBINHOOD_CHAIN_ID } from "@/lib/factory-balance";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const RH_CHAIN_HEX = `0x${ROBINHOOD_CHAIN_ID.toString(16)}`;
const RH_RPC = "https://rpc.mainnet.chain.robinhood.com";
const ETH_RPC = "https://ethereum.publicnode.com";

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

async function rpcCall(url: string, method: string, params: unknown[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const json = (await res.json()) as { result?: string | { baseFeePerGas?: string } };
  return json.result;
}

/**
 * Live L2 fees — MetaMask on custom chains often quotes ETH-mainnet gwei
 * and the popup jumps. Pin the wallet to the chain's real base fee.
 */
export async function quoteMintFees(chain: "robinhood" | "ethereum"): Promise<{
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}> {
  const rpc = chain === "ethereum" ? ETH_RPC : RH_RPC;
  const block = (await rpcCall(rpc, "eth_getBlockByNumber", [
    "latest",
    false,
  ])) as { baseFeePerGas?: string } | string;
  const base =
    typeof block === "object" && block?.baseFeePerGas
      ? BigInt(block.baseFeePerGas)
      : BigInt(await rpcCall(rpc, "eth_gasPrice", []) as string);
  let tip = BigInt(0);
  try {
    tip = BigInt((await rpcCall(rpc, "eth_maxPriorityFeePerGas", [])) as string);
  } catch {
    tip = BigInt(0);
  }

  if (chain === "robinhood") {
    const floor = BigInt(1_000_000); // 0.001 gwei
    const cap = BigInt(80_000_000); // 0.08 gwei
    if (tip < floor) tip = floor;
    if (tip > cap) tip = cap;
    let maxFee = base * BigInt(2) + tip;
    const maxFeeCap = BigInt(200_000_000); // 0.2 gwei
    if (maxFee > maxFeeCap) maxFee = maxFeeCap;
    if (maxFee <= tip) maxFee = tip + base;
    return {
      maxFeePerGas: toHex(maxFee),
      maxPriorityFeePerGas: toHex(tip),
    };
  }

  const floor = BigInt(10_000_000); // 0.01 gwei
  const cap = BigInt(2_000_000_000); // 2 gwei
  if (tip < floor) tip = floor;
  if (tip > cap) tip = cap;
  return {
    maxFeePerGas: toHex((base * BigInt(1250)) / BigInt(1000) + tip),
    maxPriorityFeePerGas: toHex(tip),
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
}): Promise<string> {
  const eth = provider();
  await ensureMintChain(opts.chain);
  const fees = await quoteMintFees(opts.chain);
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
