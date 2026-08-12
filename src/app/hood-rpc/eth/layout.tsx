"use client";

import { useEffect, type ReactNode } from "react";

export default function EthRpcLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.removeAttribute("data-hood-rpc");
    root.setAttribute("data-eth-rpc", "1");
    return () => {
      root.removeAttribute("data-eth-rpc");
    };
  }, []);

  return children;
}
