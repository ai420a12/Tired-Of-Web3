"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FACTORY_GOAL_POLL_MS,
  FACTORY_GOAL_USD,
  FACTORY_WALLET,
} from "@/lib/constants";
import { playClick } from "@/lib/sounds";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

type GoalState = {
  raised: number;
  goal: number;
  loading: boolean;
  error: boolean;
};

export default function GoalBar() {
  const [copied, setCopied] = useState(false);
  const [goalState, setGoalState] = useState<GoalState>({
    raised: 0,
    goal: FACTORY_GOAL_USD,
    loading: true,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/factory-goal", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          raisedUsd?: number;
          goalUsd?: number;
        };
        if (cancelled) return;
        setGoalState({
          raised: Math.max(0, Number(data.raisedUsd) || 0),
          goal: Math.max(1, Number(data.goalUsd) || FACTORY_GOAL_USD),
          loading: false,
          error: false,
        });
      } catch {
        if (cancelled) return;
        setGoalState((prev) => ({
          ...prev,
          loading: false,
          error: true,
        }));
      }
    }

    void load();
    const id = window.setInterval(() => void load(), FACTORY_GOAL_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const raised = goalState.raised;
  const goal = goalState.goal;
  const pct = Math.min(100, (raised / goal) * 100);
  const walletShort =
    FACTORY_WALLET.length > 12
      ? `${FACTORY_WALLET.slice(0, 6)}…${FACTORY_WALLET.slice(-4)}`
      : FACTORY_WALLET;

  const copyWallet = async () => {
    try {
      await navigator.clipboard.writeText(FACTORY_WALLET);
      playClick();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard failures
    }
  };

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
            {goalState.loading
              ? "syncing…"
              : goalState.error
                ? "live sync paused"
                : `${pct.toFixed(1)}% funded`}
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
              pct > 0 ? "0 0 16px rgba(0, 255, 65, 0.55)" : undefined,
          }}
        />
      </div>

      {pct < 2 && (
        <p className="mt-2 text-center font-mono text-[10px] text-foreground/35 sm:text-xs">
          Live ETH balance fills this bar toward the factory
        </p>
      )}

      <div className="mt-4 space-y-3 border-t border-neon-green/20 pt-3">
        <button
          type="button"
          onClick={copyWallet}
          className="flex w-full items-center justify-center rounded-lg border border-neon-purple/30 bg-background/40 px-3 py-4 text-center font-mono transition-colors hover:border-neon-pink/40 hover:bg-neon-pink/5 sm:px-4 sm:py-5"
          title={copied ? "Copied" : "Click to copy wallet"}
          aria-label={copied ? "Wallet address copied" : "Copy fee wallet address"}
        >
          <span className="min-w-0">
            <span className="mr-2 text-sm text-foreground/60 sm:text-base">
              Fee wallet:
            </span>
            <span className="break-all text-sm font-bold text-neon-pink sm:text-base md:text-lg">
              {FACTORY_WALLET}
            </span>
            {copied && (
              <span className="mt-1 block text-xs text-neon-green">Copied ✓</span>
            )}
          </span>
        </button>
        <p className="text-center font-mono text-[10px] leading-relaxed text-neon-pink sm:text-xs">
          Anyone who would like to donate ETH to the cause and help us reach our
          goal faster can also use this wallet for donations.
        </p>
      </div>
    </div>
  );
}
