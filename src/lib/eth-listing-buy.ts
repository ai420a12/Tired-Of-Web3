/**
 * ETH listing snipe via the same wallet used for Access Key verify (MetaMask/Rabby).
 * Elevated gas is suggested on the tx; user confirms once in their wallet.
 */
import { parseGwei } from "viem";

export type GasMode = "normal" | "fast" | "hyper";

export type WalletBuyInput = {
  orderHash?: string;
  protocolAddress: string;
  buyer: string;
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

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const ETH_CHAIN_ID_HEX = "0x1";

function getEthereum(): EthereumProvider {
  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (!eth) throw new Error("NO_WALLET");
  return eth;
}

async function ensureMainnet(eth: EthereumProvider) {
  const chainId = String(
    (await eth.request({ method: "eth_chainId" })) || "",
  ).toLowerCase();
  if (chainId === ETH_CHAIN_ID_HEX) return;
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ETH_CHAIN_ID_HEX }],
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ETH_CHAIN_ID_HEX,
            chainName: "Ethereum Mainnet",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://ethereum.publicnode.com"],
            blockExplorerUrls: ["https://etherscan.io"],
          },
        ],
      });
      return;
    }
    throw err;
  }
}

function gasHints(mode: GasMode): {
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
} {
  // Hyper by default — sniper-style tip
  switch (mode) {
    case "normal":
      return {
        maxPriorityFeePerGas: `0x${parseGwei("2").toString(16)}`,
        maxFeePerGas: `0x${parseGwei("40").toString(16)}`,
      };
    case "fast":
      return {
        maxPriorityFeePerGas: `0x${parseGwei("15").toString(16)}`,
        maxFeePerGas: `0x${parseGwei("80").toString(16)}`,
      };
    default:
      return {
        maxPriorityFeePerGas: `0x${parseGwei("40").toString(16)}`,
        maxFeePerGas: `0x${parseGwei("150").toString(16)}`,
      };
  }
}

async function fetchFulfillment(input: WalletBuyInput, buyer: string) {
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

/** Snipe with the connected Access Key wallet. */
export async function buyEthListingWithConnectedWallet(
  input: WalletBuyInput,
): Promise<ListingBuyResult> {
  const eth = getEthereum();
  await ensureMainnet(eth);

  const accounts = (await eth.request({
    method: "eth_requestAccounts",
  })) as string[];
  const active = accounts?.[0]?.toLowerCase();
  if (!active) throw new Error("NO_ACCOUNT");
  if (active !== input.buyer.toLowerCase()) {
    throw new Error("WALLET_MISMATCH");
  }

  const txs = await fetchFulfillment(input, active);
  const gas = gasHints(input.gasMode || "hyper");
  const txHashes: string[] = [];

  for (const tx of txs) {
    const hash = (await eth.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: active,
          to: tx.to,
          data: tx.data,
          value: tx.value || "0x0",
          maxFeePerGas: gas.maxFeePerGas,
          maxPriorityFeePerGas: gas.maxPriorityFeePerGas,
        },
      ],
    })) as string;
    if (!hash) throw new Error("TX_REJECTED");
    txHashes.push(hash);
  }

  return {
    txHashes,
    from: active,
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
  const code = (err as { code?: number })?.code;
  if (code === 4001 || /user rejected|denied/i.test(msg)) {
    return "> SNIPE CANCELLED";
  }
  switch (msg) {
    case "NO_WALLET":
      return "> CONNECT METAMASK / RABBY";
    case "NO_ACCOUNT":
      return "> CONNECT WALLET FIRST";
    case "WALLET_MISMATCH":
      return "> USE THE SAME WALLET YOU VERIFIED WITH";
    case "FULFILL_FAILED":
    case "NO_TX":
      return "> NO BUY TX · LISTING SOLD OR UNAVAILABLE";
    default:
      if (/insufficient funds/i.test(msg)) return "> NEED MORE ETH IN WALLET";
      if (msg.length < 90) return `> ${msg.toUpperCase()}`;
      return "> SNIPE FAILED · RETRY";
  }
}
