"use client";

import { useEffect, type ReactNode } from "react";

/** Forces lime scrollbars on /hood-rpc (overrides global purple site chrome). */
export default function HoodRpcLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute("data-hood-rpc", "1");
    return () => {
      document.documentElement.removeAttribute("data-hood-rpc");
    };
  }, []);

  return children;
}
