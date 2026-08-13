import { ROBINHOOD_CHAIN_ID } from "@/lib/factory-balance";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const RH_CHAIN_HEX = `0x${ROBINHOOD_CHAIN_ID.toString(16)}`;

const RH_ADD = {
  chainId: RH_CHAIN_HEX,
  chainName: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
  blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
};

function provider(): EthereumProvider {
  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (!eth) throw new Error("NO_WALLET");
  return eth;
}

export async function ensureMintChain(chain: "robinhood" | "ethereum") {
  const eth = provider();
  const chainId = chain === "ethereum" ? "0x1" : RH_CHAIN_HEX;
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
  const tx: Record<string, string> = {
    from: opts.from,
    to: opts.to,
    data: opts.data,
    value: opts.value || "0x0",
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
