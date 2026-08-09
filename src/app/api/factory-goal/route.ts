import { NextResponse } from "next/server";
import { FACTORY_GOAL_USD } from "@/lib/constants";
import {
  getFactoryBalanceSnapshot,
  ROBINHOOD_CHAIN_ID,
} from "@/lib/factory-balance";

/** Cache on the edge/CDN for a few minutes so visitors share one RPC pull. */
export const revalidate = 180;

export async function GET() {
  try {
    const snap = await getFactoryBalanceSnapshot();
    const raisedUsd = Math.max(0, snap.raisedUsd);
    const pct = Math.min(100, (raisedUsd / FACTORY_GOAL_USD) * 100);

    return NextResponse.json(
      {
        goalUsd: FACTORY_GOAL_USD,
        raisedUsd,
        ethBalance: snap.ethBalance,
        ethMainnet: snap.ethMainnet.eth,
        ethRobinhood: snap.ethRobinhood.eth,
        ethPriceUsd: snap.ethPriceUsd,
        pct,
        wallet: snap.wallet,
        partial: snap.partial,
        chains: {
          ethereum: {
            chainId: 1,
            ...snap.ethMainnet,
          },
          robinhood: {
            chainId: ROBINHOOD_CHAIN_ID,
            ...snap.ethRobinhood,
          },
        },
        updatedAt: snap.updatedAt,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=180, stale-while-revalidate=60",
        },
      },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch factory balance";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
