/** Marketing / main Tired Of Web3 landing site */
export const MARKETING_SITE = "https://hoodrpc.xyz";

/** Hood_RPC + ETH_RPC sniper dashboard */
export const SNIPER_SITE = "https://tiredofweb3.xyz";

export const SNIPER_HOSTS = new Set([
  "tiredofweb3.xyz",
  "www.tiredofweb3.xyz",
]);

export function isEthPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === "/eth" ||
    pathname.startsWith("/eth/") ||
    pathname.startsWith("/hood-rpc/eth")
  );
}
