"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Lime scrollbars on Hood_RPC only — ETH page uses data-eth-rpc (blue). */
export default function HoodRpcLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onEth = pathname?.startsWith("/hood-rpc/eth");

  useEffect(() => {
    if (onEth) {
      document.documentElement.removeAttribute("data-hood-rpc");
      return;
    }
    document.documentElement.setAttribute("data-hood-rpc", "1");
    return () => {
      document.documentElement.removeAttribute("data-hood-rpc");
    };
  }, [onEth]);

  return children;
}
