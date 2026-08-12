"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type HoodNftSale } from "./mock-data";
import HoodRarityLegend from "./HoodRarityLegend";
import { rarityTierFromRank } from "./hood-rarity";
import { DEMO_TOAST, HOOD_RPC_DEMO } from "@/lib/hood-rpc-demo";

type Props = {
  onToast: (msg: string) => void;
  apiBase?: string;
};

const LIVE_LIMIT = 28;
const LIVE_POLL_MS = 2000;

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
  onSelect,
  onThumbOver,
  onThumbOut,
  onSnipe,
}: {
  rows: HoodNftSale[];
  focusSlug?: string | null;
  showCollection?: boolean;
  showSnipe?: boolean;
  onSelect?: (item: HoodNftSale) => void;
  onThumbOver: (item: HoodNftSale, el: HTMLElement) => void;
  onThumbOut: (e: React.MouseEvent) => void;
  onSnipe?: (item: HoodNftSale) => void;
}) {
  const layout = showSnipe ? "snipe" : showCollection ? "live" : "project";
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onSnipe?.(row);
                    }}
                  >
                    Snipe
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

export default function HoodNftPanels({
  onToast,
  apiBase = "/api/hood-rpc",
}: Props) {
  const [live, setLive] = useState<HoodNftSale[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [focus, setFocus] = useState<HoodNftSale | null>(null);
  const [sales, setSales] = useState<HoodNftSale[]>([]);
  const [listings, setListings] = useState<HoodNftSale[]>([]);
  const [fly, setFly] = useState<FlyState | null>(null);
  const [flyVisible, setFlyVisible] = useState(false);
  const flyRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | null>(null);
  const liveSourceRef = useRef<string | null>(null);
  const hadOpenSeaRef = useRef(false);

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
        if (source !== "opensea") {
          liveSourceRef.current = source || null;
          hadOpenSeaRef.current = false;
          setLiveNote(
            typeof data.note === "string"
              ? data.note
              : typeof data.error === "string"
                ? data.error
                : "Live feed unavailable — OpenSea API not connected.",
          );
          setLive([]);
          setLiveLoading(false);
          return;
        }

        liveSourceRef.current = "opensea";
        setLiveNote(null);
        const incoming = Array.isArray(data.sales)
          ? (data.sales as HoodNftSale[])
          : [];
        if (incoming.length) {
          setLive((prev) =>
            mergeLiveSales(hadOpenSeaRef.current ? prev : [], incoming),
          );
          hadOpenSeaRef.current = true;
        } else if (!hadOpenSeaRef.current) {
          setLive([]);
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
    const id = window.setInterval(() => void loadProject(), 4_000);
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

  return (
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
                onThumbOver={showFlyout}
                onThumbOut={handleThumbOut}
                onSnipe={(row) => {
                  onToast(
                    HOOD_RPC_DEMO
                      ? DEMO_TOAST
                      : `> SNIPE LISTING · ${row.tokenName}`,
                  );
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
  );
}
