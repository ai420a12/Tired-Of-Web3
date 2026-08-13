"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";
import {
  signAndBroadcastMint,
  type SquadMintWallet,
} from "@/lib/seadrop-mint";
import type { MintFeedRow } from "@/lib/mint-feed";

type Props = {
  apiBase: string;
  variant: HoodRpcVariant;
  getSquadWallets?: () => SquadMintWallet[];
  onToast: (msg: string) => void;
  onOutcome?: (text: string, kind?: "ok" | "err" | "info") => void;
};

type RadarPayload = {
  ok?: boolean;
  error?: string;
  window?: string;
  trending?: MintFeedRow[];
  mints?: MintFeedRow[];
  market?: MintFeedRow[];
};

type DetailPayload = {
  ok?: boolean;
  error?: string;
  contract?: string;
  name?: string;
  image?: string;
  slug?: string;
  openseaUrl?: string;
  minted?: number;
  max?: number;
  floor?: number;
  holders?: number;
  priceLabel?: string;
  analysis?: {
    ready?: boolean;
    reason?: string;
    mode?: string;
    maxPerWallet?: number;
    unitPriceWei?: string;
    unitPriceEth?: number;
    functionLabel?: string;
    nativeSymbol?: string;
  };
};

const WINDOWS = ["1m", "5m", "15m", "1h", "1d"] as const;
const QTY_SET = [1, 5, 10] as const;
const QTY_MINT = [30, 50, 100] as const;
const POLL_MS = 8000;

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function supplyLine(minted: string | number, max: string | number) {
  const a = String(minted || "").trim();
  const b = String(max || "").trim();
  if (a && b) return `${a}/${b}`;
  return a || b || "—";
}

