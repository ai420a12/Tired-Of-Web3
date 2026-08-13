"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type HoodNftSale } from "./mock-data";
import HoodRarityLegend from "./HoodRarityLegend";
import { rarityTierFromRank } from "./hood-rarity";
import { LIVE_ETH_LISTING_BUY } from "@/lib/hood-rpc-demo";
import { buyErrorLine, buyEthListingSilent } from "@/lib/eth-listing-buy";
import type { Hex } from "viem";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";
import HoodMintBoard from "./HoodMintBoard";
import type { SquadMintWallet } from "@/lib/seadrop-mint";

type SnipeWallet = {
  pk: Hex;
  id: number;
  address: string;
};

type Props = {
  onToast: (msg: string) => void;
  apiBase?: string;
  connectedWallet?: string | null;
  liveListingBuys?: boolean;
  variant?: HoodRpcVariant;
  getSnipeWallet?: () => SnipeWallet | null;
  getSquadWallets?: () => SquadMintWallet[];
  onOutcome?: (text: string, kind?: "ok" | "err" | "info") => void;
};

const LIVE_LIMIT = 28;
/** OpenSea global /events is tightly rate-limited — don't hammer it every 2s */
const LIVE_POLL_MS = 6000;

function formatAgo(tsSec?: number): string {
  if (!tsSec) return "just now";
  const s = Math.max(0, Math.floor(Date.now() / 1000) - tsSec);
  if (s < 2) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Keep newest sales across polls — never let a laggy response overwrite fresher rows */
function keepRarity(from: HoodNftSale, onto: HoodNftSale): HoodNftSale {
  if (onto.rarityUnavailable && !from.rarityUnavailable) {
    return {
      ...onto,
      rarityRank: from.rarityRank,
      rarityUnavailable: false,
    };
  }
  return onto;
}

function mergeLiveSales(
  prev: HoodNftSale[],
  incoming: HoodNftSale[],
): HoodNftSale[] {
  const map = new Map<string, HoodNftSale>();
  for (const row of [...prev, ...incoming]) {
    const existing = map.get(row.id);
    if (!existing) {
      map.set(row.id, row);
      continue;
    }
    const newer =
      (row.eventTs || 0) >= (existing.eventTs || 0) ? row : existing;
    const older = newer === row ? existing : row;
    map.set(row.id, keepRarity(older, newer));
  }
  return [...map.values()]
    .filter((r) => (r.eventTs || 0) > 0)
    .sort((a, b) => (b.eventTs || 0) - (a.eventTs || 0))
    .slice(0, LIVE_LIMIT);
}

type FlyState = {
  item: HoodNftSale;
  top: number;
  left: number;
};

function PriceCell({ item }: { item: HoodNftSale }) {
  return (
    <div className="hrpc-nft-price">
      <span className={item.kind === "weth" ? "hrpc-price-weth" : "hrpc-price-eth"}>
        {item.eth.toFixed(3)} {item.kind === "weth" ? "WETH" : "ETH"}
      </span>
      <span className="hrpc-price-usd">${item.usd.toFixed(2)}</span>
    </div>
  );
}

const NFT_IMAGE_FALLBACK = "/images/hood-rpc/mascot-lime.png";

function NftThumb({
  src,
  alt = "",
  className = "hrpc-nft-thumb",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={src || NFT_IMAGE_FALLBACK}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const el = e.currentTarget;
        if (el.dataset.fallback === "1") return;
        el.dataset.fallback = "1";
        el.src = NFT_IMAGE_FALLBACK;
      }}
    />
  );
}

function collectionUrl(item: HoodNftSale) {
  return `https://opensea.io/collection/${item.collectionSlug}`;
}

