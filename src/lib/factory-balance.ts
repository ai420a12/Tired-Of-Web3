import { FACTORY_WALLET } from "@/lib/constants";

const WEI_PER_ETH = 1e18;

/** Ethereum mainnet public / env RPCs. */
const ETH_MAINNET_RPCS = [
  process.env.ETH_RPC_URL,
  "https://ethereum.publicnode.com",
  "https://1rpc.io/eth",
  "https://eth.drpc.org",
].filter((url): url is string => Boolean(url));

/**
 * Robinhood Chain mainnet — Arbitrum L2, native gas = ETH.
 * Chain ID 4663 (0x1237). Docs: https://docs.robinhood.com/chain/connecting/
 */
export const ROBINHOOD_CHAIN_ID = 4663;
const ROBINHOOD_RPCS = [
  process.env.ROBINHOOD_RPC_URL,
  "https://rpc.mainnet.chain.robinhood.com",
].filter((url): url is string => Boolean(url));

export type ChainBalanceResult = {
  eth: number;
  ok: boolean;
  error?: string;
  rpcUsed?: string;
};

export type FactoryBalanceSnapshot = {
  wallet: string;
  /** Sum of successful chain balances (ETH units). */
  ethBalance: number;
  ethMainnet: ChainBalanceResult;
  ethRobinhood: ChainBalanceResult;
  ethPriceUsd: number;
  raisedUsd: number;
  /** True when at least one chain RPC failed. */
  partial: boolean;
  updatedAt: string;
};

async function ethGetBalance(rpcUrl: string, wallet: string): Promise<bigint> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [wallet, "latest"],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`RPC ${rpcUrl} HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    result?: string;
    error?: { message?: string };
  };

  if (json.error?.message) {
    throw new Error(`RPC ${rpcUrl}: ${json.error.message}`);
  }
  if (typeof json.result !== "string") {
    throw new Error(`RPC ${rpcUrl}: missing balance result`);
  }

  return BigInt(json.result);
}

async function fetchNativeBalanceEth(
  wallet: string,
  rpcCandidates: string[],
  label: string,
): Promise<ChainBalanceResult> {
  let lastError: unknown;

  for (const rpcUrl of rpcCandidates) {
    try {
      const wei = await ethGetBalance(rpcUrl, wallet);
      return {
        eth: Number(wei) / WEI_PER_ETH,
        ok: true,
        rpcUsed: rpcUrl,
      };
    } catch (err) {
      lastError = err;
    }
  }

  const message =
    lastError instanceof Error
      ? lastError.message
      : `All ${label} RPC endpoints failed`;

  return { eth: 0, ok: false, error: message };
}

async function fetchEthPriceUsd(): Promise<number> {
  const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`ETH price HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    data?: { amount?: string };
  };
  const amount = Number(json.data?.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid ETH price from Coinbase");
  }

  return amount;
}

/**
 * Live factory wallet native ETH on Ethereum mainnet + Robinhood Chain,
 * valued at ETH/USD spot. If one chain fails, the other still contributes.
 */
export async function getFactoryBalanceSnapshot(): Promise<FactoryBalanceSnapshot> {
  const wallet = FACTORY_WALLET;
  const [ethMainnet, ethRobinhood, ethPriceUsd] = await Promise.all([
    fetchNativeBalanceEth(wallet, ETH_MAINNET_RPCS, "Ethereum mainnet"),
    fetchNativeBalanceEth(wallet, ROBINHOOD_RPCS, "Robinhood Chain"),
    fetchEthPriceUsd(),
  ]);

  if (!ethMainnet.ok && !ethRobinhood.ok) {
    throw new Error(
      `All chain RPCs failed. mainnet: ${ethMainnet.error}; robinhood: ${ethRobinhood.error}`,
    );
  }

  const ethBalance =
    (ethMainnet.ok ? ethMainnet.eth : 0) +
    (ethRobinhood.ok ? ethRobinhood.eth : 0);

  return {
    wallet,
    ethBalance,
    ethMainnet,
    ethRobinhood,
    ethPriceUsd,
    raisedUsd: ethBalance * ethPriceUsd,
    partial: !ethMainnet.ok || !ethRobinhood.ok,
    updatedAt: new Date().toISOString(),
  };
}
