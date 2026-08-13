/**
 * Browser-only ETH OpenSea listing purchase via MetaMask/Rabby.
 * Private keys never leave the wallet extension.
 */

export type ListingBuyInput = {
  orderHash: string;
  protocolAddress: string;
  buyer: string;
  /** Expected max price in ETH — shown in confirm; not enforced on-chain here */
  priceEth: number;
  tokenName: string;
  openseaUrl?: string;
  apiBase?: string;
};

export type ListingBuyResult = {
  txHashes: string[];
  explorerUrl: string;
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const ETH_CHAIN_ID_HEX = "0x1";

function getEthereum(): EthereumProvider {
  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (!eth) {
    throw new Error("NO_WALLET");
  }
  return eth;
}

async function ensureEthereumMainnet(eth: EthereumProvider) {
  const chainId = (await eth.request({ method: "eth_chainId" })) as string;
  if (chainId?.toLowerCase() === ETH_CHAIN_ID_HEX) return;
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

async function waitReceipt(
  eth: EthereumProvider,
  hash: string,
  timeoutMs = 120_000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = (await eth.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    })) as { status?: string } | null;
    if (receipt?.status) {
      return receipt.status === "0x1" || receipt.status === "1";
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return true; // submitted; receipt may still be pending
}

export async function buyEthListingWithMetaMask(
  input: ListingBuyInput,
): Promise<ListingBuyResult> {
  const eth = getEthereum();
  await ensureEthereumMainnet(eth);

  const accounts = (await eth.request({
    method: "eth_requestAccounts",
  })) as string[];
  const active = accounts?.[0]?.toLowerCase();
  if (!active) throw new Error("NO_ACCOUNT");
  if (active !== input.buyer.toLowerCase()) {
    throw new Error("WALLET_MISMATCH");
  }

  const apiBase = input.apiBase || "/api/hood-rpc";
  const res = await fetch(`${apiBase}/buy-listing`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orderHash: input.orderHash,
      protocolAddress: input.protocolAddress,
      chain: "ethereum",
      buyer: input.buyer,
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

  const txHashes: string[] = [];
  for (const tx of data.transactions) {
    const hash = (await eth.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: input.buyer,
          to: tx.to,
          data: tx.data,
          value: tx.value || "0x0",
        },
      ],
    })) as string;
    if (!hash) throw new Error("TX_REJECTED");
    txHashes.push(hash);
    await waitReceipt(eth, hash);
  }

  return {
    txHashes,
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
    return "> BUY CANCELLED IN WALLET";
  }
  switch (msg) {
    case "NO_WALLET":
      return "> NO EVM WALLET · INSTALL METAMASK / RABBY";
    case "NO_ACCOUNT":
      return "> CONNECT WALLET FIRST";
    case "WALLET_MISMATCH":
      return "> SWITCH METAMASK TO YOUR ACCESS KEY WALLET";
    case "FULFILL_FAILED":
      return "> LISTING UNAVAILABLE · MAY BE SOLD";
    default:
      if (msg.length < 80) return `> ${msg.toUpperCase()}`;
      return "> BUY FAILED · TRY AGAIN OR OPENSEA";
  }
}