function NftFlyout({
  fly,
  visible,
  flyRef,
  onEnter,
  onLeave,
}: {
  fly: FlyState | null;
  visible: boolean;
  flyRef: React.RefObject<HTMLDivElement | null>;
  onEnter: () => void;
  onLeave: () => void;
}) {
  if (!fly) return null;
  const { item, top, left } = fly;
  const tier = rarityTierFromRank(
    item.rarityUnavailable ? null : item.rarityRank,
  );
  const hasRank = !item.rarityUnavailable && item.rarityRank >= 1;

  return createPortal(
    <div
      ref={flyRef}
      className={`hrpc-os-flyout${visible ? " hrpc-os-flyout-visible" : ""}${item.kind === "weth" ? " hrpc-os-fly-weth" : " hrpc-os-fly-eth"}`}
      style={{ top, left }}
      aria-hidden={!visible}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="hrpc-os-flyout-inner">
        <div className="hrpc-os-flyout-imgwrap" data-fly-rarity={tier}>
          <NftThumb src={item.image} alt={item.tokenName} className="" />
        </div>
        <div className="hrpc-os-flyout-details">
          <div className="hrpc-os-flyout-title">{item.tokenName}</div>
          <div className="hrpc-os-flyout-collection">{item.collection}</div>
          <div
            className={`hrpc-os-flyout-rank-wrap${hasRank ? "" : " hrpc-os-flyout-rank-wrap--pending"}`}
            data-fly-rarity={hasRank ? tier : undefined}
          >
            <div className="hrpc-os-flyout-rank-label">
              {hasRank
                ? "OpenSea rank"
                : item.rarityUnavailable
                  ? "No rank from OpenSea for this item"
                  : "Rank not loaded yet — hover again after a moment"}
            </div>
            {hasRank ? (
              <div
                className="hrpc-os-flyout-rank-big"
                title="Exact numeric rank from OpenSea (1 = rarest)."
              >
                #{item.rarityRank}
              </div>
            ) : null}
          </div>
          <div className="hrpc-os-flyout-price">
            {item.eth.toFixed(3)} {item.kind === "weth" ? "WETH" : "ETH"}
          </div>
          <div className="hrpc-os-flyout-usd">${item.usd.toFixed(2)}</div>
          <div className="hrpc-os-flyout-time">{item.ago}</div>
          <a
            className="hrpc-os-btn"
            href={collectionUrl(item)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hood-rpc/opensea.svg"
              alt=""
              width={18}
              height={18}
            />
            OpenSea
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SaleTable({
  rows,
  focusSlug,
  showCollection,
  showSnipe,
  snipeLabel = "Snipe",
  snipingId,
  onSelect,
  onThumbOver,
  onThumbOut,
  onSnipe,
}: {
  rows: HoodNftSale[];
  focusSlug?: string | null;
  showCollection?: boolean;
  showSnipe?: boolean;
  snipeLabel?: string;
  snipingId?: string | null;
  onSelect?: (item: HoodNftSale) => void;
  onThumbOver: (item: HoodNftSale, el: HTMLElement) => void;
  onThumbOut: (e: React.MouseEvent) => void;
  onSnipe?: (item: HoodNftSale) => void;
}) {
  const layout = showSnipe
    ? showCollection
      ? "live-snipe"
      : "snipe"
    : showCollection
      ? "live"
      : "project";
  return (
    <div className={`hrpc-nft-list hrpc-nft-list--${layout}`}>
      <div className="hrpc-nft-list-head">
        <span className="hrpc-nft-rank-spacer" aria-hidden />
        <span />
        <span>NFT</span>
        {showCollection ? <span>Collection</span> : null}
        <span>Price</span>
        <span>Time</span>
        {showSnipe ? <span className="hrpc-os-snipe-th">Snipe</span> : null}
      </div>
      <div
        onMouseOver={(e) => {
          const thumb = (e.target as HTMLElement).closest(".hrpc-os-thumb");
          if (!thumb) return;
          const rowEl = thumb.closest(".hrpc-nft-list-row");
          if (!rowEl) return;
          const id = rowEl.getAttribute("data-sale-id");
          const item = rows.find((r) => r.id === id);
          if (item) onThumbOver(item, thumb as HTMLElement);
        }}
        onMouseOut={onThumbOut}
      >
        {rows.map((row) => {
          const tier = rarityTierFromRank(
            row.rarityUnavailable ? null : row.rarityRank,
          );
          return (
            <div
              key={row.id}
              data-sale-id={row.id}
              data-rarity={tier}
              className={`hrpc-nft-list-row hrpc-nft-row hrpc-os-row${focusSlug && focusSlug === row.collectionSlug ? " hrpc-nft-row-active" : ""}`}
              onClick={() => onSelect?.(row)}
            >
              <span className="hrpc-nft-rank-bar" aria-hidden />
              <div className="hrpc-os-thumb">
                <span className="hrpc-nft-ring" data-rarity={tier} aria-hidden>
                  <NftThumb src={row.image} />
                </span>
              </div>
              <div className="hrpc-nft-name">
                <span>{row.tokenName}</span>
                {!row.rarityUnavailable && row.rarityRank >= 1 ? (
                  <span className="hrpc-nft-rank hrpc-mono">R#{row.rarityRank}</span>
                ) : null}
              </div>
              {showCollection ? (
                <div className="hrpc-name">{row.collection}</div>
              ) : null}
              <PriceCell item={row} />
              <div className="hrpc-mono hrpc-ago">{row.ago}</div>
              {showSnipe ? (
                <div>
                  <button
                    type="button"
                    className="hrpc-btn"
                    disabled={snipingId === row.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSnipe?.(row);
                    }}
                  >
                    {snipingId === row.id ? "Buying…" : snipeLabel}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function revealNftLog() {
  window.setTimeout(() => {
    document.getElementById("mint-outcomes")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, 40);
}

export default function HoodNftPanels({
  onToast,
  apiBase = "/api/hood-rpc",
  connectedWallet = null,
  liveListingBuys = false,
  variant = "hood",
  getSnipeWallet,
  getSquadWallets,
  onOutcome,
}: Props) {
  const [live, setLive] = useState<HoodNftSale[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [focus, setFocus] = useState<HoodNftSale | null>(null);
  const [sales, setSales] = useState<HoodNftSale[]>([]);
  const [listings, setListings] = useState<HoodNftSale[]>([]);
  const [fly, setFly] = useState<FlyState | null>(null);
  const [flyVisible, setFlyVisible] = useState(false);
  const [snipingId, setSnipingId] = useState<string | null>(null);
  const flyRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | null>(null);
  const liveSourceRef = useRef<string | null>(null);
  const hadOpenSeaRef = useRef(false);

  const ethLiveBuys = liveListingBuys && LIVE_ETH_LISTING_BUY;

  const cancelHide = useCallback(() => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const hideFlyout = useCallback(() => {
    cancelHide();
    setFlyVisible(false);
  }, [cancelHide]);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = window.setTimeout(hideFlyout, 160);
  }, [cancelHide, hideFlyout]);

  const showFlyout = useCallback(
    (item: HoodNftSale, el: HTMLElement) => {
      cancelHide();
      const rect = el.getBoundingClientRect();
      const width = 520;
      const height = 280;
      let left = rect.right + 12;
      let top = rect.top - 20;
      if (left + width > window.innerWidth - 12) {
        left = rect.left - width - 12;
      }
      if (left < 12) left = 12;
      if (top + height > window.innerHeight - 12) {
        top = Math.max(12, window.innerHeight - height - 12);
      }
      if (top < 12) top = 12;
      setFly({ item, top, left });
      setFlyVisible(true);
    },
    [cancelHide],
  );

  const handleThumbOut = useCallback(
    (e: React.MouseEvent) => {
      const thumb = (e.target as HTMLElement).closest(".hrpc-os-thumb");
      if (!thumb) return;
      const related = e.relatedTarget as Node | null;
      if (
        related &&
        (thumb.contains(related) || flyRef.current?.contains(related))
      ) {
        return;
      }
      scheduleHide();
    },
    [scheduleHide],
  );

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function loadLive() {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(`${apiBase}/nfts?limit=${LIVE_LIMIT}&t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;

        const source = typeof data.source === "string" ? data.source : "";
        // Real marketplace sales only — never Blockscout transfers / mock seed
        const liveOk = ["opensea", "alchemy", "cache"].includes(source);

        if (!liveOk) {
          liveSourceRef.current = source || null;
          if (!hadOpenSeaRef.current) {
            setLiveNote(
              typeof data.note === "string"
                ? data.note
                : typeof data.error === "string"
                  ? data.error
                  : "Waiting for live OpenSea sales…",
            );
            setLive([]);
          } else {
            setLiveNote("Live feed reconnecting…");
          }
          setLiveLoading(false);
          return;
        }

        liveSourceRef.current = source;
        const incoming = Array.isArray(data.sales)
          ? (data.sales as HoodNftSale[]).filter(
              (row) =>
                typeof row.eth === "number" &&
                row.eth > 0 &&
                typeof row.eventTs === "number" &&
                row.eventTs > 0,
            )
          : [];
        if (incoming.length) {
          setLiveNote(null);
          setLive((prev) =>
            mergeLiveSales(hadOpenSeaRef.current ? prev : [], incoming),
          );
          hadOpenSeaRef.current = true;
        } else if (!hadOpenSeaRef.current) {
          setLive([]);
          setLiveNote("Waiting for live OpenSea sales…");
        }
        setLiveLoading(false);
      } catch {
        if (!cancelled) setLiveLoading(false);
      } finally {
        inFlight = false;
      }
    }

    void loadLive();
    const poll = window.setInterval(() => void loadLive(), LIVE_POLL_MS);
    const tick = window.setInterval(() => {
      setLive((prev) =>
        prev.map((row) => ({ ...row, ago: formatAgo(row.eventTs) })),
      );
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [apiBase]);

  useEffect(() => {
    if (!focus) return;
    let cancelled = false;

    async function loadProject() {
      try {
        const params = new URLSearchParams({
          slug: focus!.collectionSlug,
          limit: "20",
          name: focus!.collection,
        });
        const res = await fetch(`${apiBase}/nfts?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        // Only use project-scoped payloads for THIS collection
        const slug = focus!.collectionSlug;
        if (Array.isArray(data.projectSales)) {
          const next = (data.projectSales as HoodNftSale[])
            .filter((r) => r.collectionSlug === slug)
            .sort((a, b) => (b.eventTs || 0) - (a.eventTs || 0));
          setSales(next);
        }
        if (Array.isArray(data.listings)) {
          const next = (data.listings as HoodNftSale[])
            .filter((r) => r.collectionSlug === slug)
            .sort((a, b) => (b.eventTs || 0) - (a.eventTs || 0));
          setListings(next);
        }
      } catch {
        /* ignore */
      }
    }

    void loadProject();
    const id = window.setInterval(() => void loadProject(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [focus, apiBase]);

  function selectSale(item: HoodNftSale) {
    hideFlyout();
    setFocus(item);
    setSales([]);
    setListings([]);
    onToast(`> PROJECT · ${item.collection}`);
  }

  function logSnipe(text: string, kind: "ok" | "err" | "info" = "info") {
    onOutcome?.(text, kind);
    revealNftLog();
  }

  async function handleListingSnipe(row: HoodNftSale) {
    if (!ethLiveBuys) {
      logSnipe(
        "Listing snipe is ETH_RPC only — switch to ETH_RPC and retry",
        "err",
      );
      return;
    }
    const sniper = getSnipeWallet?.() || null;
    if (!sniper) {
      logSnipe("Snipe failed · generate or load wallets first", "err");
      return;
    }

    setSnipingId(row.id);
    logSnipe(
      `Sniping ${row.tokenName} · wallet ${sniper.id} ${shortAddr(sniper.address)} · ${row.eth} ${row.kind === "weth" ? "WETH" : "ETH"}`,
      "info",
    );
    try {
      let orderHash = row.orderHash;
      let protocolAddress =
        row.protocolAddress ||
        "0x0000000000000068f116a894984e2db1123eb395";
      let priceEth = row.eth;

      if (!orderHash) {
        if (!row.tokenId || (!row.contract && !row.collectionSlug)) {
          logSnipe(`Snipe failed · ${row.tokenName} · missing listing data`, "err");
          return;
        }
        const q = new URLSearchParams({ tokenId: row.tokenId });
        if (row.contract) q.set("contract", row.contract);
        if (row.collectionSlug) q.set("slug", row.collectionSlug);
        const look = await fetch(`${apiBase}/best-listing?${q.toString()}`, {
          cache: "no-store",
        });
        const found = (await look.json()) as {
          ok?: boolean;
          orderHash?: string;
          protocolAddress?: string;
          eth?: number;
        };
        if (!look.ok || !found.ok || !found.orderHash) {
          logSnipe(
            `Snipe failed · ${row.tokenName} · no live listing found`,
            "err",
          );
          return;
        }
        orderHash = found.orderHash;
        protocolAddress = found.protocolAddress || protocolAddress;
        if (typeof found.eth === "number" && found.eth > 0) {
          priceEth = found.eth;
        }
      }

      const result = await buyEthListingSilent({
        orderHash,
        protocolAddress,
        sessionPrivateKey: sniper.pk,
        priceEth,
        tokenName: row.tokenName,
        apiBase,
        gasMode: "hyper",
        contract: row.contract,
        tokenId: row.tokenId,
      });
      const txHash = result.txHashes[0];
      logSnipe(
        `Bought ${row.tokenName} · wallet ${sniper.id} · ${txHash.slice(0, 10)}… · etherscan.io/tx/${txHash}`,
        "ok",
      );
      if (txHash && row.contract && row.tokenId) {
        try {
          await fetch(`${apiBase}/pnl/record`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              txHash,
              contract: row.contract,
              tokenId: row.tokenId,
              costEth: priceEth,
              collectionSlug: row.collectionSlug,
              tokenName: row.tokenName,
            }),
          });
        } catch {
          /* non-blocking */
        }
      }
    } catch (err) {
      logSnipe(`Snipe failed · ${row.tokenName} · ${buyErrorLine(err)}`, "err");
    } finally {
      setSnipingId(null);
    }
  }

  return (
    <>
    <section
      className="hrpc-nft-boards"
      aria-label="Robinhood NFT tracker"
      id="nft-live"
    >
      <aside className="hrpc-panel hrpc-nft-col">
        <div className="hrpc-nft-col-head hrpc-nft-col-head-legend">
          <h2 className="hrpc-section-title hrpc-section-title-sm">NFT Live</h2>
          <HoodRarityLegend />
        </div>
        <div className="hrpc-table-wrap hrpc-nft-scroll">
          {liveLoading && live.length === 0 ? (
            <p className="hrpc-nft-empty">Loading live OpenSea sales…</p>
          ) : liveNote && live.length === 0 ? (
            <p className="hrpc-nft-empty">{liveNote}</p>
          ) : live.length === 0 ? (
            <p className="hrpc-nft-empty">No recent sales on this chain right now.</p>
          ) : (
            <SaleTable
              rows={live}
              focusSlug={focus?.collectionSlug}
              showCollection
              onSelect={selectSale}
              onThumbOver={showFlyout}
              onThumbOut={handleThumbOut}
            />
          )}
        </div>
      </aside>

      <div className="hrpc-nft-dual">
        <aside className="hrpc-panel hrpc-nft-col">
          <div className="hrpc-nft-col-head">
            <h2 className="hrpc-section-title hrpc-section-title-sm">
              Project Sales
            </h2>
            {focus ? (
              <span className="hrpc-nft-chip">{focus.collection}</span>
            ) : null}
          </div>
          {!focus ? (
            <p className="hrpc-nft-empty">
              Click an NFT on the left to load Project Sales for that collection.
            </p>
          ) : sales.length === 0 ? (
            <p className="hrpc-nft-empty">Loading sales for {focus.collection}…</p>
          ) : (
            <div className="hrpc-table-wrap hrpc-nft-scroll">
              <SaleTable
                rows={sales}
                onThumbOver={showFlyout}
                onThumbOut={handleThumbOut}
              />
            </div>
          )}
        </aside>

        <aside className="hrpc-panel hrpc-nft-col">
          <div className="hrpc-nft-col-head">
            <h2 className="hrpc-section-title hrpc-section-title-sm">
              Project Listings
            </h2>
            {focus ? (
              <span className="hrpc-nft-chip">{focus.collection}</span>
            ) : null}
          </div>
          {!focus ? (
            <p className="hrpc-nft-empty">
              Click an NFT on the left to load Project Listings for that
              collection.
            </p>
          ) : listings.length === 0 ? (
            <p className="hrpc-nft-empty">
              Loading listings for {focus.collection}…
            </p>
          ) : (
            <div className="hrpc-table-wrap hrpc-nft-scroll">
              <SaleTable
                rows={listings}
                showSnipe
                snipingId={snipingId}
                onThumbOver={showFlyout}
                onThumbOut={handleThumbOut}
                onSnipe={(row) => {
                  void handleListingSnipe(row);
                }}
              />
            </div>
          )}
        </aside>
      </div>

      <NftFlyout
        fly={fly}
        visible={flyVisible}
        flyRef={flyRef}
        onEnter={cancelHide}
        onLeave={scheduleHide}
      />
    </section>
    <HoodMintBoard
      apiBase={apiBase}
      variant={variant}
      getSquadWallets={getSquadWallets}
      onToast={onToast}
      onOutcome={onOutcome}
    />
    </>
  );
}
