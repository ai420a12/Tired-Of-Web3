"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isEthPath } from "@/lib/site-domains";

/** Lime scrollbars on Hood_RPC only — ETH page uses data-eth-rpc (blue). */
export default function HoodRpcLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onEth = isEthPath(pathname);

  useEffect(() => {
    const root = document.documentElement;
    if (onEth) {
      root.removeAttribute("data-hood-rpc");
      root.setAttribute("data-eth-rpc", "1");
      return () => {
        root.removeAttribute("data-eth-rpc");
      };
    }
    root.removeAttribute("data-eth-rpc");
    root.setAttribute("data-hood-rpc", "1");
    return () => {
      root.removeAttribute("data-hood-rpc");
    };
  }, [onEth]);

  return children;
}
