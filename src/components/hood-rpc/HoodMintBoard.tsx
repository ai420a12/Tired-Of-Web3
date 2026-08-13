"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";
import type { MintFeedChain, MintFeedRow } from "@/lib/mint-feed";
import {
  estimateMintCostEth,
  quoteMintFees,
  sendMintWithMetaMask,
  walletErrorText,
} from "@/lib/metamask-mint";

type Props = {
  apiBase: string;
  variant: HoodRpcVariant;
  connectedWallet?: string | null;
  onToast: (msg: string) => void;
  onOutcome?: (text: string, kind?: "ok" | "err" | "info") => void;
};

type RadarPayload = {
  ok?: boolean;
  error?: string;
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
  openseaUrl?: string;
  minted?: number;
  max?: number;
  analysis?: {
    ready?: boolean;
    reason?: string;
    mode?: string;
    maxPerWallet?: number;
    unitPriceWei?: string;
    unitPriceEth?: number;
    nativeSymbol?: string;
    requiresHelper?: boolean;
    serviceFeePerMintWei?: string;
  };
};

type PreparedMint = {
  to: string;
  data: string;
  value?: string;
  gas?: string;
  from?: string;
  serviceFeeTotalEth?: number;
};

const WINDOWS = ["1m", "5m", "15m", "1h", "1d"] as const;
const VIEWS = [
  { id: "all", label: "ALL" },
  { id: "robinhood", label: "RH" },
  { id: "ethereum", label: "ETH" },
] as const;
const QTY_CHIPS = [1, 5, 10, 30, 50, 100] as const;
const POLL_MS = 8000;

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function rowKey(row: MintFeedRow) {
  return `${row.chain}:${row.contract}`;
}

function openSeaHref(row: MintFeedRow, detail: DetailPayload | null) {
  if (detail?.openseaUrl) return detail.openseaUrl;
  if (row.slug) return `https://opensea.io/collection/${row.slug}`;
  const chain = row.chain === "ethereum" ? "ethereum" : "robinhood";
  return `https://opensea.io/assets/${chain}/${row.contract}`;
}

function explorerHref(row: MintFeedRow) {
  return row.chain === "ethereum"
    ? `https://etherscan.io/token/${row.contract}`
    : `https://robinhoodchain.blockscout.com/token/${row.contract}`;
}

function ProjectLinks({
  row,
  detail,
}: {
  row: MintFeedRow;
  detail: DetailPayload | null;
}) {
  const explorer =
    row.chain === "ethereum"
      ? { href: explorerHref(row), label: "Etherscan", icon: "/images/hood-rpc/blockscout.svg" }
      : { href: explorerHref(row), label: "Blockscout", icon: "/images/hood-rpc/blockscout.svg" };
  return (
    <span className="hrpc-mint-ext">
      <a
        href={openSeaHref(row, detail)}
        target="_blank"
        rel="noopener noreferrer"
        title="OpenSea"
        aria-label="OpenSea"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hood-rpc/opensea.svg" alt="" width={20} height={20} />
      </a>
      <a
        href={explorer.href}
        target="_blank"
        rel="noopener noreferrer"
        title={explorer.label}
        aria-label={explorer.label}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={explorer.icon} alt="" width={20} height={20} />
      </a>
    </span>
  );
}

function ChainBadge({ chain }: { chain: MintFeedChain }) {
  return (
    <span className={`hrpc-mint-net hrpc-mint-net-${chain === "ethereum" ? "eth" : "rh"}`}>
      {chain === "ethereum" ? "ETH" : "RH"}
    </span>
  );
}

