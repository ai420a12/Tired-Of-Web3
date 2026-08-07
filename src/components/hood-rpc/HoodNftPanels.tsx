"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type HoodNftSale } from "./mock-data";
import HoodRarityLegend from "./HoodRarityLegend";
import { rarityRowClass, rarityTierFromRank } from "./hood-rarity";
import { DEMO_TOAST, HOOD_RPC_DEMO } from "@/lib/hood-rpc-demo";

type Props = {
  onToast: (msg: string) => void;
};

const LIVE_LIMIT = 28;

/** Keep newest sales across polls — never let a laggy response overwrite fresher rows */
function mergeLiveSales(
  prev: HoodNftSale[],
  incoming: HoodNftSale[],
): HoodNftSale[] {
  const map = new Map<string, HoodNftSale>();
  for (const row of [...prev, ...incoming]) {
    const existing = map.get(row.id);
    if (!existing || (row.eventTs || 0) >= (existing.eventTs || 0)) {
      map.set(row.id, row);
    }
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
    <td className="hrpc-nft-price">
      <span className={item.kind === "weth" ? "hrpc-price-weth" : "hrpc-price-eth"}>
        {item.eth.toFixed(3)} {item.kind === "weth" ? "WETH" : "ETH"}
      </span>
      <span className="hrpc-price-usd">${item.usd.toFixed(2)}</span>
    </td>
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt={item.tokenName} decoding="async" />
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
  return (
    <table className="hrpc-table hrpc-nft-table">
      <thead>
        <tr>
          <th style={{ width: 44 }} />
          <th>NFT</th>
          {showCollection ? <th>Collection</th> : null}
          <th>Price</th>
          <th>Time</th>
          {showSnipe ? <th className="hrpc-os-snipe-th">Snipe</th> : null}
        </tr>
      </thead>
      <tbody
        onMouseOver={(e) => {
          const thumb = (e.target as HTMLElement).closest("td.hrpc-os-thumb");
          if (!thumb) return;
          const rowEl = thumb.closest("tr");
          if (!rowEl) return;
          const id = rowEl.getAttribute("data-sale-id");
          const item = rows.find((r) => r.id === id);
          if (item) onThumbOver(item, thumb as HTMLElement);
        }}
        onMouseOut={onThumbOut}
      >
        {rows.map((row) => (
          <tr
            key={row.id}
            data-sale-id={row.id}
            className={`hrpc-row hrpc-nft-row hrpc-os-row ${rarityRowClass(row.rarityUnavailable ? null : row.rarityRank)}${focusSlug && focusSlug === row.collectionSlug ? " hrpc-nft-row-active" : ""}`}
            onClick={() => onSelect?.(row)}
          >
            <td className="hrpc-os-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="hrpc-nft-thumb"
                src={row.image}
                alt=""
                loading="lazy"
              />
            </td>
            <td className="hrpc-nft-name">{row.tokenName}</td>
            {showCollection ? (
              <td className="hrpc-name">{row.collection}</td>
            ) : null}
            <PriceCell item={row} />
            <td className="hrpc-mono hrpc-ago">{row.ago}</td>
            {showSnipe ? (
              <td>
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
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function HoodNftPanels({ onToast }: Props) {
  const [live, setLive] = useState<HoodNftSale[]>([]);
  const [focus, setFocus] = useState<HoodNftSale | null>(null);
  const [sales, setSales] = useState<HoodNftSale[]>([]);
  const [listings, setListings] = useState<HoodNftSale[]>([]);
  const [fly, setFly] = useState<FlyState | null>(null);
  const [flyVisible, setFlyVisible] = useState(false);
  const flyRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | null>(null);

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
      const thumb = (e.target as HTMLElement).closest("td.hrpc-os-thumb");
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

    async function loadLive() {
      try {
        const res = await fetch(`/api/hood-rpc/nfts?limit=${LIVE_LIMIT}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (Array.isArray(data.sales) && data.sales.length) {
          setLive((prev) =>
            mergeLiveSales(prev, data.sales as HoodNftSale[]),
          );
        }
      } catch {
        /* keep previous live rows */
      }
    }

    void loadLive();
    const id = window.setInterval(() => void loadLive(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!focus) return;
    let cancelled = false;

    async function loadProject() {
      try {
        const res = await fetch(
          `/api/hood-rpc/nfts?slug=${encodeURIComponent(focus!.collectionSlug)}&limit=20`,
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        // Only use project-scoped payloads — never the global live feed
        if (Array.isArray(data.projectSales)) {
          const next = [...(data.projectSales as HoodNftSale[])].sort(
            (a, b) => (b.eventTs || 0) - (a.eventTs || 0),
          );
          setSales(next);
        }
        if (Array.isArray(data.listings)) {
          const next = [...(data.listings as HoodNftSale[])].sort(
            (a, b) => (b.eventTs || 0) - (a.eventTs || 0),
          );
          setListings(next);
        }
      } catch {
        /* ignore */
      }
    }

    void loadProject();
    const id = window.setInterval(() => void loadProject(), 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [focus]);

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
          <SaleTable
            rows={live}
            focusSlug={focus?.collectionSlug}
            showCollection
            onSelect={selectSale}
            onThumbOver={showFlyout}
            onThumbOut={handleThumbOut}
          />
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
