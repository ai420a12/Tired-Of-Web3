"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FACTORY_GOAL_POLL_MS,
  FACTORY_GOAL_USD,
  FACTORY_RAISED_USD,
  FACTORY_WALLET,
} from "@/lib/constants";
import { playClick } from "@/lib/sounds";

function formatUsd(value: number, { whole = false } = {}) {
  // Whole dollars for the goal; cents for early raised balances so $0.07 ≠ "$0"
  const fractionDigits = whole || value >= 100 ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatPct(pct: number) {
  if (pct <= 0) return "0%";
  if (pct < 0.01) return "<0.01%";
  if (pct < 1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
}

type GoalState = {
  raised: number;
  goal: number;
  ethBalance: number | null;
  ethMainnet: number | null;
  ethRobinhood: number | null;
  partial: boolean;
  loading: boolean;
  error: boolean;
};

function formatEth(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export default function GoalBar() {
  const [copied, setCopied] = useState(false);
  const [goalState, setGoalState] = useState<GoalState>({
    raised: FACTORY_RAISED_USD,
    goal: FACTORY_GOAL_USD,
    ethBalance: null,
    ethMainnet: null,
    ethRobinhood: null,
    partial: false,
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
          ethBalance?: number;
          ethMainnet?: number;
          ethRobinhood?: number;
          partial?: boolean;
        };
        if (cancelled) return;
        const asEth = (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : null;
        setGoalState({
          raised: Math.max(
            FACTORY_RAISED_USD,
            Math.max(0, Number(data.raisedUsd) || 0),
          ),
          goal: Math.max(1, Number(data.goalUsd) || FACTORY_GOAL_USD),
          ethBalance: asEth(data.ethBalance),
          ethMainnet: asEth(data.ethMainnet),
          ethRobinhood: asEth(data.ethRobinhood),
          partial: Boolean(data.partial),
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
            100% donations → wallet {walletShort}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-bold">
            <span className="text-neon-pink">{formatUsd(raised)}</span>
            <span className="text-foreground/40"> / </span>
            <span className="text-neon-green">{formatUsd(goal, { whole: true })}</span>
          </p>
          <p className="text-[10px] text-neon-purple sm:text-xs">
            {goalState.loading
              ? "syncing…"
              : goalState.error
                ? "live sync paused"
                : `${formatPct(pct)} funded`}
          </p>
          {!goalState.loading &&
            !goalState.error &&
            goalState.ethBalance != null && (
              <p className="text-[10px] text-foreground/40 sm:text-xs">
                {formatEth(goalState.ethBalance)} ETH total
                {goalState.ethMainnet != null &&
                  goalState.ethRobinhood != null && (
                    <span className="text-foreground/30">
                      {" "}
                      ({formatEth(goalState.ethMainnet)} ETH +{" "}
                      {formatEth(goalState.ethRobinhood)} Ethereum)
                    </span>
                  )}
                {goalState.partial && (
                  <span className="text-neon-pink/70"> · partial sync</span>
                )}
              </p>
            )}
        </div>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full border border-neon-green/40 bg-background/70 sm:h-3.5">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-neon-green via-neon-purple to-neon-pink"
          initial={{ width: 0 }}
          animate={{
            // Keep a visible pulse of progress once any ETH is detected
            width: `${Math.max(pct, raised > 0 ? 0.8 : 0)}%`,
          }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{
            boxShadow:
              raised > 0 ? "0 0 16px rgba(32, 129, 226, 0.55)" : undefined,
          }}
        />
      </div>

      {pct < 2 && (
        <p className="mt-2 text-center font-mono text-[10px] text-foreground/35 sm:text-xs">
          Live ETH on Ethereum fills this bar toward the factory
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
              Factory wallet:
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