export default function HoodMintBoard({
  apiBase,
  variant,
  connectedWallet = null,
  onToast,
  onOutcome,
}: Props) {
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>(
    variant === "eth" ? "ethereum" : "all",
  );
  const [win, setWin] = useState<(typeof WINDOWS)[number]>("1m");
  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<MintFeedRow[]>([]);
  const [mints, setMints] = useState<MintFeedRow[]>([]);
  const [market, setMarket] = useState<MintFeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<MintFeedRow | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [qty, setQty] = useState(30);
  const [allowPaid, setAllowPaid] = useState(false);
  const [minting, setMinting] = useState(false);
  const [prepared, setPrepared] = useState<PreparedMint | null>(null);
  const [feeEth, setFeeEth] = useState<number | null>(null);

  const loadRadar = useCallback(async () => {
    try {
      const res = await fetch(
        `${apiBase}/mint-radar?window=${win}&view=${view}`,
        { cache: "no-store" },
      );
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
  }, [apiBase, win, view]);

  useEffect(() => {
    setLoading(true);
    void loadRadar();
    const id = window.setInterval(() => void loadRadar(), POLL_MS);
    return () => window.clearInterval(id);
  }, [loadRadar]);

  const loadDetail = useCallback(
    async (row: MintFeedRow) => {
      try {
        const res = await fetch(
          `${apiBase}/mint-detail?contract=${row.contract}&chain=${row.chain}`,
          { cache: "no-store" },
        );
        setDetail((await res.json()) as DetailPayload);
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
      setPrepared(null);
      setAllowPaid(false);
      void loadDetail(row);
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
  const native = detail?.analysis?.nativeSymbol || "ETH";
  const proxy = Boolean(detail?.analysis?.requiresHelper || selected?.proxy);

  useEffect(() => {
    if (!selected || !connectedWallet || !ready) {
      setPrepared(null);
      setFeeEth(null);
      return;
    }
    if (paid && !allowPaid) {
      setPrepared(null);
      setFeeEth(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`${apiBase}/mint-tx`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contract: selected.contract,
            quantity: qty,
            from: connectedWallet,
            allowPaid: paid && allowPaid,
            chain: selected.chain,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          tx?: PreparedMint;
        };
        if (!cancelled && data.ok && data.tx?.to && data.tx?.data) {
          setPrepared(data.tx);
          try {
            const fees = await quoteMintFees(selected.chain);
            if (!cancelled) {
              setFeeEth(
                estimateMintCostEth({
                  valueHex: data.tx.value,
                  gasHex: data.tx.gas,
                  maxFeePerGasHex: fees.maxFeePerGas,
                }),
              );
            }
          } catch {
            if (!cancelled) setFeeEth(data.tx.serviceFeeTotalEth ?? null);
          }
        } else if (!cancelled) {
          setPrepared(null);
          setFeeEth(null);
        }
      } catch {
        if (!cancelled) {
          setPrepared(null);
          setFeeEth(null);
        }
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiBase, selected, connectedWallet, qty, ready, paid, allowPaid]);

  const mintLabel = useMemo(() => {
    if (!selected) return "Pick a mint";
    if (!connectedWallet) return "Connect wallet";
    if (detail && !ready) return detail.analysis?.reason || "No mint route";
    if (paid && !allowPaid) return "Confirm paid";
    if (minting) return "Confirm in wallet…";
    return `Mint ${qty}`;
  }, [selected, connectedWallet, detail, ready, paid, allowPaid, minting, qty]);

  async function mintNow(quantity: number) {
    if (!selected) {
      onToast("> CLICK A LIVE MINT FIRST");
      return;
    }
    if (!connectedWallet) {
      onToast("> CONNECT METAMASK FIRST");
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
    setMinting(true);
    const name = detail?.name || selected.name;
    onOutcome?.(
      `Proxy mint ${quantity} · ${name} · ${shortAddr(connectedWallet)}`,
      "info",
    );
    try {
      let tx = prepared;
      if (!tx || quantity !== qty) {
        const res = await fetch(`${apiBase}/mint-tx`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contract: selected.contract,
            quantity,
            from: connectedWallet,
            allowPaid: paid && allowPaid,
            chain: selected.chain,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          tx?: PreparedMint;
        };
        if (!res.ok || !data.ok || !data.tx?.to || !data.tx?.data) {
          throw new Error(data.error || "MINT_ROUTE_FAILED");
        }
        tx = data.tx;
      }
      const hash = await sendMintWithMetaMask({
        chain: selected.chain,
        from: connectedWallet,
        to: tx.to,
        data: tx.data,
        value: tx.value,
        gas: tx.gas,
      });
      onOutcome?.(
        `Minted ${quantity} · ${name} · ${hash.slice(0, 10)}… · landing in ${shortAddr(connectedWallet)}`,
        "ok",
      );
      onToast(`> MINTED ${quantity} · CHECK YOUR WALLET`);
    } catch (err) {
      const msg = walletErrorText(err);
      onOutcome?.(`Mint failed · ${name} · ${msg}`, "err");
      onToast(`> MINT FAILED · ${msg}`);
    } finally {
      setMinting(false);
    }
  }

  const selectedKey = selected ? rowKey(selected) : "";

  return (
    <section className="hrpc-mint-board" aria-label="Live mint board" id="mint-now">
      <div className="hrpc-mint-board-head">
        <div>
          <h2 className="hrpc-section-title">Live Mint</h2>
          <p className="hrpc-mint-sub">
            Connect one wallet · pick qty · MetaMask pops · NFTs land in that wallet
          </p>
        </div>
        <div className="hrpc-mint-tools">
          <div className="hrpc-mint-windows" role="tablist" aria-label="Chain">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`hrpc-mint-win${view === v.id ? " is-on" : ""}`}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="hrpc-mint-windows" role="tablist" aria-label="Window">
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
          <input
            className="hrpc-mint-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="hrpc-mint-cols">
        <MintCol
          title="Trending"
          empty={loading ? "Loading trending…" : note || "No trending mints."}
          rows={filterRows(trending)}
          selectedKey={selectedKey}
          onSelect={selectRow}
          kind="trending"
        />
        <MintCol
          title="New Mints"
          empty={loading ? "Loading new mints…" : note || "No new mints."}
          rows={filterRows(mints)}
          selectedKey={selectedKey}
          onSelect={selectRow}
          kind="mints"
        />
        <MarketCol
          empty={loading ? "Loading market…" : note || "No market movers."}
          rows={filterRows(market)}
          selectedKey={selectedKey}
          onSelect={selectRow}
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
                <strong>
                  {detail?.name || selected.name}
                  <ProjectLinks row={selected} detail={detail} />
                  <ChainBadge chain={selected.chain} />
                  {proxy ? <span className="hrpc-mint-tag hrpc-mint-tag-proxy">Proxy Mint</span> : null}
                </strong>
                <span>{shortAddr(selected.contract)}</span>
                <span>
                  {detail?.minted && detail?.max
                    ? `${detail.minted}/${detail.max}`
                    : "—"}
                  {detail?.analysis?.mode ? ` · ${detail.analysis.mode}` : ""}
                  {paid ? ` · ${unit} ${native}` : " · Free"}
                </span>
                <span>
                  {connectedWallet
                    ? `Mints to ${shortAddr(connectedWallet)}`
                    : "Connect MetaMask to mint"}
                  {feeEth != null
                    ? ` · ~${feeEth < 0.001 ? feeEth.toFixed(5) : feeEth.toFixed(4)} ETH total`
                    : prepared?.serviceFeeTotalEth
                      ? ` · helper ${prepared.serviceFeeTotalEth} ETH + gas`
                      : ""}
                </span>
              </div>
            </div>

            <div className="hrpc-mint-actions">
              <div className="hrpc-mint-qty-row">
                {QTY_CHIPS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`hrpc-mint-chip${qty === n ? " is-on" : ""}${n >= 30 ? " hrpc-mint-chip-bulk" : ""}`}
                    disabled={minting}
                    onClick={() => {
                      setQty(n);
                      if (n >= 30) void mintNow(n);
                    }}
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
                  disabled={minting}
                  onChange={(e) => {
                    const n = Math.floor(Number(e.target.value));
                    if (!Number.isFinite(n)) return;
                    setQty(Math.max(1, Math.min(100, n)));
                  }}
                />
                <button
                  type="button"
                  className="hrpc-btn hrpc-mint-go"
                  disabled={minting}
                  onClick={() => void mintNow(qty)}
                >
                  {mintLabel}
                </button>
              </div>
              {paid ? (
                <label className="hrpc-mint-paid">
                  <input
                    type="checkbox"
                    checked={allowPaid}
                    onChange={(e) => setAllowPaid(e.target.checked)}
                  />
                  Paid mint · {unit} {native} each — tick this, then mint
                </label>
              ) : (
                <p className="hrpc-mint-hint">
                  One MetaMask confirm. Proxy mint sends all {qty} into your
                  connected wallet — no extra squad wallets.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="hrpc-nft-empty">
            Click a collection, hit 30 / 50 / 100, confirm in MetaMask. Done.
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
  selectedKey,
  onSelect,
  kind,
}: {
  title: string;
  empty: string;
  rows: MintFeedRow[];
  selectedKey: string;
  onSelect: (row: MintFeedRow) => void;
  kind: "trending" | "mints";
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
                  className={`hrpc-mint-row${kind === "trending" ? " hrpc-mint-row-trend" : " hrpc-mint-row-live"}${row.hot ? " is-hot" : ""}${selectedKey === rowKey(row) ? " is-on" : ""}`}
                  onClick={() => onSelect(row)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.image} alt="" className="hrpc-mint-row-img" />
                  <span className="hrpc-mint-row-main">
                    <span className="hrpc-mint-row-name">{row.name}</span>
                    {kind === "mints" ? (
                      <span className="hrpc-mint-tags">
                        <ChainBadge chain={row.chain} />
                        {row.proxy ? (
                          <span className="hrpc-mint-tag hrpc-mint-tag-proxy">Proxy Mint</span>
                        ) : null}
                        <span className="hrpc-mint-tag">{row.price}</span>
                        {row.standard ? (
                          <span className="hrpc-mint-tag">{row.standard}</span>
                        ) : null}
                        <span className="hrpc-mint-ago">{row.ago}</span>
                      </span>
                    ) : (
                      <ChainBadge chain={row.chain} />
                    )}
                  </span>
                  <span className="hrpc-mint-row-count">
                    {kind === "mints"
                      ? `+${row.qty || "1"}`
                      : row.mintCount || compactFallback(row.mintCountNum)}
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

function compactFallback(n: number) {
  if (!n) return "—";
  if (n >= 1000) return `+${(n / 1000).toFixed(1)}K`;
  return `+${n}`;
}

function MarketCol({
  empty,
  rows,
  selectedKey,
  onSelect,
}: {
  empty: string;
  rows: MintFeedRow[];
  selectedKey: string;
  onSelect: (row: MintFeedRow) => void;
}) {
  return (
    <aside className="hrpc-panel hrpc-nft-col hrpc-mint-col">
      <div className="hrpc-nft-col-head">
        <h3 className="hrpc-section-title hrpc-section-title-sm">Market</h3>
        <span className="hrpc-nft-chip">{rows.length}</span>
      </div>
      <div className="hrpc-table-wrap hrpc-nft-scroll">
        {rows.length === 0 ? (
          <p className="hrpc-nft-empty">{empty}</p>
        ) : (
          <div className="hrpc-mint-mkt">
            <div className="hrpc-mint-mkt-head">
              <span>Name</span>
              <span>Volume</span>
              <span>Change</span>
              <span>Sales</span>
            </div>
            {rows.map((row, i) => (
              <button
                key={row.id}
                type="button"
                className={`hrpc-mint-mkt-row${selectedKey === rowKey(row) ? " is-on" : ""}`}
                onClick={() => onSelect(row)}
              >
                <span className="hrpc-mint-mkt-name">
                  <span className="hrpc-mint-mkt-rank">#{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.image} alt="" className="hrpc-mint-row-img" />
                  <span>
                    {row.name}
                    <ChainBadge chain={row.chain} />
                  </span>
                </span>
                <span>{row.volume || "—"}</span>
                <span
                  className={
                    row.changeNum > 0
                      ? "hrpc-mint-up"
                      : row.changeNum < 0
                        ? "hrpc-mint-down"
                        : ""
                  }
                >
                  {row.change || "—"}
                </span>
                <span>{row.sales || "—"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
