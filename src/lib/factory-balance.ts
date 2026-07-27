import { FACTORY_WALLET } from "@/lib/constants";

const RPC_CANDIDATES = [
  process.env.ETH_RPC_URL,
  "https://ethereum.publicnode.com",
  "https://1rpc.io/eth",
  "https://eth.drpc.org",
].filter((url): url is string => Boolean(url));

const WEI_PER_ETH = 1e18;

export type FactoryBalanceSnapshot = {
  wallet: string;
  ethBalance: number;
  ethPriceUsd: number;
  raisedUsd: number;
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

async function fetchEthBalanceEth(wallet: string): Promise<number> {
  let lastError: unknown;

  for (const rpcUrl of RPC_CANDIDATES) {
    try {
      const wei = await ethGetBalance(rpcUrl, wallet);
      return Number(wei) / WEI_PER_ETH;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All ETH RPC endpoints failed");
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

/** Live factory wallet ETH × ETH/USD spot. */
export async function getFactoryBalanceSnapshot(): Promise<FactoryBalanceSnapshot> {
  const wallet = FACTORY_WALLET;
  const [ethBalance, ethPriceUsd] = await Promise.all([
    fetchEthBalanceEth(wallet),
    fetchEthPriceUsd(),
  ]);

  return {
    wallet,
    ethBalance,
    ethPriceUsd,
    raisedUsd: ethBalance * ethPriceUsd,
    updatedAt: new Date().toISOString(),
  };
}
