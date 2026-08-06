"use client";

import { useState } from "react";
import { CONTRACT_ADDRESS } from "@/lib/constants";
import { playClick } from "@/lib/sounds";

export default function ContractAddressBar() {
  const [copied, setCopied] = useState(false);

  const copyContract = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="neon-border rounded-xl bg-background/50 px-4 py-3 text-center">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-foreground/50">
        Contract address
      </p>
      <button
        type="button"
        onClick={copyContract}
        className="group mx-auto flex w-full max-w-full items-center justify-center gap-2 rounded-lg border border-neon-green/25 bg-deep-purple/20 px-3 py-2 transition-colors hover:border-neon-green/50 hover:bg-deep-purple/35"
      >
        <span className="min-w-0 truncate font-mono text-[11px] font-semibold text-neon-green sm:text-xs">
          {CONTRACT_ADDRESS}
        </span>
        <span className="shrink-0 text-xs text-foreground/40 group-hover:text-neon-pink">
          {copied ? "✓" : "📋"}
        </span>
      </button>
      <p className="mt-1.5 font-mono text-[10px] text-foreground/40">
        Robinhood CA — tap to copy. buy on the launchpad.
      </p>
      {copied && (
        <p className="mt-1 font-mono text-[10px] text-neon-green">
          copied. go touch the chart before you touch grass.
        </p>
      )}
    </div>
  );
}
