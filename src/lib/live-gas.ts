export type GasSpeed = "normal" | "fast" | "hyper" | "manual";

const RH_RPC = "https://rpc.mainnet.chain.robinhood.com";
const ETH_RPC = "https://ethereum.publicnode.com";

export type LiveGasQuote = {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  liveGwei: number;
  maxFeeGwei: number;
};

function toGwei(wei: bigint): number {
  return Number(wei) / 1e9;
}

function fromGwei(gwei: number): bigint {
  if (!Number.isFinite(gwei) || gwei <= 0) return BigInt(0);
  return BigInt(Math.round(gwei * 1e9));
}

async function rpcCall(url: string, method: string, params: unknown[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    result?: string | { baseFeePerGas?: string };
  };
  return json.result;
}

type SpeedSpec = {
  baseBps: bigint;
  tipX: bigint;
  tipFloor: bigint;
  tipCap: bigint;
  maxFeeCap: bigint;
};

function specFor(
  chain: "robinhood" | "ethereum",
  mode: Exclude<GasSpeed, "manual">,
): SpeedSpec {
  if (chain === "robinhood") {
    if (mode === "normal") {
      return {
        baseBps: BigInt(1500),
        tipX: BigInt(1),
        tipFloor: fromGwei(0.001),
        tipCap: fromGwei(0.05),
        maxFeeCap: fromGwei(5),
      };
    }
    if (mode === "fast") {
      return {
        baseBps: BigInt(2000),
        tipX: BigInt(2),
        tipFloor: fromGwei(0.002),
        tipCap: fromGwei(0.2),
        maxFeeCap: fromGwei(8),
      };
    }
    return {
      baseBps: BigInt(3000),
      tipX: BigInt(4),
      tipFloor: fromGwei(0.005),
      tipCap: fromGwei(0.8),
      maxFeeCap: fromGwei(15),
    };
  }

  if (mode === "normal") {
    return {
      baseBps: BigInt(1500),
      tipX: BigInt(1),
      tipFloor: fromGwei(0.05),
      tipCap: fromGwei(5),
      maxFeeCap: fromGwei(120),
    };
  }
  if (mode === "fast") {
    return {
      baseBps: BigInt(2000),
      tipX: BigInt(2),
      tipFloor: fromGwei(0.1),
      tipCap: fromGwei(15),
      maxFeeCap: fromGwei(250),
    };
  }
  return {
    baseBps: BigInt(3000),
    tipX: BigInt(4),
    tipFloor: fromGwei(0.2),
    tipCap: fromGwei(40),
    maxFeeCap: fromGwei(500),
  };
}

export function formatLiveGwei(gwei: number): string {
  if (!Number.isFinite(gwei) || gwei <= 0) return "—";
  if (gwei < 0.001) return gwei.toFixed(5);
  if (gwei < 0.1) return gwei.toFixed(4);
  if (gwei < 1) return gwei.toFixed(3);
  if (gwei < 10) return gwei.toFixed(2);
  return gwei.toFixed(1);
}

export async function quoteLiveGas(opts: {
  chain: "robinhood" | "ethereum";
  mode?: GasSpeed;
  manualGwei?: number;
}): Promise<LiveGasQuote> {
  const rpc = opts.chain === "ethereum" ? ETH_RPC : RH_RPC;
  const mode = opts.mode || "fast";

  const block = (await rpcCall(rpc, "eth_getBlockByNumber", [
    "latest",
    false,
  ])) as { baseFeePerGas?: string } | string;
  const base =
    typeof block === "object" && block?.baseFeePerGas
      ? BigInt(block.baseFeePerGas)
      : BigInt((await rpcCall(rpc, "eth_gasPrice", [])) as string);

  let netTip = BigInt(0);
  try {
    netTip = BigInt((await rpcCall(rpc, "eth_maxPriorityFeePerGas", [])) as string);
  } catch {
    netTip = BigInt(0);
  }

  if (mode === "manual") {
    const fee = fromGwei(Number(opts.manualGwei));
    if (fee <= BigInt(0)) {
      throw new Error("ENTER_GWEI");
    }
    let tip = fee / BigInt(10);
    const minTip = fromGwei(opts.chain === "ethereum" ? 0.01 : 0.001);
    if (tip < minTip) tip = minTip;
    if (tip >= fee) tip = fee / BigInt(2) || minTip;
    return {
      maxFeePerGas: fee,
      maxPriorityFeePerGas: tip,
      liveGwei: toGwei(base),
      maxFeeGwei: toGwei(fee),
    };
  }

  const spec = specFor(opts.chain, mode);
  let tip = netTip * spec.tipX;
  if (tip < spec.tipFloor) tip = spec.tipFloor;
  if (tip > spec.tipCap) tip = spec.tipCap;

  let maxFee = (base * spec.baseBps) / BigInt(1000) + tip;
  const floor = base + tip + (base * BigInt(125)) / BigInt(1000);
  if (maxFee < floor) maxFee = floor;
  if (maxFee > spec.maxFeeCap && spec.maxFeeCap >= floor) {
    maxFee = spec.maxFeeCap;
  }
  if (maxFee <= tip) maxFee = tip + base;

  return {
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: tip,
    liveGwei: toGwei(base),
    maxFeeGwei: toGwei(maxFee),
  };
}
