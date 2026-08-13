/**
 * Operator tools run live (session-scoped). Mint sniper UI stays Coming Soon.
 * Access Key gate uses a real wallet connect + signature separately.
 */
export const HOOD_RPC_DEMO = false;

/**
 * First live product path: buy an ETH OpenSea listing via MetaMask.
 * Override with NEXT_PUBLIC_LIVE_ETH_LISTING_BUY=0 to disable.
 */
export const LIVE_ETH_LISTING_BUY =
  (process.env.NEXT_PUBLIC_LIVE_ETH_LISTING_BUY ?? "1") !== "0";

export const DEMO_TOAST =
  "> SWITCH TO ETH_RPC FOR LIVE LISTING BUYS";
