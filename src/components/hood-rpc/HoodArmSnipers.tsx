"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import WalletPickerModal from "./WalletPickerModal";
import type { SquadWallet } from "@/lib/operator-wallets";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";
import type { Hex } from "viem";
import {
  formatLiveGwei,
  quoteLiveGas,
  type GasSpeed,
  type LiveGasQuote,
} from "@/lib/live-gas";
import {
  sendMintWithMetaMask,
  walletErrorText,
} from "@/lib/metamask-mint";
import {
  explorerMintTx,
  signAndBroadcastMint,
} from "@/lib/seadrop-mint";

type Props = {
  onToast: (msg: string) => void;
  connectedWallet: string | null;
  apiBase: string;
  variant: HoodRpcVariant;
  squad: SquadWallet[];
  pkById: MutableRefObject<Map<number, Hex>>;
  pushOutcome: (text: string, kind?: "ok" | "err" | "info") => void;
  pushTicker: (text: string, kind?: "ok" | "err" | "info") => void;
};

type NftTarget = { label: string; ca: string; qty: string };

type MintPhase = {
  id: string;
  label: string;
  stageType: string;
  priceWei: string;
  priceEth: number;
  startAt: number;
  endAt: number;
  maxPerWallet: number;
  status: "live" | "upcoming" | "ended";
};

type PreparedMint = {
  to: string;
  data: string;
  value?: string;
  gas?: string;
  from?: string;
};

const ADDR_RE = /0x[a-fA-F0-9]{40}/;

function extractAddress(raw: string): string {
  const m = raw.match(ADDR_RE);
  return m ? m[0].toLowerCase() : "";
}

function mintQty(raw: string): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(100, n);
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatPhasePrice(eth: number) {
  if (!Number.isFinite(eth) || eth <= 0) return "FREE";
  if (eth < 0.001) return `${eth.toFixed(5)} ETH`;
  if (eth < 0.01) return `${eth.toFixed(4)} ETH`;
  return `${eth.toFixed(3)} ETH`;
}