export default function HoodMintBoard({
  apiBase,
  variant,
  getSquadWallets,
  onToast,
  onOutcome,
}: Props) {
  const [win, setWin] = useState<(typeof WINDOWS)[number]>("1m");
  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<MintFeedRow[]>([]);
  const [mints, setMints] = useState<MintFeedRow[]>([]);
  const [market, setMarket] = useState<MintFeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<MintFeedRow | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [qty, setQty] = useState(1);
  const [allowPaid, setAllowPaid] = useState(false);
  const [minting, setMinting] = useState<number | null>(null);

  const chainLabel = variant === "eth" ? "ETH" : "RH";

  const loadRadar = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/mint-radar?window=${win}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as RadarPayload;
      if (!res.ok || data.ok === false) {
        setNote(data.error || "Live mint feed unavailable");
        return;
      }
      setTrending(data.trending || []);
      setMints(data.mints || []);
      setMarket(data.market || []);
      setNote(null);
    } catch {
      setNote("Live mint feed unavailable");
    } finally {
      setLoading(false);
    }
  }, [apiBase, win]);

  useEffect(() => {
    setLoading(true);
    void loadRadar();
    const id = window.setInterval(() => {
      void loadRadar();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [loadRadar]);

  const loadDetail = useCallback(
    async (contract: string) => {
      try {
        const res = await fetch(
          `${apiBase}/mint-detail?contract=${contract}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as DetailPayload;
        setDetail(data);
      } catch {
        setDetail({ ok: false, error: "Could not load mint route" });
      }
    },
    [apiBase],
  );

  const selectRow = useCallback(
    (row: MintFeedRow) => {
      setSelected(row);
      setDetail(null);
      setAllowPaid(false);
      void loadDetail(row.contract);
    },
    [loadDetail],
  );

  const q = query.trim().toLowerCase();
  const filterRows = useCallback(
    (rows: MintFeedRow[]) => {
      if (!q) return rows;
      return rows.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          row.contract.includes(q) ||
          row.slug.toLowerCase().includes(q),
      );
    },
    [q],
  );

  const paid = Number(detail?.analysis?.unitPriceEth || 0) > 0;
  const ready = Boolean(detail?.analysis?.ready);
  const unit = Number(detail?.analysis?.unitPriceEth || 0);
  const maxPerWallet = Number(detail?.analysis?.maxPerWallet || 0);
  const native = detail?.analysis?.nativeSymbol || "ETH";
  const signer = getSquadWallets?.()[0] || null;

  const mintLabel = useMemo(() => {
    if (!selected) return "Pick a live mint";
    if (detail && !ready) return detail.analysis?.reason || "No mint route";
    if (paid && !allowPaid) return "Enable paid mint";
    if (minting != null) return `Minting ${minting}…`;
    return `Mint ${qty}`;
  }, [selected, detail, ready, paid, allowPaid, minting, qty]);

  async function mintQuantity(quantity: number) {
    const wallets = getSquadWallets?.() || [];
    const wallet = wallets[0] || null;
    if (!selected) {
      onToast("> CLICK A LIVE MINT FIRST");
      return;
    }
    if (!wallet) {
      onToast("> GENERATE OR PASTE SQUAD KEYS FIRST");
      return;
    }
    if (paid && !allowPaid) {
      onToast("> ENABLE PAID MINT FIRST");
      return;
    }
    if (detail && !ready) {
      onToast(`> ${detail.analysis?.reason || "NO MINT ROUTE"}`);
      return;
    }

    setQty(quantity);
    setMinting(quantity);
    const name = detail?.name || selected.name;
    onOutcome?.(
      `Mint ${quantity} · ${name} · wallet #${wallet.id} ${shortAddr(wallet.address)}`,
      "info",
    );
    try {
      const res = await fetch(`${apiBase}/mint-tx`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contract: selected.contract,
          quantity,
          from: wallet.address,
          allowPaid: paid && allowPaid,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        tx?: {
          to?: string;
          data?: string;
          value?: string;
          gas?: string;
          from?: string;
          serviceFeeTotalEth?: number;
        };
      };
      if (!res.ok || !data.ok || !data.tx) {
        throw new Error(data.error || "MINT_ROUTE_FAILED");
      }
      const hash = await signAndBroadcastMint({
        variant,
        apiBase,
        privateKey: wallet.pk,
        tx: data.tx,
      });
      const fee =
        data.tx.serviceFeeTotalEth != null
          ? ` · fee ${data.tx.serviceFeeTotalEth} ${native}`
          : "";
      onOutcome?.(
        `Minted ${quantity} · ${name} · ${hash.slice(0, 10)}…${fee}`,
        "ok",
      );
      onToast(`> MINTED ${quantity} · ${name.toUpperCase()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "MINT_FAILED";
      onOutcome?.(`Mint failed · ${name} · ${msg}`, "err");
      onToast(`> MINT FAILED · ${msg}`);
    } finally {
      setMinting(null);
    }
  }

  return (
    <section className="hrpc-mint-board" aria-label="Live mint board" id="mint-now">
      <div className="hrpc-mint-board-head">
        <div>
          <h2 className="hrpc-section-title">Live Mint</h2>
          <p className="hrpc-mint-sub">
            Trending · New Mints · Market · one-click 30 / 50 / 100 on {chainLabel}
          </p>
        </div>
        <div className="hrpc-mint-tools">
          <input
            className="hrpc-mint-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search collection or 0x…"
            spellCheck={false}
          />
          <div className="hrpc-mint-windows" role="tablist" aria-label="Mint window">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                className={`hrpc-mint-win${win === w ? " is-on" : ""}`}
                onClick={() => setWin(w)}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hrpc-mint-cols">
        <MintCol
          title="Trending"
          empty={loading ? "Loading trending…" : note || "No trending mints."}
          rows={filterRows(trending)}
          selected={selected?.contract}
          onSelect={selectRow}
          kind="trending"
        />
        <MintCol
          title="New Mints"
          empty={loading ? "Loading new mints…" : note || "No new mints."}
          rows={filterRows(mints)}
          selected={selected?.contract}
          onSelect={selectRow}
          kind="mints"
        />
        <MintCol
          title="Market"
          empty={loading ? "Loading market…" : note || "No market movers."}
          rows={filterRows(market)}
          selected={selected?.contract}
          onSelect={selectRow}
          kind="market"
        />
      </div>

      <div className="hrpc-mint-box">
        {selected ? (
          <>
            <div className="hrpc-mint-pick">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={detail?.image || selected.image}
                alt=""
                className="hrpc-mint-pick-img"
              />
              <div className="hrpc-mint-pick-meta">
                <strong>{detail?.name || selected.name}</strong>
                <span>{shortAddr(selected.contract)}</span>
                <span>
                  {supplyLine(
                    detail?.minted ?? selected.minted,
                    detail?.max ?? selected.max,
                  )}
                  {maxPerWallet ? ` · max ${maxPerWallet}/wallet` : ""}
                  {detail?.analysis?.mode ? ` · ${detail.analysis.mode}` : ""}
                </span>
                <span>
                  {paid
                    ? `${unit} ${native} each`
                    : ready
                      ? "FREE mint"
                      : detail?.error ||
                        detail?.analysis?.reason ||
                        "Checking mint route…"}
                </span>
              </div>
              {detail?.openseaUrl ? (
                <a
                  className="hrpc-btn hrpc-btn-ghost"
                  href={detail.openseaUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenSea
                </a>
              ) : null}
            </div>

            <div className="hrpc-mint-actions">
              <div className="hrpc-mint-qty-row">
                {QTY_SET.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`hrpc-mint-chip${qty === n ? " is-on" : ""}`}
                    disabled={minting != null}
                    onClick={() => setQty(n)}
                  >
                    {n}
                  </button>
                ))}
                <input
                  className="hrpc-mint-qty"
                  type="number"
                  min={1}
                  max={100}
                  value={qty}
                  disabled={minting != null}
                  onChange={(e) => {
                    const n = Math.floor(Number(e.target.value));
                    if (!Number.isFinite(n)) return;
                    setQty(Math.max(1, Math.min(100, n)));
                  }}
                />
                <button
                  type="button"
                  className="hrpc-btn"
                  disabled={minting != null}
                  onClick={() => void mintQuantity(qty)}
                >
                  {mintLabel}
                </button>
              </div>

              <div className="hrpc-mint-bulk">
                {QTY_MINT.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="hrpc-btn hrpc-mint-bulk-btn"
                    disabled={minting != null || Boolean(detail && !ready)}
                    onClick={() => void mintQuantity(n)}
                  >
                    {minting === n ? "Minting…" : `Mint ${n}`}
                  </button>
                ))}
              </div>

              {paid ? (
                <label className="hrpc-mint-paid">
                  <input
                    type="checkbox"
                    className="paid-toggle"
                    checked={allowPaid}
                    onChange={(e) => setAllowPaid(e.target.checked)}
                  />
                  Paid mint · {unit} {native} each — confirm before 30/50/100
                </label>
              ) : (
                <p className="hrpc-mint-hint">
                  {signer
                    ? `30 / 50 / 100 signs with squad #${signer.id} ${shortAddr(signer.address)}. Fund that wallet, then send NFTs to master.`
                    : "Generate or paste squad keys first — 30 / 50 / 100 signs with wallet #1."}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="hrpc-nft-empty">
            Click a collection above, then mint 30, 50 or 100 in one click.
          </p>
        )}
      </div>
    </section>
  );
}

function MintCol({
  title,
  empty,
  rows,
  selected,
  onSelect,
  kind,
}: {
  title: string;
  empty: string;
  rows: MintFeedRow[];
  selected?: string;
  onSelect: (row: MintFeedRow) => void;
  kind: "trending" | "mints" | "market";
}) {
  return (
    <aside className="hrpc-panel hrpc-nft-col hrpc-mint-col">
      <div className="hrpc-nft-col-head">
        <h3 className="hrpc-section-title hrpc-section-title-sm">{title}</h3>
        <span className="hrpc-nft-chip">{rows.length}</span>
      </div>
      <div className="hrpc-table-wrap hrpc-nft-scroll">
        {rows.length === 0 ? (
          <p className="hrpc-nft-empty">{empty}</p>
        ) : (
          <ul className="hrpc-mint-list">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`hrpc-mint-row${selected === row.contract ? " is-on" : ""}`}
                  onClick={() => onSelect(row)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.image} alt="" className="hrpc-mint-row-img" />
                  <span className="hrpc-mint-row-name">{row.name}</span>
                  <span className="hrpc-mint-row-stat">
                    {kind === "mints"
                      ? `${row.qty || "1"} · ${row.price || "FREE"} · ${row.ago}`
                      : kind === "market"
                        ? `${row.mintCount || "—"} · ${row.volume || "—"}`
                        : `${row.mintCount || "—"} · ${row.minters || "—"} minters`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
