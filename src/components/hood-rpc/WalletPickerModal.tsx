"use client";

import { useEffect, useState } from "react";
import type { SquadWallet } from "@/lib/operator-wallets";
import { shortAddr } from "@/lib/operator-wallets";

export type FleetWallet = {
  id: number;
  address: string;
  label: string;
  bal: string;
};

/** @deprecated Shared fake fleet removed — tools use the user's session squad. */
export const FLEET: FleetWallet[] = [];

export default function WalletPickerModal({
  open,
  selected,
  wallets,
  onClose,
  onConfirm,
}: {
  open: boolean;
  selected: number[];
  wallets: SquadWallet[];
  onClose: () => void;
  onConfirm: (ids: number[]) => void;
}) {
  const [draft, setDraft] = useState<number[]>(selected);

  useEffect(() => {
    if (open) setDraft(selected.filter((id) => wallets.some((w) => w.id === id)));
  }, [open, selected, wallets]);

  if (!open) return null;

  function toggle(id: number) {
    setDraft((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id].sort((a, b) => a - b),
    );
  }

  function selectFirst(n: number) {
    setDraft(wallets.slice(0, n).map((w) => w.id));
  }

  return (
    <div className="hrpc-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="hrpc-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Select wallets"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hrpc-modal-head">
          <h3 className="hrpc-section-title hrpc-section-title-sm">
            Select wallets
          </h3>
          <button type="button" className="hrpc-btn hrpc-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {wallets.length === 0 ? (
          <p className="hrpc-help">
            Generate or paste squad keys first — this list is your session only.
          </p>
        ) : (
          <p className="hrpc-help">
            Pick session wallets for this sniper. Selected:{" "}
            <strong>{draft.length}</strong>
          </p>
        )}
        <div className="hrpc-row-actions" style={{ marginBottom: "0.55rem" }}>
          {[2, 5, 10, 20, 40].map((n) => (
            <button
              key={n}
              type="button"
              className="hrpc-btn hrpc-btn-ghost"
              onClick={() => selectFirst(n)}
              disabled={!wallets.length}
            >
              First {n}
            </button>
          ))}
          <button
            type="button"
            className="hrpc-btn hrpc-btn-ghost"
            onClick={() => setDraft(wallets.map((w) => w.id))}
            disabled={!wallets.length}
          >
            All
          </button>
          <button
            type="button"
            className="hrpc-btn hrpc-btn-ghost"
            onClick={() => setDraft([])}
          >
            Clear
          </button>
        </div>
        <div className="hrpc-wallet-scroll">
          {wallets.map((w) => {
            const on = draft.includes(w.id);
            return (
              <label key={w.id} className={`hrpc-wallet-option ${on ? "on" : ""}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(w.id)}
                />
                <span className="hrpc-mono hrpc-pnl-rank">#{w.id}</span>
                <span className="hrpc-wallet-option-meta">
                  <span className="hrpc-pnl-user">{w.label}</span>
                  <button
                    type="button"
                    className="hrpc-addr-btn hrpc-mono hrpc-muted"
                    title="Click to copy"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void navigator.clipboard.writeText(w.address);
                    }}
                  >
                    {shortAddr(w.address)}
                  </button>
                </span>
                <span className="hrpc-mono hrpc-lime">
                  {w.hasKey ? "KEY" : "ADDR"} · {w.live}
                </span>
              </label>
            );
          })}
        </div>
        <div className="hrpc-row-actions" style={{ marginTop: "0.65rem" }}>
          <button
            type="button"
            className="hrpc-btn"
            onClick={() => {
              onConfirm(draft);
              onClose();
            }}
            disabled={!wallets.length}
          >
            Use {draft.length} wallet{draft.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
