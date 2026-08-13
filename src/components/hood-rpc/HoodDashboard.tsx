"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
import WalletPickerModal from "./WalletPickerModal";
import ChainSwitcher from "./ChainSwitcher";
import { HOOD_RPC_LINKS } from "./hood-wl";
import {
  ACCESS_OPENSEA_URL,
} from "@/lib/access-key-shared";
import type { Hex } from "viem";
import type { SquadWallet } from "@/lib/operator-wallets";
import {
  safeLocalGet,
  safeLocalSet,
  walletStorageKey,
} from "@/lib/session-isolation";
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

type PnlLeader = {
  wallet: string;
  user: string;
  avatarUrl: string | null;
  pnl: string;
  pnlEth: number;
};

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
  const [hasAccess, setHasAccess] = useState(false);
  const [accessChecking, setAccessChecking] = useState(true);
  const [launchWalletIds, setLaunchWalletIds] = useState<number[]>([]);
  const [squad, setSquad] = useState<SquadWallet[]>([]);
  const pkById = useRef<Map<number, Hex>>(new Map());
  const [outcomes, setOutcomes] = useState<
    { id: string; text: string; kind: "ok" | "err" | "info" }[]
  >([{ id: "1", text: "Bot idle — waiting for arm", kind: "info" }]);
  const [tickerOutcomes, setTickerOutcomes] = useState<
    { id: string; text: string; kind: "ok" | "err" | "info" }[]
  >([{ id: "t1", text: "Ticker sniper idle — waiting for deploy", kind: "info" }]);

  function pushOutcome(text: string, kind: "ok" | "err" | "info" = "info") {
    setOutcomes((o) => [{ id: String(Date.now()), text, kind }, ...o.slice(0, 40)]);
  }
  function pushTicker(text: string, kind: "ok" | "err" | "info" = "info") {
    setTickerOutcomes((o) => [
      { id: String(Date.now()), text, kind },
      ...o.slice(0, 40),
    ]);
  }
  const [launchEth, setLaunchEth] = useState("0.25");
  const [launchSlip, setLaunchSlip] = useState("12");
  const [launchPickerOpen, setLaunchPickerOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState("");
  const [pnlLeaders, setPnlLeaders] = useState<PnlLeader[]>([]);
  const [pnlNote, setPnlNote] = useState<string | null>(
    "Loading live PnL…",
  );

  useEffect(() => {
    if (!wallet || !hasAccess) {
      setUsername("");
      setAvatarUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${cfg.apiBase}/profile`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          profile?: {
            username?: string | null;
            avatarUrl?: string | null;
          };
        };
        const name = data.profile?.username || "";
        const avatar = data.profile?.avatarUrl || null;
        if (cancelled) return;
        setUsername(name);
        setAvatarUrl(avatar);
        setProfileDraft(name);
        if (name) {
          safeLocalSet(
            walletStorageKey(cfg.storagePrefix, wallet, "username"),
            name,
          );
        }
        if (avatar) {
          safeLocalSet(
            walletStorageKey(cfg.storagePrefix, wallet, "avatar"),
            avatar,
          );
        }
      } catch {
        const saved = safeLocalGet(
          walletStorageKey(cfg.storagePrefix, wallet, "username"),
        );
        const savedAvatar = safeLocalGet(
          walletStorageKey(cfg.storagePrefix, wallet, "avatar"),
        );
        if (!cancelled) {
          setUsername(saved ?? "");
          setAvatarUrl(savedAvatar);
          setProfileDraft(saved ?? "");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet, hasAccess, cfg.apiBase, cfg.storagePrefix]);

  useEffect(() => {
    let cancelled = false;
    async function loadPnl() {
      try {
        const res = await fetch(`${cfg.apiBase}/pnl/leaderboard?limit=20`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          leaders?: PnlLeader[];
          note?: string;
        };
        if (cancelled) return;
        setPnlLeaders(Array.isArray(data.leaders) ? data.leaders : []);
        setPnlNote(
          Array.isArray(data.leaders) && data.leaders.length
            ? null
            : data.note ||
                "No snipes yet — PnL appears after real ETH_RPC buys.",
        );
      } catch {
        if (!cancelled) {
          setPnlNote("PnL board unavailable");
        }
      }
    }
    void loadPnl();
    const id = window.setInterval(() => void loadPnl(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [cfg.apiBase]);

  /** MetaMask account switch → wipe session so data never crosses wallets. */
  useEffect(() => {
    const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
    if (!eth?.on || !wallet) return;

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = (args[0] as string[] | undefined) || [];
      const next = accounts[0]?.toLowerCase();
      const cur = wallet.toLowerCase();
      if (!next || next !== cur) {
        void (async () => {
          try {
            await fetch("/api/access/logout", { method: "POST" });
          } catch {
            /* ignore */
          }
          setWallet(null);
          setHasAccess(false);
          setUsername("");
          setAvatarUrl(null);
          setAvatarDraft(null);
          setAvatarFile(null);
          setProfileOpen(false);
          setLaunchWalletIds([]);
          setSquad([]);
          pkById.current.clear();
          setLaunchEth("0.25");
          setLaunchSlip("12");
          setToast("> WALLET CHANGED · RECONNECT TO VERIFY");
        })();
      }
    };

    eth.on("accountsChanged", onAccountsChanged);
    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, [wallet]);

  async function saveProfile() {
    if (!wallet) {
      setToast("> CONNECT WALLET FIRST");
      return;
    }
    const next = profileDraft.trim().replace(/^@+/, "").slice(0, 24);
    if (!next) {
      setToast("> ENTER A USERNAME");
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch(`${cfg.apiBase}/profile`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: next }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        profile?: { username?: string | null; avatarUrl?: string | null };
      };
      if (!res.ok || !data.ok) {
        setToast(`> ${data.error || "COULD NOT SAVE PROFILE"}`);
        return;
      }
      const name = data.profile?.username || next;
      setUsername(name);
      safeLocalSet(
        walletStorageKey(cfg.storagePrefix, wallet, "username"),
        name,
      );

      if (avatarFile) {
        const form = new FormData();
        form.append("avatar", avatarFile);
        const up = await fetch(`${cfg.apiBase}/profile/avatar`, {
          method: "POST",
          body: form,
        });
        const upData = (await up.json()) as {
          ok?: boolean;
          error?: string;
          profile?: { avatarUrl?: string | null };
        };
        if (!up.ok || !upData.ok) {
          setToast(`> USERNAME SAVED · AVATAR FAILED · ${upData.error || ""}`);
          setProfileOpen(false);
          return;
        }
        const avatar = upData.profile?.avatarUrl || null;
        setAvatarUrl(avatar);
        if (avatar) {
          safeLocalSet(
            walletStorageKey(cfg.storagePrefix, wallet, "avatar"),
            avatar,
          );
        }
        setAvatarFile(null);
        setAvatarDraft(null);
      }

      setProfileOpen(false);
      setToast(`> PROFILE SAVED · @${name}`);
    } catch {
      setToast("> COULD NOT SAVE PROFILE");
    } finally {
      setProfileSaving(false);
    }
  }

  function onAvatarPick(file: File | null) {
    if (!file) {
      setAvatarFile(null);
      setAvatarDraft(null);
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setToast("> USE JPEG, PNG, OR WEBP");
      return;
    }
    if (file.size > 1_000_000) {
      setToast("> IMAGE MUST BE UNDER 1MB");
      return;
    }
    setAvatarFile(file);
    setAvatarDraft(URL.createObjectURL(file));
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/access/session", { cache: "no-store" });
        const data = (await res.json()) as {
          hasAccess?: boolean;
          address?: string;
        };
        if (cancelled) return;
        if (data.hasAccess && data.address) {
          setHasAccess(true);
          setWallet(data.address);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setAccessChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Connect + verify Access Key. Same wallet is used for ETH snipes. */
  async function connectWallet() {
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
      const address = accounts?.[0];
      if (!address) {
        setToast("> NO ACCOUNT RETURNED");
        return;
      }

      const nonceRes = await fetch("/api/access/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const nonceData = (await nonceRes.json()) as {
        message?: string;
        error?: string;
      };
      if (!nonceRes.ok || !nonceData.message) {
        setToast(`> ${nonceData.error || "COULD NOT START VERIFICATION"}`);
        return;
      }

      const signature = (await eth.request({
        method: "personal_sign",
        params: [nonceData.message, address],
      })) as string;

      const verifyRes = await fetch("/api/access/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address,
          message: nonceData.message,
          signature,
        }),
      });
      const verifyData = (await verifyRes.json()) as {
        ok?: boolean;
        hasKey?: boolean;
        error?: string;
        code?: string;
      };

      if (!verifyRes.ok || !verifyData.ok) {
        setWallet(null);
        setHasAccess(false);
        if (verifyData.code === "NO_ACCESS_KEY") {
          setToast("> NO ACCESS KEY IN THIS WALLET · MINT / BUY ON OPENSEA");
        } else {
          setToast(`> ${verifyData.error || "ACCESS DENIED"}`);
        }
        return;
      }

      setWallet(address);
      setHasAccess(true);
      setToast(`> ACCESS KEY VERIFIED · ${shortAddr(address)}`);
    } catch {
      setToast("> WALLET CONNECTION / SIGN REJECTED");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectWallet() {
    try {
      await fetch("/api/access/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    setWallet(null);
    setHasAccess(false);
    setUsername("");
    setAvatarUrl(null);
    setAvatarDraft(null);
    setAvatarFile(null);
    setProfileOpen(false);
    setLaunchWalletIds([]);
    setSquad([]);
    pkById.current.clear();
    setLaunchEth("0.25");
    setLaunchSlip("12");
    setToast("> WALLET DISCONNECTED");
  }

  return (
    <div className={cfg.rootClass}>
      <div
        className={
          hasAccess ? "hrpc-app-shell" : "hrpc-app-shell hrpc-app-shell-locked"
        }
        aria-hidden={!hasAccess}
      >
      {hasAccess ? (
      <>
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
          <a
            className="hrpc-nav-link hrpc-nav-link-opensea"
            href={cfg.openseaCollectionUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenSea
          </a>
        </div>
        <div className="hrpc-nav-right">
          <div className="hrpc-nav-account">
            <button
              type="button"
              className="hrpc-btn hrpc-btn-ghost hrpc-profile-btn"
              onClick={() => {
                if (!wallet) {
                  setToast("> CONNECT WALLET TO EDIT PROFILE");
                  return;
                }
                setProfileDraft(username);
                setAvatarDraft(avatarUrl);
                setAvatarFile(null);
                setProfileOpen(true);
              }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="hrpc-avatar hrpc-avatar-nav"
                  width={22}
                  height={22}
                />
              ) : null}
              <span>
                Profile{username ? ` · @${username}` : ""}
              </span>
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
      </>
      ) : null}

      {profileOpen && hasAccess ? (
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
            <div className="hrpc-avatar-edit">
              <div className="hrpc-avatar-preview">
                {avatarDraft || avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarDraft || avatarUrl || ""}
                    alt="Profile"
                    className="hrpc-avatar hrpc-avatar-lg"
                    width={72}
                    height={72}
                  />
                ) : (
                  <span className="hrpc-avatar hrpc-avatar-lg hrpc-avatar-empty">
                    ?
                  </span>
                )}
              </div>
              <label className="hrpc-btn hrpc-btn-ghost hrpc-avatar-pick">
                Upload image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) =>
                    onAvatarPick(e.target.files?.[0] || null)
                  }
                />
              </label>
              <p className="hrpc-muted" style={{ fontSize: "0.68rem" }}>
                JPEG / PNG / WebP · max 1MB
              </p>
            </div>
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
              <button
                type="button"
                className="hrpc-btn"
                onClick={() => void saveProfile()}
                disabled={profileSaving}
              >
                {profileSaving ? "Saving…" : "Save"}
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
            <span className="hrpc-nft-chip">Live · site snipes</span>
          </div>
          {pnlLeaders.length === 0 ? (
            <p className="hrpc-pnl-empty hrpc-muted">
              {pnlNote ||
                "No snipes yet — PnL appears after real ETH_RPC buys."}
            </p>
          ) : (
            <ol className="hrpc-pnl-list">
              {pnlLeaders.map((row, i) => (
                <li key={row.wallet || row.user} className="hrpc-pnl-row">
                  <span className="hrpc-pnl-rank hrpc-mono">#{i + 1}</span>
                  {row.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.avatarUrl}
                      alt=""
                      className="hrpc-avatar hrpc-avatar-sm"
                      width={22}
                      height={22}
                    />
                  ) : (
                    <span className="hrpc-avatar hrpc-avatar-sm hrpc-avatar-empty">
                      {(row.user || "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="hrpc-pnl-user">
                    {row.user.startsWith("0x") ? row.user : `@${row.user}`}
                  </span>
                  <span
                    className={`hrpc-pnl-val hrpc-mono${row.pnlEth < 0 ? " hrpc-pnl-neg" : ""}`}
                  >
                    {row.pnl}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </section>

      <div className="hrpc-ticker hrpc-ticker-slim" aria-label="Network stats">
        {TICKER_ITEMS.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <main className="hrpc-main">
        <HoodNftPanels
          onToast={setToast}
          apiBase={cfg.apiBase}
          connectedWallet={wallet}
          liveListingBuys={variant === "eth"}
        />

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
                            setToast(`> MINT TARGET · ${row.name}`);
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
                              `> TARGET LOCKED · ${row.ticker} · ${launchEth} ETH · ${launchWalletIds.length || squad.length} wallets · ${launchSlip}% slip`,
                            );
                            pushTicker(
                              `Target locked · ${row.ticker} · ${launchEth} ETH`,
                              "ok",
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
          wallets={squad}
          onClose={() => setLaunchPickerOpen(false)}
          onConfirm={(ids) => {
            setLaunchWalletIds(ids);
            setToast(`> LAUNCH SNIPER · ${ids.length} WALLETS SELECTED`);
          }}
        />

        <HoodArmSnipers
          key={`arm-${wallet?.toLowerCase() || "none"}`}
          onToast={setToast}
          connectedWallet={wallet}
          squad={squad}
          pushOutcome={pushOutcome}
          pushTicker={pushTicker}
        />

        <HoodTools
          key={`tools-${wallet?.toLowerCase() || "none"}`}
          onToast={setToast}
          connectedWallet={wallet}
          apiBase={cfg.apiBase}
          variant={variant}
          squad={squad}
          setSquad={setSquad}
          pkById={pkById}
          pushOutcome={pushOutcome}
          outcomes={outcomes}
          tickerOutcomes={tickerOutcomes}
        />
      </main>
      </div>

      {!hasAccess ? (
        <div className="hrpc-access-cover" role="dialog" aria-modal="true" aria-label="Access Key verification">
          <div className="hrpc-access-cover-inner">
            <video
              className="hrpc-access-cover-video"
              src="/videos/access-key-tutorial.mp4"
              controls
              playsInline
              preload="metadata"
              poster="/images/hood-rpc/access-key-snipe-still.png"
            />
            <h1 className="hrpc-access-cover-title">
              Connect wallet to verify access key
            </h1>
            <p className="hrpc-access-cover-sub hrpc-muted">
              Hold a Tired Of Web3 Access Key to unlock Hood_RPC and ETH_RPC.
            </p>
            <button
              type="button"
              className="hrpc-wallet hrpc-access-cover-btn"
              onClick={connectWallet}
              disabled={connecting || accessChecking}
            >
              {connecting
                ? "Verifying…"
                : accessChecking
                  ? "Loading…"
                  : "Connect Wallet"}
            </button>
            <a
              className="hrpc-access-cover-opensea"
              href={ACCESS_OPENSEA_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get a key on OpenSea
            </a>
          </div>
        </div>
      ) : null}

      <div
        className={`hrpc-toast hrpc-mono ${toast ? "hrpc-toast-show" : ""}`}
        role="status"
      >
        {toast}
      </div>
    </div>
  );
}
