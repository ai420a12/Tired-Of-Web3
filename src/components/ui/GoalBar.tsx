"use client";

import { motion } from "framer-motion";
import {
  FACTORY_GOAL_USD,
  FACTORY_RAISED_USD,
  FACTORY_WALLET,
} from "@/lib/constants";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function GoalBar() {
  const raised = Math.max(0, FACTORY_RAISED_USD);
  const goal = FACTORY_GOAL_USD;
  const pct = Math.min(100, (raised / goal) * 100);
  const walletShort =
    FACTORY_WALLET === "TBA"
      ? "TBA"
      : `${FACTORY_WALLET.slice(0, 4)}…${FACTORY_WALLET.slice(-4)}`;

  return (
    <div className="neon-border-green w-full rounded-xl bg-deep-purple/40 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 font-mono text-xs sm:text-sm">
        <div className="min-w-0">
          <p className="font-bold tracking-wide text-neon-green">
            FACTORY GOAL
          </p>
          <p className="mt-0.5 truncate text-[10px] text-foreground/40 sm:text-xs">
            100% trading fees → wallet {walletShort}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-bold">
            <span className="text-neon-pink">{formatUsd(raised)}</span>
            <span className="text-foreground/40"> / </span>
            <span className="text-neon-green">{formatUsd(goal)}</span>
          </p>
          <p className="text-[10px] text-neon-purple sm:text-xs">
            {pct.toFixed(1)}% funded
          </p>
        </div>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full border border-neon-green/40 bg-background/70 sm:h-3.5">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-neon-green via-neon-purple to-neon-pink"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(pct, 0)}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{
            boxShadow:
              pct > 0 ? "0 0 16px rgba(57, 255, 20, 0.55)" : undefined,
          }}
        />
      </div>

      {pct < 2 && (
        <p className="mt-2 text-center font-mono text-[10px] text-foreground/35 sm:text-xs">
          LP loading… fees fill this bar toward the factory
        </p>
      )}
    </div>
  );
}
