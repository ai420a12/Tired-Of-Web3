"use client";

import { useEffect, useState } from "react";

export type FleetWallet = {
  id: number;
  address: string;
  label: string;
  bal: string;
};

export const FLEET: FleetWallet[] = Array.from({ length: 40 }, (_, i) => {
  const hex = `${(0xa1 + i).toString(16)}${"420a12ffdeedcafe".repeat(3).slice(0, 36)}${i.toString(16).padStart(2, "0")}`;
  return {
    id: i + 1,
    address: `0x${hex.slice(0, 40)}`,
    label: `Wallet ${i + 1}`,
    bal: `${(0.05 + i * 0.031).toFixed(3)} ETH`,
  };
});

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function WalletPickerModal({
  open,
  selected,
  onClose,
  onConfirm,
}: {
  open: boolean;
  selected: number[];
  onClose: () => void;
  onConfirm: (ids: number[]) => void;
}) {
  const [draft, setDraft] = useState<number[]>(selected);

  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);

  if (!open) return null;

  function toggle(id: number) {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].sort((a, b) => a - b),
    );
  }

  function selectFirst(n: number) {
    setDraft(FLEET.slice(0, n).map((w) => w.id));
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
        <p className="hrpc-help">
          Pick which fleet wallets to use for this sniper. Selected:{" "}
          <strong>{draft.length}</strong>
        </p>
        <div className="hrpc-row-actions" style={{ marginBottom: "0.55rem" }}>
          {[2, 5, 10, 20, 40].map((n) => (
            <button
              key={n}
              type="button"
              className="hrpc-btn hrpc-btn-ghost"
              onClick={() => selectFirst(n)}
            >
              First {n}
            </button>
          ))}
          <button
            type="button"
            className="hrpc-btn hrpc-btn-ghost"
            onClick={() => setDraft(FLEET.map((w) => w.id))}
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
          {FLEET.map((w) => {
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
                  <span className="hrpc-mono hrpc-muted">{shortAddr(w.address)}</span>
                </span>
                <span className="hrpc-mono hrpc-lime">{w.bal}</span>
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
          >
            Use {draft.length} wallet{draft.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
