"use client";

import { useMemo, useState } from "react";
import WalletPickerModal, { FLEET } from "./WalletPickerModal";
import { HOOD_RPC_DEMO } from "@/lib/hood-rpc-demo";

type Props = {
  onToast: (msg: string) => void;
  connectedWallet: string | null;
};

type NftTarget = { label: string; ca: string; qty: string };

export default function HoodArmSnipers({ onToast, connectedWallet }: Props) {
  const [contractCa, setContractCa] = useState("");
  const [osUrl, setOsUrl] = useState("");
  const [spectrumUrl, setSpectrumUrl] = useState("");
  const [targets, setTargets] = useState<NftTarget[]>([
    { label: "", ca: "", qty: "1" },
  ]);
  const [nftWalletIds, setNftWalletIds] = useState<number[]>(() =>
    FLEET.slice(0, 10).map((w) => w.id),
  );
  const [pickerFor, setPickerFor] = useState<"nft" | "meme" | null>(null);
  const [gasMode, setGasMode] = useState<"normal" | "fast" | "hyper" | "manual">(
    "fast",
  );
  const [manualGwei, setManualGwei] = useState("75");

  const GAS_PRESETS = {
    normal: 30,
    fast: 50,
    hyper: 120,
  } as const;

  function currentGwei(): number {
    if (gasMode === "manual") {
      const n = parseFloat(manualGwei);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
    return GAS_PRESETS[gasMode];
  }

  const [ticker, setTicker] = useState("");
  const [buyEth, setBuyEth] = useState("0.25");
  const [memeWalletIds, setMemeWalletIds] = useState<number[]>(() =>
    FLEET.slice(0, 5).map((w) => w.id),
  );
  const [slippage, setSlippage] = useState("12");
  const [watching, setWatching] = useState(false);

  const pickerSelected = useMemo(
    () => (pickerFor === "meme" ? memeWalletIds : nftWalletIds),
    [pickerFor, memeWalletIds, nftWalletIds],
  );

  function requireWallet() {
    if (HOOD_RPC_DEMO) {
      if (!connectedWallet) {
        onToast("> CONNECT WALLET FIRST (top right)");
        return false;
      }
      return true;
    }
    if (!connectedWallet) {
      onToast("> CONNECT EVM WALLET FIRST");
      return false;
    }
    return true;
  }

  function demoArm(msg: string) {
    if (HOOD_RPC_DEMO) {
      onToast(`${msg} · DEMO · no real tx`);
      return true;
    }
    return false;
  }

  function armNftFromCa() {
    if (!requireWallet()) return;
    if (!contractCa.trim()) {
      onToast("> PASTE CONTRACT ADDRESS");
      return;
    }
    const msg = `> NFT SNIPER ARMED · ${contractCa.trim().slice(0, 14)}… · ${nftWalletIds.length} wallets`;
    if (demoArm(msg)) return;
    onToast(msg);
  }

  function armOpensea() {
    if (!requireWallet()) return;
    if (!osUrl.trim()) {
      onToast("> PASTE OPENSEA URL / SLUG");
      return;
    }
    const msg = `> OPENSEA MINT ARMED · ${nftWalletIds.length} wallets · ${osUrl.trim().slice(0, 24)}…`;
    if (demoArm(msg)) return;
    onToast(msg);
  }

  function armSpectrum() {
    if (!requireWallet()) return;
    if (!spectrumUrl.trim()) {
      onToast("> PASTE SPECTRUM / MINT URL");
      return;
    }
    const msg = `> SPECTRUM MINT ARMED · ${nftWalletIds.length} wallets`;
    if (demoArm(msg)) return;
    onToast(msg);
  }

  function saveTargetsAndArm() {
    if (!requireWallet()) return;
    const t = targets[0];
    if (!t.label.trim() && !t.ca.trim()) {
      onToast("> SET TARGET NAME OR CONTRACT");
      return;
    }
    if (!nftWalletIds.length) {
      onToast("> SELECT WALLETS FIRST");
      return;
    }
    const gwei = currentGwei();
    if (!gwei) {
      onToast("> ENTER MANUAL GWEI");
      return;
    }
    const msg = `> TARGET SAVED + MINT ARMED · ${t.label || t.ca.slice(0, 12)} · ${nftWalletIds.length} wallets · ${gwei} gwei`;
    if (demoArm(msg)) return;
    onToast(msg);
  }

  function armMemecoin() {
    if (!requireWallet()) return;
    const t = ticker.trim().replace(/^\$/, "").toUpperCase();
    if (!t) {
      onToast("> ENTER TICKER TO WATCH");
      return;
    }
    if (!memeWalletIds.length) {
      onToast("> SELECT WALLETS FIRST");
      return;
    }
    setWatching(true);
    const msg = `> MEME SNIPER ARMED · $${t} · ${buyEth} ETH · ${memeWalletIds.length} wallets · ${slippage}% slip`;
    if (demoArm(msg)) return;
    onToast(msg);
  }

  function clearMeme() {
    setWatching(false);
    setTicker("");
    onToast(HOOD_RPC_DEMO ? "> MEME SNIPER CLEARED · DEMO" : "> MEME SNIPER CLEARED");
  }

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
              <button type="button" className="hrpc-btn" onClick={armNftFromCa}>
                Arm mint
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
              <button type="button" className="hrpc-btn" onClick={armOpensea}>
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
              <button type="button" className="hrpc-btn" onClick={armSpectrum}>
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

            <div className="hrpc-gas-controls" aria-label="Gas presets">
              <span className="hrpc-preset-label">Gas (gwei)</span>
              <div className="hrpc-gas-row">
                <button
                  type="button"
                  className={`hrpc-btn ${gasMode === "normal" ? "" : "hrpc-btn-ghost"}`}
                  onClick={() => setGasMode("normal")}
                >
                  Normal · {GAS_PRESETS.normal}
                </button>
                <button
                  type="button"
                  className={`hrpc-btn ${gasMode === "fast" ? "" : "hrpc-btn-ghost"}`}
                  onClick={() => setGasMode("fast")}
                >
                  Fast · {GAS_PRESETS.fast}
                </button>
                <button
                  type="button"
                  className={`hrpc-btn ${gasMode === "hyper" ? "" : "hrpc-btn-ghost"}`}
                  onClick={() => setGasMode("hyper")}
                >
                  Hyper · {GAS_PRESETS.hyper}
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
            </div>

            <div className="hrpc-row-actions" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="hrpc-btn hrpc-btn-ghost"
                onClick={() => setPickerFor("nft")}
              >
                Select wallets ({nftWalletIds.length})
              </button>
              <button type="button" className="hrpc-btn" onClick={saveTargetsAndArm}>
                Save targets + arm mint
              </button>
            </div>
          </div>
        </section>

        <section
          className="hrpc-panel hrpc-arm-panel"
          id="arm-meme"
          aria-label="Arm sniper memecoins"
        >
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
                  Select wallets ({memeWalletIds.length})
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
                    · {buyEth} ETH · {memeWalletIds.length} wallets · {slippage}%
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