function formatPhaseWhen(phase: MintPhase, now: number) {
  if (phase.status === "live") return "LIVE";
  if (phase.status === "ended") return "ENDED";
  const ms = Math.max(0, phase.startAt - now);
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${String(h % 24).padStart(2, "0")}h`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function refreshPhaseStatus(phase: MintPhase, now = Date.now()): MintPhase {
  let status: MintPhase["status"] = "live";
  if (phase.endAt && now >= phase.endAt) status = "ended";
  else if (phase.startAt && now < phase.startAt) status = "upcoming";
  return { ...phase, status };
}

export default function HoodArmSnipers({
  onToast,
  connectedWallet,
  apiBase,
  variant,
  squad,
  pkById,
  pushOutcome,
  pushTicker,
}: Props) {
  const chain = variant === "eth" ? "ethereum" : "robinhood";
  const [contractCa, setContractCa] = useState("");
  const [osUrl, setOsUrl] = useState("");
  const [spectrumUrl, setSpectrumUrl] = useState("");
  const [targets, setTargets] = useState<NftTarget[]>([
    { label: "", ca: "", qty: "1" },
  ]);
  const [nftWalletIds, setNftWalletIds] = useState<number[]>([]);
  const [pickerFor, setPickerFor] = useState<"nft" | "meme" | null>(null);
  const [gasMode, setGasMode] = useState<GasSpeed>("fast");
  const [manualGwei, setManualGwei] = useState("");
  const [liveGas, setLiveGas] = useState<LiveGasQuote | null>(null);
  const [arming, setArming] = useState(false);
  const [phases, setPhases] = useState<MintPhase[]>([]);
  const [phasesNote, setPhasesNote] = useState("");
  const [phasesLoading, setPhasesLoading] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [armedPhase, setArmedPhase] = useState<{
    contract: string;
    name: string;
    phaseId: string;
    raw: string;
  } | null>(null);
  const firedArm = useRef(false);

  const [ticker, setTicker] = useState("");
  const [buyEth, setBuyEth] = useState("0.25");
  const [memeWalletIds, setMemeWalletIds] = useState<number[]>([]);
  const [slippage, setSlippage] = useState("12");
  const [watching, setWatching] = useState(false);

  const pickerSelected = useMemo(
    () => (pickerFor === "meme" ? memeWalletIds : nftWalletIds),
    [pickerFor, memeWalletIds, nftWalletIds],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const quote = await quoteLiveGas({
          chain,
          mode: gasMode === "manual" ? "fast" : gasMode,
        });
        if (!cancelled) setLiveGas(quote);
      } catch {
        if (!cancelled) setLiveGas(null);
      }
    }
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [chain, gasMode]);

  const lookupRaw = useMemo(
    () =>
      contractCa.trim() ||
      osUrl.trim() ||
      spectrumUrl.trim() ||
      targets[0].ca.trim(),
    [contractCa, osUrl, spectrumUrl, targets],
  );

  useEffect(() => {
    if (!lookupRaw) {
      setPhases([]);
      setPhasesNote("");
      setSelectedPhaseId(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPhasesLoading(true);
      setPhasesNote("");
      try {
        const hex = extractAddress(lookupRaw);
        const q = hex || lookupRaw;
        const res = await fetch(
          `${apiBase}/mint-detail?q=${encodeURIComponent(q)}&chain=${chain}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          name?: string;
          contract?: string;
          phases?: MintPhase[];
        };
        if (cancelled) return;
        const next = (data.phases || []).map((p) => refreshPhaseStatus(p));
        setPhases(next);
        if (!data.ok) {
          setPhasesNote(data.error || "Could not load phases");
          setSelectedPhaseId(null);
          return;
        }
        if (!next.length) {
          setPhasesNote("No mint phases found for this collection");
          setSelectedPhaseId(null);
          return;
        }
        setSelectedPhaseId((prev) => {
          if (prev && next.some((p) => p.id === prev)) return prev;
          const live = next.find((p) => p.status === "live");
          const upcoming = next.find((p) => p.status === "upcoming");
          return (live || upcoming || next[0]).id;
        });
        if (data.name && !targets[0].label.trim()) {
          setTargets((cur) => [{ ...cur[0], label: data.name || cur[0].label }]);
        }
        if (data.contract && !targets[0].ca.trim() && !extractAddress(contractCa)) {
          setTargets((cur) => [{ ...cur[0], ca: data.contract || cur[0].ca }]);
        }
      } catch {
        if (!cancelled) {
          setPhases([]);
          setPhasesNote("Could not load phases");
        }
      } finally {
        if (!cancelled) setPhasesLoading(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiBase, chain, lookupRaw]);

  const selectedPhase = useMemo(
    () => phases.find((p) => p.id === selectedPhaseId) || null,
    [phases, selectedPhaseId],
  );

  useEffect(() => {
    if (!phases.length) return;
    const id = window.setInterval(() => {
      setPhases((prev) => prev.map((p) => refreshPhaseStatus(p)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phases.length]);

  useEffect(() => {
    if (!armedPhase) {
      firedArm.current = false;
      return;
    }
    const phase = phases.find((p) => p.id === armedPhase.phaseId);
    if (!phase) return;
    const live = refreshPhaseStatus(phase);
    if (live.status === "ended") {
      onToast(`> ${phase.label.toUpperCase()} ENDED`);
      pushOutcome(`${phase.label} ended before mint`, "err");
      setArmedPhase(null);
      return;
    }
    if (live.status !== "live" || firedArm.current || arming) return;
    firedArm.current = true;
    void fireArmedMint(armedPhase.raw, { skipPhaseWait: true });
    setArmedPhase(null);
  }, [armedPhase, phases, arming]);

  function manualValue(): number | undefined {
    if (gasMode !== "manual") return undefined;
    const n = parseFloat(manualGwei);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  async function resolveContract(raw: string): Promise<{
    contract: string;
    name: string;
  }> {
    const hex = extractAddress(raw);
    if (hex) return { contract: hex, name: "" };
    const q = raw.trim();
    if (!q) throw new Error("Paste a contract, OpenSea URL, or mint link");
    const res = await fetch(
      `${apiBase}/mint-detail?q=${encodeURIComponent(q)}&chain=${chain}`,
      { cache: "no-store" },
    );
    const data = (await res.json()) as {
      ok?: boolean;
      contract?: string;
      name?: string;
      error?: string;
    };
    const resolved = extractAddress(data.contract || "");
    if (!resolved) {
      throw new Error(data.error || "Need a 0x contract (or OpenSea collection URL)");
    }
    return { contract: resolved, name: data.name || "" };
  }

  async function prepareMint(from: string, contract: string, quantity: number) {
    const res = await fetch(`${apiBase}/mint-tx`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contract,
        quantity,
        from,
        allowPaid: true,
        chain,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      quantity?: number;
      tx?: PreparedMint;
    };
    if (!data.ok || !data.tx?.to || !data.tx?.data) {
      throw new Error(data.error || "No mint route for this contract");
    }
    return data;
  }

  function keyedWallets(ids: number[]) {
    return ids
      .map((id) => {
        const wallet = squad.find((w) => w.id === id);
        const pk = pkById.current.get(id);
        if (!wallet || !pk) return null;
        return { wallet, pk };
      })
      .filter((row): row is { wallet: SquadWallet; pk: Hex } => Boolean(row));
  }

  async function fireArmedMint(
    raw: string,
    opts?: { requireWallets?: boolean; skipPhaseWait?: boolean },
  ) {
    if (!connectedWallet) {
      onToast("> CONNECT WALLET FIRST (top right)");
      return;
    }
    if (!raw.trim()) {
      onToast("> PASTE CONTRACT, OPENSEA URL, OR MINT LINK");
      return;
    }
    if (gasMode === "manual" && !manualValue()) {
      onToast("> ENTER MANUAL GWEI");
      return;
    }

    const phase = selectedPhase ? refreshPhaseStatus(selectedPhase) : null;
    if (!opts?.skipPhaseWait && phase) {
      if (phase.status === "ended") {
        onToast(`> ${phase.label.toUpperCase()} ALREADY ENDED — PICK ANOTHER PHASE`);
        return;
      }
      if (phase.status === "upcoming") {
        const target = await resolveContract(raw).catch(() => null);
        const contract = target?.contract || extractAddress(raw);
        if (!contract) {
          onToast("> NEED A CONTRACT TO ARM THIS PHASE");
          return;
        }
        firedArm.current = false;
        setArmedPhase({
          contract,
          name: targets[0].label.trim() || target?.name || shortAddr(contract),
          phaseId: phase.id,
          raw,
        });
        onToast(`> ARMED · ${phase.label} · waiting to go live`);
        pushOutcome(
          `Armed ${phase.label} · ${formatPhaseWhen(phase, Date.now())}`,
          "ok",
        );
        return;
      }
    }

    const selectedIds = nftWalletIds.length
      ? nftWalletIds
      : opts?.requireWallets
        ? squad.map((w) => w.id)
        : [];
    const silent = keyedWallets(selectedIds);
    if (selectedIds.length && !silent.length) {
      onToast("> PASTE SQUAD KEYS FOR SELECTED WALLETS (or clear selection to mint with MetaMask)");
      return;
    }

    setArming(true);
    const qty = mintQty(targets[0].qty);
    try {
      const target = await resolveContract(raw);
      const phaseTag = phase?.label ? ` · ${phase.label}` : "";
      const label = `${targets[0].label.trim() || target.name || shortAddr(target.contract)}${phaseTag}`;
      const gasLabel =
        gasMode === "manual"
          ? `${manualValue()} gwei`
          : `${gasMode} · ~${formatLiveGwei(liveGas?.maxFeeGwei || 0)} gwei`;

      if (silent.length) {
        onToast(`> ARMING ${silent.length} WALLETS · ${label} · ${qty} each`);
        pushOutcome(
          `NFT arm · ${label} · ${silent.length} wallets · ${qty} · ${gasLabel}`,
          "info",
        );
        const results = await Promise.allSettled(
          silent.map(async ({ wallet, pk }) => {
            const prepared = await prepareMint(wallet.address, target.contract, qty);
            const hash = await signAndBroadcastMint({
              variant,
              apiBase,
              privateKey: pk,
              tx: prepared.tx as PreparedMint,
              gasMode,
              manualGwei: manualValue(),
            });
            return { wallet, hash, quantity: prepared.quantity || qty };
          }),
        );
        let ok = 0;
        for (const row of results) {
          if (row.status === "fulfilled") {
            ok += 1;
            pushOutcome(
              `Minted ${row.value.quantity} · ${shortAddr(row.value.wallet.address)} · ${row.value.hash.slice(0, 10)}…`,
              "ok",
            );
          } else {
            const reason =
              row.reason instanceof Error ? row.reason.message : "MINT_FAILED";
            pushOutcome(`Mint failed · ${reason}`, "err");
          }
        }
        if (ok) {
          const first = results.find((r) => r.status === "fulfilled");
          const hash =
            first && first.status === "fulfilled" ? first.value.hash : "";
          onToast(
            `> MINTED ${ok}/${silent.length} · ${label}${hash ? ` · ${explorerMintTx(variant, hash)}` : ""}`,
          );
        } else {
          onToast("> NFT ARM FAILED — check bot outcomes");
        }
        return;
      }

      onToast(`> CONFIRM MINT IN METAMASK · ${label} · ${qty}`);
      pushOutcome(
        `NFT arm · ${label} · MetaMask · ${qty} · ${gasLabel}`,
        "info",
      );
      const prepared = await prepareMint(connectedWallet, target.contract, qty);
      const hash = await sendMintWithMetaMask({
        chain,
        from: connectedWallet,
        to: prepared.tx!.to,
        data: prepared.tx!.data,
        value: prepared.tx!.value,
        gas: prepared.tx!.gas,
        gasMode,
        manualGwei: manualValue(),
      });
      pushOutcome(
        `Minted ${prepared.quantity || qty} · ${shortAddr(connectedWallet)} · ${hash.slice(0, 10)}…`,
        "ok",
      );
      onToast(`> MINTED ${prepared.quantity || qty} · ${explorerMintTx(variant, hash)}`);
    } catch (err) {
      const msg = walletErrorText(err);
      onToast(`> ${msg}`);
      pushOutcome(`NFT arm failed · ${msg}`, "err");
    } finally {
      setArming(false);
    }
  }

  function armNftFromCa() {
    void fireArmedMint(contractCa);
  }

  function armOpensea() {
    void fireArmedMint(osUrl || contractCa);
  }

  function armSpectrum() {
    void fireArmedMint(spectrumUrl || contractCa);
  }

  function saveTargetsAndArm() {
    const t = targets[0];
    const raw = t.ca.trim() || contractCa.trim() || osUrl.trim() || spectrumUrl.trim();
    if (!t.label.trim() && !raw) {
      onToast("> SET TARGET NAME OR CONTRACT");
      return;
    }
    void fireArmedMint(raw, { requireWallets: true });
  }

  function armMemecoin() {
    if (!connectedWallet) {
      onToast("> CONNECT WALLET FIRST (top right)");
      return;
    }
    const t = ticker.trim().replace(/^\$/, "").toUpperCase();
    if (!t) {
      onToast("> ENTER TICKER TO WATCH");
      return;
    }
    const ids = memeWalletIds.length ? memeWalletIds : squad.map((w) => w.id);
    if (!ids.length) {
      onToast("> SELECT WALLETS FIRST");
      return;
    }
    setWatching(true);
    const msg = `> MEME SNIPER ARMED · $${t} · ${buyEth} ETH · ${ids.length} wallets · ${slippage}% slip`;
    onToast(msg);
    pushTicker(
      `Armed $${t} · ${buyEth} ETH · ${ids.length} wallets · ${slippage}% slip`,
      "ok",
    );
  }

  function clearMeme() {
    setWatching(false);
    setTicker("");
    onToast("> MEME SNIPER CLEARED");
    pushTicker("Meme sniper cleared", "info");
  }

  const liveHint =
    gasMode === "manual"
      ? `Live ~${formatLiveGwei(liveGas?.liveGwei || 0)} gwei · enter your max fee`
      : `Live ~${formatLiveGwei(liveGas?.liveGwei || 0)} gwei · ${gasMode} ~${formatLiveGwei(liveGas?.maxFeeGwei || 0)}`;

  return (
    <>
      <div className="hrpc-arm-grid">
        <section className="hrpc-panel hrpc-arm-panel" id="arm-nft" aria-label="Arm sniper NFTs">
          <div className="hrpc-section-head">
            <div>
              <h2 className="hrpc-section-title">Arm Sniper — NFTs</h2>
            </div>
          </div>

          <div className="hrpc-arm-body">
            <div className="hrpc-inline">
              <input
                className="hrpc-input hrpc-mono"
                placeholder="Paste custom contract address"
                value={contractCa}
                onChange={(e) => setContractCa(e.target.value)}
                spellCheck={false}
              />
              <button
                type="button"
                className="hrpc-btn"
                onClick={armNftFromCa}
                disabled={arming}
              >
                {arming ? "Minting…" : "Arm mint"}
              </button>
            </div>
            <div className="hrpc-inline">
              <input
                className="hrpc-input hrpc-mono"
                placeholder="Paste OpenSea collection or slug URL"
                value={osUrl}
                onChange={(e) => setOsUrl(e.target.value)}
                spellCheck={false}
              />
              <button
                type="button"
                className="hrpc-btn"
                onClick={armOpensea}
                disabled={arming}
              >
                OpenSea mint
              </button>
            </div>
            <div className="hrpc-inline">
              <input
                className="hrpc-input hrpc-mono"
                placeholder="Paste Spectrum URL — mint link / mint page URL"
                value={spectrumUrl}
                onChange={(e) => setSpectrumUrl(e.target.value)}
                spellCheck={false}
              />
              <button
                type="button"
                className="hrpc-btn"
                onClick={armSpectrum}
                disabled={arming}
              >
                Mint now (WL / any stage)
              </button>
            </div>

            <div className="hrpc-targets-grid hrpc-targets-single">
              <div className="hrpc-target-slot">
                <label>Target 1</label>
                <input
                  className="hrpc-input"
                  placeholder="Project Name"
                  value={targets[0].label}
                  onChange={(e) => {
                    setTargets([{ ...targets[0], label: e.target.value }]);
                  }}
                />
                <input
                  className="hrpc-input hrpc-mono"
                  placeholder="0x contract address"
                  value={targets[0].ca}
                  onChange={(e) => {
                    setTargets([{ ...targets[0], ca: e.target.value }]);
                  }}
                />
                <div className="hrpc-qty">
                  <label>Mints per wallet</label>
                  <input
                    className="hrpc-input hrpc-mono"
                    value={targets[0].qty}
                    maxLength={3}
                    onChange={(e) => {
                      setTargets([{ ...targets[0], qty: e.target.value }]);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="hrpc-phase-controls" aria-label="Mint phases">
              <span className="hrpc-preset-label">Mint phase</span>
              {phasesLoading ? (
                <p className="hrpc-gas-live">Loading phases…</p>
              ) : phases.length ? (
                <div className="hrpc-phase-row">
                  {phases.map((phase) => {
                    const now = Date.now();
                    const on = selectedPhaseId === phase.id;
                    return (
                      <button
                        key={phase.id}
                        type="button"
                        className={`hrpc-phase-chip ${on ? "is-on" : ""} ${phase.status === "ended" ? "is-ended" : ""}`}
                        onClick={() => {
                          setSelectedPhaseId(phase.id);
                          setArmedPhase(null);
                        }}
                      >
                        <strong>{phase.label}</strong>
                        <span>
                          {formatPhasePrice(phase.priceEth)}
                          {phase.maxPerWallet ? ` · ${phase.maxPerWallet}/wallet` : ""}
                        </span>
                        <span className={`hrpc-phase-when hrpc-phase-${phase.status}`}>
                          {formatPhaseWhen(phase, now)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="hrpc-gas-live">
                  {phasesNote || "Paste a contract to load mint phases"}
                </p>
              )}
              {armedPhase && selectedPhase ? (
                <div className="hrpc-phase-armed">
                  <span>
                    Armed for <strong>{selectedPhase.label}</strong>
                    {selectedPhase.status === "upcoming"
                      ? ` · ${formatPhaseWhen(selectedPhase, Date.now())}`
                      : " · waiting to fire"}
                  </span>
                  <button
                    type="button"
                    className="hrpc-btn hrpc-btn-ghost"
                    onClick={() => {
                      setArmedPhase(null);
                      onToast("> NFT PHASE DISARMED");
                    }}
                  >
                    Disarm
                  </button>
                </div>
              ) : null}
            </div>

            <div className="hrpc-gas-controls" aria-label="Gas presets">
              <span className="hrpc-preset-label">Gas (gwei)</span>
              <div className="hrpc-gas-row">
                <button
                  type="button"
                  className={`hrpc-btn ${gasMode === "normal" ? "" : "hrpc-btn-ghost"}`}
                  onClick={() => setGasMode("normal")}
                >
                  Normal
                </button>
                <button
                  type="button"
                  className={`hrpc-btn ${gasMode === "fast" ? "" : "hrpc-btn-ghost"}`}
                  onClick={() => setGasMode("fast")}
                >
                  Fast
                </button>
                <button
                  type="button"
                  className={`hrpc-btn ${gasMode === "hyper" ? "" : "hrpc-btn-ghost"}`}
                  onClick={() => setGasMode("hyper")}
                >
                  Hyper
                </button>
                <label className={`hrpc-gas-manual ${gasMode === "manual" ? "on" : ""}`}>
                  <button
                    type="button"
                    className={`hrpc-btn ${gasMode === "manual" ? "" : "hrpc-btn-ghost"}`}
                    onClick={() => setGasMode("manual")}
                  >
                    Manual
                  </button>
                  <input
                    className="hrpc-input hrpc-mono hrpc-gas-manual-input"
                    value={manualGwei}
                    onChange={(e) => {
                      setGasMode("manual");
                      setManualGwei(e.target.value);
                    }}
                    onFocus={() => setGasMode("manual")}
                    inputMode="decimal"
                    placeholder="gwei"
                    aria-label="Manual gwei"
                  />
                </label>
              </div>
              <span className="hrpc-gas-live">{liveHint}</span>
            </div>

            <div className="hrpc-row-actions" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="hrpc-btn hrpc-btn-ghost"
                onClick={() => setPickerFor("nft")}
              >
                Select wallets ({nftWalletIds.length || squad.length})
              </button>
              <button
                type="button"
                className="hrpc-btn"
                onClick={saveTargetsAndArm}
                disabled={arming}
              >
                {arming
                  ? "Minting…"
                  : armedPhase
                    ? "Armed"
                    : selectedPhase?.status === "upcoming"
                      ? `Arm ${selectedPhase.label}`
                      : "Save targets + arm mint"}
              </button>
            </div>
          </div>
        </section>

        <section
          className="hrpc-panel hrpc-arm-panel hrpc-soon-wrap"
          id="arm-meme"
          aria-label="Arm sniper memecoins"
        >
          <div className="hrpc-soon-overlay" aria-hidden="true">
            <span className="hrpc-soon-banner">Coming soon</span>
          </div>
          <div className="hrpc-section-head">
            <div>
              <h2 className="hrpc-section-title">Arm Sniper — Memecoins</h2>
            </div>
            {watching ? (
              <span className="hrpc-nft-chip hrpc-chip-live">WATCHING</span>
            ) : null}
          </div>

          <div className="hrpc-arm-body hrpc-snipe-form hrpc-meme-form">
            <div className="hrpc-field">
              <label htmlFor="meme-ticker">Ticker</label>
              <input
                id="meme-ticker"
                className="hrpc-input hrpc-mono"
                placeholder="$HOODAI"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                spellCheck={false}
              />
            </div>

            <div className="hrpc-meme-row">
              <div className="hrpc-field">
                <label htmlFor="meme-amount">Buy amount (ETH)</label>
                <input
                  id="meme-amount"
                  className="hrpc-input hrpc-mono"
                  value={buyEth}
                  onChange={(e) => setBuyEth(e.target.value)}
                />
              </div>
              <div className="hrpc-field">
                <label>Wallets</label>
                <button
                  type="button"
                  className="hrpc-input hrpc-wallet-select-btn"
                  onClick={() => setPickerFor("meme")}
                >
                  Select wallets ({memeWalletIds.length || squad.length})
                </button>
              </div>
              <div className="hrpc-field">
                <label htmlFor="meme-slip">Slippage %</label>
                <input
                  id="meme-slip"
                  className="hrpc-input hrpc-mono"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  inputMode="decimal"
                  placeholder="12"
                />
              </div>
            </div>

            <div className="hrpc-target hrpc-target-grow">
              <h3>Watch status</h3>
              {!watching ? (
                <p>Enter a ticker and arm to start watching deploys.</p>
              ) : (
                <>
                  <p>
                    <strong>
                      ${ticker.trim().replace(/^\$/, "").toUpperCase()}
                    </strong>{" "}
                    · {buyEth} ETH · {memeWalletIds.length || squad.length} wallets · {slippage}%
                    slip
                  </p>
                  <p>Listening for on-chain deploy…</p>
                </>
              )}
            </div>

            <div className="hrpc-snipe-actions">
              <button type="button" className="hrpc-btn" onClick={armMemecoin}>
                Arm sniper
              </button>
              <button
                type="button"
                className="hrpc-btn hrpc-btn-ghost"
                onClick={clearMeme}
              >
                Clear
              </button>
            </div>
          </div>
        </section>
      </div>

      <WalletPickerModal
        open={pickerFor !== null}
        selected={pickerSelected}
        wallets={squad}
        onClose={() => setPickerFor(null)}
        onConfirm={(ids) => {
          if (pickerFor === "meme") {
            setMemeWalletIds(ids);
            onToast(`> MEME SNIPER · ${ids.length} WALLETS SELECTED`);
          } else {
            setNftWalletIds(ids);
            onToast(`> NFT SNIPER · ${ids.length} WALLETS SELECTED`);
          }
        }}
      />
    </>
  );
}
