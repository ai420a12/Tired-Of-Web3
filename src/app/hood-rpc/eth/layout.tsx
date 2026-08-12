"use client";

import { useEffect, type ReactNode } from "react";

export default function EthRpcLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute("data-eth-rpc", "1");
    return () => {
      document.documentElement.removeAttribute("data-eth-rpc");
    };
  }, []);

  return children;
}

