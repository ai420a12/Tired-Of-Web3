"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  TICKER_ITEMS,
  type MemecoinLaunch,
  type UpcomingNft,
  makeLaunches,
  makeNfts,
} from "./mock-data";
import HoodTools from "./HoodTools";
import HoodNftPanels from "./HoodNftPanels";
import HoodArmSnipers from "./HoodArmSnipers";
import WalletPickerModal, { FLEET } from "./WalletPickerModal";
import ChainSwitcher from "./ChainSwitcher";
import {
  HOOD_NFT_DROP_AT,
  HOOD_PLATFORM_LIVE_AT,
  HOOD_RPC_LINKS,
} from "./hood-wl";
import {
  DEMO_TOAST,
  DEMO_WALLET,
  HOOD_RPC_DEMO,
} from "@/lib/hood-rpc-demo";
import {
  getHoodRpcConfig,
  type HoodRpcVariant,
} from "@/lib/hood-rpc-chain";
import "./hood-rpc.css";

const NAV_LINKS = [
  { href: "#nft-live", label: "Snipe NFTs" },
  { href: "#launches", label: "Snipe Memecoins" },
  { href: "#generate-wallets", label: "Wallet Generator" },
  { href: "#master-split", label: "Master Split" },
] as const;

function formatDropCountdown(target: Date, now: number): string {
  const ms = target.getTime() - now;
  if (ms <= 0) return "LIVE";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) {
    return `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const PNL_LEADERS = [
  { user: "limegod", pnl: "+184.2 ETH" },
  { user: "sniper_x", pnl: "+121.7 ETH" },
  { user: "hoodape", pnl: "+98.4 ETH" },
  { user: "rpc_degen", pnl: "+76.1 ETH" },
  { user: "neoneyes", pnl: "+64.9 ETH" },
  { user: "featherking", pnl: "+51.3 ETH" },
  { user: "mintlord", pnl: "+44.8 ETH" },
  { user: "wethwhale", pnl: "+39.2 ETH" },
  { user: "gashunter", pnl: "+33.6 ETH" },
  { user: "dropcatcher", pnl: "+28.0 ETH" },
  { user: "alpha_hood", pnl: "+24.5 ETH" },
  { user: "fastlane", pnl: "+21.1 ETH" },
  { user: "blockbite", pnl: "+18.7 ETH" },
  { user: "mevfox", pnl: "+16.4 ETH" },
  { user: "launchpad", pnl: "+14.9 ETH" },
  { user: "greentick", pnl: "+12.2 ETH" },
  { user: "voidmint", pnl: "+10.8 ETH" },
  { user: "chainwolf", pnl: "+9.4 ETH" },
  { user: "pulsebag", pnl: "+7.6 ETH" },
  { user: "edgeops", pnl: "+6.1 ETH" },
] as const;

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function HoodDashboard({
  variant = "hood",
}: {
  variant?: HoodRpcVariant;
}) {
  const cfg = getHoodRpcConfig(variant);
  const [launches, setLaunches] = useState<MemecoinLaunch[]>(() => makeLaunches(12, 1));
  const [nfts, setNfts] = useState<UpcomingNft[]>(() => makeNfts(8, 2));
  const [toast, setToast] = useState<string | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [launchWalletIds, setLaunchWalletIds] = useState<number[]>(() =>
    FLEET.slice(0, 5).map((w) => w.id),
  );
  const [launchEth, setLaunchEth] = useState("0.25");
  const [launchSlip, setLaunchSlip] = useState("12");
  const [launchPickerOpen, setLaunchPickerOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!wallet) {
      setUsername("");
      return;
    }
    try {
      const saved = localStorage.getItem(`${cfg.storagePrefix}-username:${wallet.toLowerCase()}`);
      setUsername(saved ?? "");
      setProfileDraft(saved ?? "");
    } catch {
      setUsername("");
    }
  }, [wallet, cfg.storagePrefix]);

  function saveProfile() {
    if (!wallet) {
      setToast("> CONNECT WALLET FIRST");
      return;
    }
    const next = profileDraft.trim().replace(/^@+/, "").slice(0, 24);
    if (!next) {
      setToast("> ENTER A USERNAME");
      return;
    }
    try {
      localStorage.setItem(`${cfg.storagePrefix}-username:${wallet.toLowerCase()}`, next);
    } catch {
      /* ignore */
    }
    setUsername(next);
    setProfileOpen(false);
    setToast(`> PROFILE SAVED · @${next}`);
  }

  // Live memecoins + upcoming NFT schedule
  useEffect(() => {
    let cancelled = false;

    async function loadFeeds() {
      try {
        const [memeRes, upRes] = await Promise.all([
          fetch(`${cfg.apiBase}/memecoins`),
          fetch(`${cfg.apiBase}/upcoming`),
        ]);
        if (cancelled) return;
        if (memeRes.ok) {
          const data = await memeRes.json();
          if (Array.isArray(data.launches) && data.launches.length) {
            setLaunches(data.launches);
          }
        }
        if (upRes.ok) {
          const data = await upRes.json();
          if (Array.isArray(data.nfts) && data.nfts.length) {
            setNfts(data.nfts);
          }
        }
      } catch {
        /* keep mock seed */
      }
    }

    void loadFeeds();
    const id = window.setInterval(() => void loadFeeds(), 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [cfg.apiBase]);

  // Tick upcoming countdowns locally between refreshes (keep mint date intact)
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setNfts((prev) =>
        prev
          .map((row) => {
            const etaSeconds = Math.max(
              0,
              Math.floor((row.mintAtMs - now) / 1000),
            );
            const h = Math.floor(etaSeconds / 3600);
            const m = Math.floor((etaSeconds % 3600) / 60);
            const s = etaSeconds % 60;
            const countdown =
              etaSeconds <= 0
                ? "LIVE"
                : h >= 48
                  ? `${Math.floor(h / 24)}d ${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
                  : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            return {
              ...row,
              etaSeconds,
              countdown,
            };
          })
          .sort((a, b) => {
            const nowMs = Date.now();
            const aLive = a.mintAtMs <= nowMs;
            const bLive = b.mintAtMs <= nowMs;
            if (aLive !== bLive) return aLive ? -1 : 1;
            if (aLive && bLive) return b.mintAtMs - a.mintAtMs;
            return a.mintAtMs - b.mintAtMs;
          }),
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function connectWallet() {
    if (HOOD_RPC_DEMO) {
      setConnecting(true);
      await new Promise((r) => setTimeout(r, 350));
      setWallet(DEMO_WALLET);
      setConnecting(false);
      setToast(DEMO_TOAST);
      return;
    }
    const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
    if (!eth) {
      setToast("> NO EVM WALLET FOUND · INSTALL METAMASK / RABBY");
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts?.[0]) {
        setWallet(accounts[0]);
        setToast(`> WALLET CONNECTED · ${shortAddr(accounts[0])}`);
      }
    } catch {
      setToast("> WALLET CONNECTION REJECTED");
    } finally {
      setConnecting(false);
    }
  }

  function disconnectWallet() {
    setWallet(null);
    setUsername("");
    setProfileOpen(false);
    setToast(HOOD_RPC_DEMO ? "> DEMO SESSION CLEARED" : "> WALLET DISCONNECTED");
  }

  return (
    <div className={cfg.rootClass}>
      <nav className="hrpc-nav">
        <div className="hrpc-nav-left">
          <ChainSwitcher />
          <a className="hrpc-brand" href={cfg.homePath}>
            <Image
              src={cfg.mascotLogo}
              alt={cfg.brand}
              width={40}
              height={40}
              className="hrpc-nav-logo"
              priority
            />
            <span className={cfg.wordmarkClass}>{cfg.brand}</span>
          </a>
        </div>
        <div className="hrpc-nav-links" aria-label="Sections">
          <a
            className="hrpc-x-link"
            href={HOOD_RPC_LINKS.x}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TiredOfWeb3 on X"
            title="@TiredOfWeb3"
          >
            <svg viewBox="0 0 24 24" aria-hidden width="14" height="14">
              <path
                fill="currentColor"
                d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.743l7.727-8.889L1.25 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"
              />
            </svg>
          </a>
          {NAV_LINKS.map((link) => (
            <a key={link.href} className="hrpc-nav-link" href={link.href}>
              {link.label}
            </a>
          ))}
          <Link className="hrpc-nav-link hrpc-nav-link-wl" href={cfg.wlPath}>
            Get WL
          </Link>
        </div>
        <div className="hrpc-nav-right">
          <div className="hrpc-nav-account">
            <button
              type="button"
              className="hrpc-btn hrpc-btn-ghost hrpc-profile-btn"
              onClick={() => {
                if (!wallet) {
                  setToast(
                    HOOD_RPC_DEMO
                      ? "> CONNECT WALLET TO EDIT PROFILE"
                      : "> CONNECT WALLET TO EDIT PROFILE",
                  );
                  return;
                }
                setProfileDraft(username);
                setProfileOpen(true);
              }}
            >
              Profile{username ? ` · @${username}` : ""}
            </button>
            {wallet ? (
              <button
                type="button"
                className="hrpc-wallet hrpc-wallet-connected hrpc-mono"
                onClick={disconnectWallet}
                title="Click to disconnect"
              >
                <span className="hrpc-wallet-dot" />
                <span>{shortAddr(wallet)}</span>
              </button>
            ) : (
              <button
                type="button"
                className="hrpc-wallet"
                onClick={connectWallet}
                disabled={connecting}
              >
                <span>{connecting ? "Connecting…" : "Connect Wallet"}</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="hrpc-drop-rail" aria-label="Launch schedule">
        <div className="hrpc-drop-strip">
          <a
            className="hrpc-drop-card hrpc-drop-nft"
            href={cfg.openseaCollectionUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="hrpc-drop-meta">
              <span className="hrpc-drop-label">NFT collection</span>
            </span>
            <span className="hrpc-btn hrpc-drop-opensea">OpenSea</span>
            <span className="hrpc-drop-clock hrpc-mono" aria-live="polite">
              {formatDropCountdown(HOOD_NFT_DROP_AT, now)}
            </span>
          </a>
          <div className="hrpc-drop-card hrpc-drop-platform">
            <span className="hrpc-drop-meta">
              <span className="hrpc-drop-label">Platform live</span>
            </span>
            <span className="hrpc-drop-clock hrpc-mono" aria-live="polite">
              {formatDropCountdown(HOOD_PLATFORM_LIVE_AT, now)}
            </span>
          </div>
        </div>
        <div className="hrpc-demo-banner" role="status">
          Demo Version — Full version will have much faster NODES. Check the
          countdowns above for when everything goes live!
        </div>
      </div>

      {profileOpen ? (
        <div
          className="hrpc-modal-backdrop"
          role="presentation"
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="hrpc-modal hrpc-profile-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit profile"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hrpc-modal-head">
              <h3 className="hrpc-section-title hrpc-section-title-sm">
                Profile
              </h3>
              <button
                type="button"
                className="hrpc-btn hrpc-btn-ghost"
                onClick={() => setProfileOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="hrpc-mono hrpc-muted">
              Wallet · {wallet ? shortAddr(wallet) : "—"}
            </p>
            <label className="hrpc-label" htmlFor="hrpc-username">
              Username
            </label>
            <div className="hrpc-inline">
              <input
                id="hrpc-username"
                className="hrpc-input hrpc-mono"
                value={profileDraft}
                onChange={(e) => setProfileDraft(e.target.value)}
                placeholder="yourname"
                maxLength={24}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className="hrpc-btn" onClick={saveProfile}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="hrpc-hero hrpc-hero-pnl" aria-label={`${cfg.brand} hero`}>
        <div className="hrpc-hero-video-wrap">
          <p className="hrpc-hero-video-label">{cfg.videoLabel}</p>
          <video
            className="hrpc-hero-video"
            src="/videos/hood-rpc-tutorial.mp4"
            poster={cfg.mascotLogo}
            controls
            playsInline
            preload="metadata"
            aria-label={`${cfg.brand} tutorial — snipe NFTs and memecoins on ${cfg.chainLabel}`}
          >
            Your browser does not support the video tag.
          </video>
        </div>

        <aside className="hrpc-pnl-board" aria-label="Top PnL leaderboard">
          <div className="hrpc-pnl-head">
            <h2 className="hrpc-section-title hrpc-section-title-sm">Top PnL</h2>
            <span className="hrpc-nft-chip">Top 20 registered</span>
          </div>
          <ol className="hrpc-pnl-list">
            {PNL_LEADERS.map((row, i) => (
              <li key={row.user} className="hrpc-pnl-row">
                <span className="hrpc-pnl-rank hrpc-mono">#{i + 1}</span>
                <span className="hrpc-pnl-user">@{row.user}</span>
                <span className="hrpc-pnl-val hrpc-mono">{row.pnl}</span>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <div className="hrpc-ticker hrpc-ticker-slim" aria-label="Network stats">
        {TICKER_ITEMS.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <main className="hrpc-main">
        <HoodNftPanels onToast={setToast} apiBase={cfg.apiBase} />

        <div className="hrpc-grid-2" id="launches">
          <section className="hrpc-panel" aria-label="Upcoming NFT collections" id="upcoming-nfts">
            <div className="hrpc-section-head">
              <div>
                <h2 className="hrpc-section-title">Upcoming NFTs</h2>
              </div>
            </div>
            <div className="hrpc-table-wrap">
              <table className="hrpc-table hrpc-table-upcoming">
                <thead>
                  <tr>
                    <th className="hrpc-col-collection">Collection</th>
                    <th className="hrpc-col-supply">Supply</th>
                    <th className="hrpc-col-price">Price</th>
                    <th className="hrpc-col-mintdate">Mint date</th>
                    <th className="hrpc-col-countdown">Countdown</th>
                    <th className="hrpc-col-snipe" />
                  </tr>
                </thead>
                <tbody>
                  {nfts.map((row) => (
                    <tr key={row.id} className="hrpc-row">
                      <td className="hrpc-col-collection">
                        <div className="hrpc-asset-cell">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            className="hrpc-row-logo"
                            src={row.logo}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                          <div className="hrpc-asset-text">
                            <div className="hrpc-ticker-cell">{row.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hrpc-mono hrpc-col-supply">{row.supply}</td>
                      <td className="hrpc-mono hrpc-col-price">{row.price}</td>
                      <td className="hrpc-mono hrpc-col-mintdate">{row.mintTime}</td>
                      <td className="hrpc-mono hrpc-col-countdown">{row.countdown}</td>
                      <td className="hrpc-col-snipe">
                        <button
                          type="button"
                          className="hrpc-btn"
                          onClick={() => {
                            setToast(
                              HOOD_RPC_DEMO
                                ? `> DEMO SNIPE · ${row.name} · no real mint`
                                : `> MINT TARGET · ${row.name}`,
                            );
                            window.open(
                              row.openseaUrl,
                              "_blank",
                              "noopener,noreferrer",
                            );
                            document
                              .getElementById("arm-nft")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          Snipe
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="hrpc-panel" aria-label="Memecoin launches">
            <div className="hrpc-section-head">
              <div>
                <h2 className="hrpc-section-title">Memecoin Launches</h2>
              </div>
              <div className="hrpc-launch-presets" aria-label="Snipe presets">
                <label className="hrpc-preset">
                  <span className="hrpc-preset-label">Wallets</span>
                  <button
                    type="button"
                    className="hrpc-input hrpc-preset-input hrpc-wallet-select-btn"
                    onClick={() => setLaunchPickerOpen(true)}
                  >
                    Select wallets ({launchWalletIds.length})
                  </button>
                </label>
                <label className="hrpc-preset">
                  <span className="hrpc-preset-label">ETH</span>
                  <input
                    className="hrpc-input hrpc-preset-input hrpc-mono"
                    value={launchEth}
                    onChange={(e) => setLaunchEth(e.target.value)}
                    inputMode="decimal"
                    aria-label="Snipe ETH amount"
                    placeholder="0.25"
                  />
                </label>
                <label className="hrpc-preset">
                  <span className="hrpc-preset-label">Slip %</span>
                  <input
                    className="hrpc-input hrpc-preset-input hrpc-mono"
                    value={launchSlip}
                    onChange={(e) => setLaunchSlip(e.target.value)}
                    inputMode="decimal"
                    aria-label="Slippage"
                    placeholder="12"
                  />
                </label>
              </div>
            </div>
            <div className="hrpc-table-wrap">
              <table className="hrpc-table hrpc-table-launches">
                <thead>
                  <tr>
                    <th className="hrpc-col-token">Token</th>
                    <th className="hrpc-col-age">Age</th>
                    <th className="hrpc-col-liq">Liq</th>
                    <th className="hrpc-col-mcap">Mcap</th>
                    <th className="hrpc-col-status">Status</th>
                    <th className="hrpc-col-snipe" />
                  </tr>
                </thead>
                <tbody>
                  {launches.map((row) => (
                    <tr key={row.id} className="hrpc-row">
                      <td className="hrpc-col-token">
                        <div className="hrpc-asset-cell">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            className="hrpc-row-logo"
                            src={variant === "eth" ? cfg.defaultTokenLogo : row.logo}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                          <div className="hrpc-asset-text">
                            <div className="hrpc-ticker-cell">{row.ticker}</div>
                            <div className="hrpc-name">{row.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hrpc-mono hrpc-col-age">{row.age}</td>
                      <td className="hrpc-mono hrpc-col-liq">{row.liquidity}</td>
                      <td className="hrpc-mono hrpc-col-mcap">{row.mcap}</td>
                      <td className="hrpc-col-status">
                        <span
                          className={`hrpc-status hrpc-status-${row.status.toLowerCase()}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="hrpc-btn"
                          disabled={row.status === "ENDED"}
                          onClick={() => {
                            setToast(
                              HOOD_RPC_DEMO
                                ? `> DEMO SNIPE · ${row.ticker} · no real buy`
                                : `> TARGET LOCKED · ${row.ticker} · ${launchEth} ETH · ${launchWalletIds.length} wallets · ${launchSlip}% slip`,
                            );
                            document
                              .getElementById("arm-meme")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          Snipe
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <WalletPickerModal
          open={launchPickerOpen}
          selected={launchWalletIds}
          onClose={() => setLaunchPickerOpen(false)}
          onConfirm={(ids) => {
            setLaunchWalletIds(ids);
            setToast(`> LAUNCH SNIPER · ${ids.length} WALLETS SELECTED`);
          }}
        />

        <HoodArmSnipers onToast={setToast} connectedWallet={wallet} />

        <HoodTools onToast={setToast} connectedWallet={wallet} />
      </main>

      <div
        className={`hrpc-toast hrpc-mono ${toast ? "hrpc-toast-show" : ""}`}
        role="status"
      >
        {toast}
      </div>
    </div>
  );
}
