/**
 * Tools / snipers stay demo (UI only, no real txs).
 * Access Key gate uses a real wallet connect + signature separately.
 */
export const HOOD_RPC_DEMO = true;

/**
 * First live product path: buy an ETH OpenSea listing via MetaMask.
 * Does not turn off HOOD_RPC_DEMO for tools / arm / meme snipers.
 * Override with NEXT_PUBLIC_LIVE_ETH_LISTING_BUY=0 to disable.
 */
export const LIVE_ETH_LISTING_BUY =
  (process.env.NEXT_PUBLIC_LIVE_ETH_LISTING_BUY ?? "1") !== "0";

export const DEMO_TOAST =
  "> DEMO MODE · Tools are UI-only · no real on-chain txs.";

export const DEMO_WALLET =
  "0xDEMO0000000000000000000000000000H00D";
