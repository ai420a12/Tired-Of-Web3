"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { type Address, type Hex } from "viem";
import { SENSITIVE_INPUT_PROPS } from "@/lib/session-isolation";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";
import {
  addressFromPk,
  emptyRow,
  generateSquadWallet,
  extractPrivateKey,
  parseAddress,
  parsePasteWallets,
  shortAddr,
  type SquadWallet,
} from "@/lib/operator-wallets";
import {
  clearSquadSession,
  getMasterSessionPk,
  replaceSquadSession,
  setMasterSessionPk,
  squadSessionKeys,
  syncPkRef,
} from "@/lib/squad-session";
import {
  consolidateEth,
  consolidateNfts,
  formatEth,
  getNativeBalance,
  splitFromMaster,
} from "@/lib/operator-tx";
import { ToolHelp } from "./ToolTutorial";

type MintOutcome = {
  id: string;
  text: string;
  kind: "ok" | "err" | "info";
};

type Props = {
  onToast: (msg: string) => void;
  connectedWallet: string | null;
  apiBase: string;
  variant: HoodRpcVariant;
  squad: SquadWallet[];
  setSquad: (next: SquadWallet[] | ((prev: SquadWallet[]) => SquadWallet[])) => void;
  pkById: MutableRefObject<Map<number, Hex>>;
  pushOutcome: (text: string, kind?: MintOutcome["kind"]) => void;
  outcomes: MintOutcome[];
  tickerOutcomes: MintOutcome[];
};

const SPLIT_NS = [5, 10, 15, 20, 40, 60, 80, 100] as const;

export default function HoodTools({
  onToast,
  connectedWallet,
  apiBase,
  variant,
  squad,
  setSquad,
  pkById,
  pushOutcome,
  outcomes,
  tickerOutcomes,
}: Props) {
  const [pasteKeys, setPasteKeys] = useState("");
  const [workers, setWorkers] = useState(0);
  const [masterAddr, setMasterAddr] = useState("Not set — paste master key");
  const [masterPkInput, setMasterPkInput] = useState("");
  const [masterBal, setMasterBal] = useState("—");
  const masterPkRef = useRef<Hex | null>(null);
  const [nftTo, setNftTo] = useState("");
  const [ethTo, setEthTo] = useState("");
  const [genCount, setGenCount] = useState("5");
  const [genOut, setGenOut] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = getMasterSessionPk();
    if (!stored || masterPkRef.current) return;
    masterPkRef.current = stored;
    setMasterAddr(addressFromPk(stored));
  }, []);

  function requireWallet() {
    if (!connectedWallet) {
      onToast("> CONNECT WALLET FIRST (top right)");
      return false;
    }
    return true;
  }

  function copyWallet(addr: string) {
    if (!addr.startsWith("0x")) return;
    void navigator.clipboard.writeText(addr).then(
      () => onToast(`> COPIED · ${shortAddr(addr)}`),
      () => onToast("> COPY FAILED"),
    );
  }

  function copyKeysNow() {
    if (!genOut) return;
    void navigator.clipboard.writeText(genOut).then(
      () => {
        onToast("> KEYS COPIED · SAVE THEM ON YOUR PC NOW");
        pushOutcome("Generated keys copied — save them off this site", "ok");
      },
      () => onToast("> COPY FAILED"),
    );
  }

  useEffect(() => {
    if (connectedWallet) {
      setMasterAddr((prev) =>
        prev.startsWith("0x") ? prev : connectedWallet,
      );
      setNftTo((prev) => (parseAddress(prev) ? prev : connectedWallet));
      setEthTo((prev) => (parseAddress(prev) ? prev : connectedWallet));
    }
  }, [connectedWallet]);

  useEffect(() => {
    function wipeVisibleSecrets() {
      // Clear on-screen paste fields only. Session keys stay so sweep / arm /
      // split still work after tab backgrounding (mobile Safari pagehide).
      setPasteKeys("");
      setMasterPkInput("");
      setGenOut("");
    }
    window.addEventListener("pagehide", wipeVisibleSecrets);
    return () => {
      window.removeEventListener("pagehide", wipeVisibleSecrets);
    };
  }, []);

  useEffect(() => {
    if (!genOut) return;
    const id = window.setTimeout(() => setGenOut(""), 60_000);
    return () => window.clearTimeout(id);
  }, [genOut]);

  const totalEth = squad.reduce((s, r) => s + (parseFloat(r.logBal) || 0), 0);

  async function applyBalances(rows: SquadWallet[]) {
    if (!rows.length) return rows;
    const res = await fetch(`${apiBase}/balances`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ addresses: rows.map((r) => r.address) }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      balances?: { address: string; eth: number; usd: number; nfts: number }[];
    };
    if (!res.ok || !data.ok) return rows;
    const map = new Map(
      (data.balances || []).map((b) => [b.address.toLowerCase(), b]),
    );
    return rows.map((r) => {
      const hit = map.get(r.address.toLowerCase());
      if (!hit) return r;
      const eth = `${hit.eth.toFixed(4)} ETH`;
      return {
        ...r,
        time: "just now",
        logBal: eth,
        live: eth,
        usd: `$${hit.usd.toFixed(2)}`,
        nfts: hit.nfts,
        activity: "Balance refresh OK",
      };
    });
  }

  async function refreshBalances() {
    if (!requireWallet()) return;
    if (!squad.length) {
      onToast("> LOAD OR GENERATE SQUAD FIRST");
      return;
    }
    setBusy(true);
    try {
      const next = await applyBalances(squad);
      setSquad(next);
      onToast(`> BALANCES REFRESHED · ${next.length} WALLETS`);
      pushOutcome(`Balances refreshed · ${next.length} wallets`);
    } catch {
      onToast("> BALANCE REFRESH FAILED");
    } finally {
      setBusy(false);
    }
  }

  function bindSquad(rows: SquadWallet[], keys: { id: number; pk: Hex }[]) {
    replaceSquadSession(
      rows.map((w) => ({
        id: w.id,
        address: w.address,
        pk: keys.find((k) => k.id === w.id)?.pk,
      })),
    );
    syncPkRef(pkById);
    setSquad(rows);
    setWorkers(rows.length);
  }

  async function loadPasteKeys() {
    if (!requireWallet()) return;
    const parsed = parsePasteWallets(pasteKeys);
    setPasteKeys("");
    if (!parsed.length) {
      onToast("> PASTE PRIVATE KEYS (address-only cannot mint or sweep)");
      return;
    }
    const keys: { id: number; pk: Hex }[] = [];
    const rows: SquadWallet[] = parsed.map((item, i) => {
      const id = i + 1;
      if (item.pk) keys.push({ id, pk: item.pk });
      return emptyRow(
        id,
        item.address,
        `Wallet ${id}`,
        Boolean(item.pk),
        item.pk
          ? "Session key loaded"
          : "Address only — paste the private key to mint / sweep",
      );
    });
    bindSquad(rows, keys);

    const firstPk = keys[0]?.pk;
    if (firstPk && !masterPkRef.current && !getMasterSessionPk()) {
      masterPkRef.current = firstPk;
      setMasterSessionPk(firstPk);
      const addr = addressFromPk(firstPk);
      setMasterAddr(addr);
      setNftTo((prev) => (parseAddress(prev) ? prev : connectedWallet || addr));
      setEthTo((prev) => (parseAddress(prev) ? prev : connectedWallet || addr));
      try {
        const wei = await getNativeBalance(variant, addr);
        setMasterBal(`${formatEth(wei)} ETH`);
      } catch {
        setMasterBal("—");
      }
      pushOutcome(`Master auto-bound · ${shortAddr(addr)}`, "info");
    }

    setBusy(true);
    try {
      const withBal = await applyBalances(rows);
      setSquad(withBal);
      const keyed = keys.length;
      const watchOnly = rows.length - keyed;
      onToast(
        keyed
          ? `> LOADED ${keyed} SIGNING WALLET${keyed === 1 ? "" : "S"} INTO BOT`
          : `> LOADED ${rows.length} ADDRESS${rows.length === 1 ? "" : "ES"} — PASTE PRIVATE KEYS TO SIGN`,
      );
      pushOutcome(
        keyed
          ? `Loaded ${keyed} signing wallet${keyed === 1 ? "" : "s"} into bot${
              watchOnly ? ` · ${watchOnly} address-only` : ""
            }`
          : `Loaded ${rows.length} address-only wallet${rows.length === 1 ? "" : "s"} — paste private keys to mint / sweep`,
        keyed ? "ok" : "err",
      );
    } finally {
      setBusy(false);
    }
  }

  function destAddress(raw: string): Address | null {
    const typed = parseAddress(raw);
    if (typed) return typed;
    if (masterAddr.startsWith("0x")) {
      const master = parseAddress(masterAddr);
      if (master) return master;
    }
    if (connectedWallet) {
      const connected = parseAddress(connectedWallet);
      if (connected) return connected;
    }
    return null;
  }

  async function saveMaster() {
    if (!requireWallet()) return;
    const pk = extractPrivateKey(masterPkInput);
    setMasterPkInput("");
    if (!pk) {
      onToast("> PASTE MASTER PRIVATE KEY");
      return;
    }
    const addr = addressFromPk(pk);
    masterPkRef.current = pk;
    setMasterSessionPk(pk);
    setMasterAddr(addr);
    setNftTo((prev) => (parseAddress(prev) ? prev : addr));
    setEthTo((prev) => (parseAddress(prev) ? prev : addr));
    try {
      const wei = await getNativeBalance(variant, addr);
      setMasterBal(`${formatEth(wei)} ETH`);
    } catch {
      setMasterBal("—");
    }
    onToast(`> MASTER BOUND · ${shortAddr(addr)}`);
    pushOutcome(`Master bound · ${shortAddr(addr)}`);
  }

  async function splitTo(n: number) {
    if (!requireWallet()) return;
    const pk =
      masterPkRef.current ||
      getMasterSessionPk() ||
      squadSessionKeys()[0] ||
      null;
    if (!pk) {
      onToast("> SET MASTER PRIVATE KEY FIRST (or load a signing wallet)");
      pushOutcome(
        "Split failed · paste a master private key or load a squad key",
        "err",
      );
      return;
    }
    if (!masterPkRef.current) {
      masterPkRef.current = pk;
      setMasterSessionPk(pk);
    }
    if (!squad.length) {
      onToast("> LOAD OR GENERATE SQUAD WALLETS FIRST");
      return;
    }
    const count = Math.min(n, squad.length);
    if (count < n) {
      pushOutcome(
        `Split · only ${count} squad wallet${count === 1 ? "" : "s"} loaded · sending to those`,
        "info",
      );
    }
    const targets = squad.slice(0, count);
    const missing = targets.filter((w) => !w.address);
    if (missing.length) {
      onToast("> SQUAD WALLETS INVALID");
      return;
    }
    setBusy(true);
    try {
      const { hashes, perWei } = await splitFromMaster({
        variant,
        apiBase,
        masterPk: pk,
        recipients: targets.map((w) => w.address),
        onProgress: (text) => pushOutcome(text, "info"),
      });
      setWorkers(count);
      onToast(
        `> SPLIT SENT · ${hashes.length}/${count} WALLETS · ${formatEth(perWei)} ETH EACH`,
      );
      pushOutcome(
        `Master split → ${hashes.length}/${count} wallets · ${formatEth(perWei)} ETH · ${hashes[0]?.slice(0, 10)}…`,
        hashes.length === count ? "ok" : "err",
      );
      const next = await applyBalances(squad);
      setSquad(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SPLIT_FAILED";
      onToast(
        msg === "INSUFFICIENT_MASTER"
          ? "> MASTER NEEDS MORE ETH FOR GAS + SPLIT"
          : `> SPLIT FAILED · ${msg}`,
      );
      pushOutcome(`Split failed · ${msg}`, "err");
    } finally {
      setBusy(false);
    }
  }

  async function generateWallets() {
    if (!requireWallet()) return;
    const n = Math.min(100, Math.max(1, parseInt(genCount, 10) || 1));
    const rows: SquadWallet[] = [];
    const keys: { id: number; pk: Hex }[] = [];
    const lines: string[] = [];
    for (let i = 0; i < n; i++) {
      const { wallet, pk } = generateSquadWallet(i + 1);
      keys.push({ id: wallet.id, pk });
      rows.push(wallet);
      lines.push(
        `Wallet ${wallet.id}: ${wallet.address}`,
        `Private key: ${pk}`,
        "",
      );
    }
    bindSquad(rows, keys);
    setGenOut(lines.join("\n").trim());
    onToast(`> GENERATED ${n} WALLETS · COPY NOW · KEYS STAY IN THIS TAB`);
    pushOutcome(`Generated ${n} wallets (session)`);
  }

  async function sendNftConsolidate() {
    if (!requireWallet()) return;
    const to = destAddress(nftTo);
    if (!to) {
      onToast("> PASTE NFT RECIPIENT OR SET MASTER WALLET");
      pushOutcome("NFT sweep failed · paste master wallet", "err");
      return;
    }
    if (!nftTo.trim()) setNftTo(to);
    const keys = squadSessionKeys().length
      ? squadSessionKeys()
      : [...pkById.current.values()];
    if (!keys.length) {
      const why = squad.length
        ? "loaded wallets are address-only — paste the private key, not just the 0x address"
        : "generate or paste private keys first";
      onToast(`> SQUAD NEEDS SESSION KEYS · ${why.toUpperCase()}`);
      pushOutcome(`NFT sweep failed · ${why}`, "err");
      return;
    }
    const destLower = to.toLowerCase();
    const sources = keys.filter((pk) => addressFromPk(pk).toLowerCase() !== destLower);
    if (!sources.length) {
      onToast("> NFT SWEEP DEST IS THE SAME WALLET — PASTE A DIFFERENT RECIPIENT");
      pushOutcome(
        "NFT sweep failed · source and destination are the same wallet",
        "err",
      );
      return;
    }
    setBusy(true);
    pushOutcome(`NFT sweep → ${shortAddr(to)} · scanning squad…`);
    try {
      const result = await consolidateNfts({
        variant,
        apiBase,
        keys: sources,
        to,
        onProgress: (text) => pushOutcome(text, "info"),
      });
      onToast(`> NFT SWEPT · ${result.sent} SENT`);
      pushOutcome(
        `NFT sweep → ${shortAddr(to)} · ${result.sent} sent${
          result.skipped ? ` · ${result.skipped} skipped` : ""
        } · ${result.hashes[0]?.slice(0, 10)}…`,
        "ok",
      );
      setSquad(await applyBalances(squad));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SEND_FAILED";
      onToast(
        msg === "NO_NFTS"
          ? "> NO NFTS FOUND ON SQUAD YET · WAIT A FEW SEC AFTER BUY"
          : `> NFT SEND FAILED · ${msg}`,
      );
      pushOutcome(`NFT sweep failed · ${msg}`, "err");
    } finally {
      setBusy(false);
    }
  }

  async function sendEthConsolidate() {
    if (!requireWallet()) return;
    const to = destAddress(ethTo);
    if (!to) {
      onToast("> PASTE ETH RECIPIENT OR SET MASTER WALLET");
      return;
    }
    if (!ethTo.trim()) setEthTo(to);
    const keys = squadSessionKeys().length
      ? squadSessionKeys()
      : [...pkById.current.values()];
    if (!keys.length) {
      const why = squad.length
        ? "loaded wallets are address-only — paste the private key, not just the 0x address"
        : "generate or paste private keys first";
      onToast(`> SQUAD NEEDS SESSION KEYS · ${why.toUpperCase()}`);
      pushOutcome(`ETH sweep failed · ${why}`, "err");
      return;
    }
    const destLower = to.toLowerCase();
    const sources = keys.filter((pk) => addressFromPk(pk).toLowerCase() !== destLower);
    if (!sources.length) {
      onToast("> ETH SWEEP DEST IS THE SAME WALLET — PASTE A DIFFERENT RECIPIENT");
      pushOutcome(
        "ETH sweep failed · source and destination are the same wallet",
        "err",
      );
      return;
    }
    setBusy(true);
    pushOutcome(`ETH sweep → ${shortAddr(to)} · ${keys.length} wallets…`);
    try {
      const hashes = await consolidateEth({
        variant,
        apiBase,
        keys: sources,
        to,
        onProgress: (text) => pushOutcome(text, "info"),
      });
      onToast(`> ETH SWEPT · ${hashes.length} TXS`);
      pushOutcome(
        `ETH sweep → ${shortAddr(to)} · ${hashes.length} wallets emptied (gas dust only)`,
        "ok",
      );
      setSquad(await applyBalances(squad));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SEND_FAILED";
      onToast(
        msg === "NOTHING_TO_SEND"
          ? "> NO SPENDABLE ETH IN SQUAD"
          : `> ETH SEND FAILED · ${msg}`,
      );
      pushOutcome(`ETH sweep failed · ${msg}`, "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hrpc-tools" id="tools">
      <div className="hrpc-tools-head">
        <div>
          <h2 className="hrpc-section-title">Operator tools</h2>
        </div>
      </div>

      <section className="hrpc-panel hrpc-tut-anchor" aria-label="Squad and balances" id="squad">
        <ToolHelp tutorialId="squad" />
        <div className="hrpc-section-head">
          <div>
            <h3 className="hrpc-section-title hrpc-section-title-sm">
              Squad &amp; balances
            </h3>
          </div>
          <div className="hrpc-row-actions">
            <button
              type="button"
              className="hrpc-btn"
              onClick={() => void refreshBalances()}
              disabled={busy}
            >
              Refresh balances
            </button>
          </div>
        </div>

        <div className="hrpc-pulse">
          <div className="hrpc-stat">
            <div className="hrpc-stat-label">Wallets</div>
            <div className="hrpc-stat-value">{squad.length}</div>
          </div>
          <div className="hrpc-stat">
            <div className="hrpc-stat-label">Total ETH</div>
            <div className="hrpc-stat-value">{totalEth.toFixed(3)}</div>
          </div>
          <div className="hrpc-stat">
            <div className="hrpc-stat-label">Workers</div>
            <div className="hrpc-stat-value">{workers || squad.length}</div>
          </div>
          <div className="hrpc-stat">
            <div className="hrpc-stat-label">Gas</div>
            <div className="hrpc-stat-value">fast</div>
          </div>
        </div>

        <div className="hrpc-table-wrap hrpc-table-wrap-tall">
          {squad.length === 0 ? (
            <p className="hrpc-nft-empty">
              No squad yet — generate wallets or paste keys. Session only.
            </p>
          ) : (
            <table className="hrpc-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>ID</th>
                  <th>Time</th>
                  <th>Log bal</th>
                  <th>Activity</th>
                  <th>Wallet</th>
                  <th>Live</th>
                  <th>~USD</th>
                  <th>NFTs</th>
                </tr>
              </thead>
              <tbody>
                {squad.map((r) => (
                  <tr key={r.id} className="hrpc-row">
                    <td>{r.id}</td>
                    <td className="hrpc-mono">{r.time}</td>
                    <td className="hrpc-mono hrpc-lime">{r.logBal}</td>
                    <td className="hrpc-activity">
                      {r.hasKey ? "KEY" : "ADDR"} · {r.activity}
                    </td>
                    <td className="hrpc-mono hrpc-addr">
                      <button
                        type="button"
                        className="hrpc-addr-btn"
                        title="Click to copy"
                        onClick={() => copyWallet(r.address)}
                      >
                        {r.address}
                      </button>
                    </td>
                    <td className="hrpc-mono hrpc-lime">{r.live}</td>
                    <td className="hrpc-mono">{r.usd}</td>
                    <td>{r.nfts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <details className="hrpc-panel hrpc-details hrpc-tut-anchor" open id="load-wallets">
        <summary className="hrpc-section-title hrpc-section-title-sm">
          Load your wallets
        </summary>
        <ToolHelp tutorialId="load-wallets" />
        <textarea
          className="hrpc-textarea hrpc-mono"
          rows={6}
          value={pasteKeys}
          onChange={(e) => setPasteKeys(e.target.value)}
          placeholder={"Paste private keys, one per line\n0x…64-char key"}
          {...SENSITIVE_INPUT_PROPS}
        />
        <div className="hrpc-row-actions" style={{ marginTop: "0.5rem" }}>
          <button
            type="button"
            className="hrpc-btn"
            onClick={() => void loadPasteKeys()}
            disabled={busy}
          >
            Load into bot
          </button>
          <button
            type="button"
            className="hrpc-btn hrpc-btn-ghost"
            onClick={() => {
              setSquad([]);
              pkById.current.clear();
              clearSquadSession();
              masterPkRef.current = null;
              setPasteKeys("");
              onToast("> WALLETS CLEARED");
            }}
          >
            Clear
          </button>
        </div>
      </details>

      <details className="hrpc-panel hrpc-details hrpc-tut-anchor" open id="generate-wallets">
        <summary className="hrpc-section-title hrpc-section-title-sm">
          Generate Wallets
        </summary>
        <ToolHelp tutorialId="generate-wallets" />
        <p className="hrpc-key-warn">
          Save those keys to your pc we dont store any private information on
          the website.
        </p>
        <div className="hrpc-inline">
          <input
            className="hrpc-input hrpc-mono"
            style={{ maxWidth: 88 }}
            value={genCount}
            onChange={(e) => setGenCount(e.target.value)}
          />
          <button
            type="button"
            className="hrpc-btn"
            onClick={() => void generateWallets()}
            disabled={busy}
          >
            Generate
          </button>
        </div>
        {genOut ? (
          <div className="hrpc-inset" style={{ marginTop: "0.55rem" }}>
            <pre className="hrpc-keys hrpc-mono">{genOut}</pre>
            <div className="hrpc-copy-now-wrap">
              <button
                type="button"
                className="hrpc-copy-now"
                onClick={copyKeysNow}
              >
                Copy this now!
              </button>
              <button
                type="button"
                className="hrpc-btn hrpc-btn-ghost"
                onClick={() => setGenOut("")}
              >
                Clear from screen
              </button>
            </div>
          </div>
        ) : null}
      </details>

      <section className="hrpc-panel hrpc-tut-anchor" id="master-split">
        <ToolHelp tutorialId="master-split" />
        <h3 className="hrpc-section-title hrpc-section-title-sm">Master split</h3>
        <label className="hrpc-label">Master wallet</label>
        <div className="hrpc-inline">
          <button
            type="button"
            className="hrpc-master-addr hrpc-mono hrpc-addr-btn"
            title="Click to copy"
            onClick={() => copyWallet(masterAddr)}
          >
            {masterAddr}
          </button>
          <button
            type="button"
            className="hrpc-btn hrpc-btn-ghost"
            onClick={() => {
              if (masterAddr.startsWith("0x")) {
                void navigator.clipboard.writeText(masterAddr);
                onToast("> MASTER ADDRESS COPIED");
              }
            }}
          >
            Copy
          </button>
        </div>
        <p className="hrpc-mono hrpc-muted">{masterBal}</p>
        <div className="hrpc-inline" style={{ marginTop: "0.55rem" }}>
          <input
            type="password"
            className="hrpc-input hrpc-mono"
            placeholder="Paste master private key (session only)"
            value={masterPkInput}
            onChange={(e) => setMasterPkInput(e.target.value)}
            {...SENSITIVE_INPUT_PROPS}
          />
          <button
            type="button"
            className="hrpc-btn"
            onClick={() => void saveMaster()}
            disabled={busy}
          >
            Save
          </button>
        </div>

        <label className="hrpc-label" style={{ marginTop: "0.85rem" }}>
          Split across workers
        </label>
        <div className="hrpc-split-grid">
          {SPLIT_NS.map((n) => (
            <button
              key={n}
              type="button"
              className="hrpc-btn hrpc-btn-ghost"
              onClick={() => void splitTo(n)}
              disabled={busy}
            >
              {n} Wallets
            </button>
          ))}
        </div>

        <div className="hrpc-inline" style={{ marginTop: "0.75rem" }}>
          <input
            className="hrpc-input hrpc-mono hrpc-input-lime-ph"
            placeholder="Send all NFTs to master wallet (blank = master)"
            value={nftTo}
            onChange={(e) => setNftTo(e.target.value)}
          />
          <button
            type="button"
            className="hrpc-btn"
            onClick={() => void sendNftConsolidate()}
            disabled={busy}
          >
            Send now
          </button>
        </div>
        <div className="hrpc-inline" style={{ marginTop: "0.55rem" }}>
          <input
            className="hrpc-input hrpc-mono hrpc-input-lime-ph"
            placeholder="Send all crypto balance to master wallet (blank = master)"
            value={ethTo}
            onChange={(e) => setEthTo(e.target.value)}
          />
          <button
            type="button"
            className="hrpc-btn"
            onClick={() => void sendEthConsolidate()}
            disabled={busy}
          >
            Send now
          </button>
        </div>
      </section>

      <div className="hrpc-logs-grid">
        <details className="hrpc-panel hrpc-details hrpc-tut-anchor" open id="mint-outcomes">
          <summary className="hrpc-section-title hrpc-section-title-sm">
            Bot NFT outcomes
          </summary>
          <ToolHelp tutorialId="mint-outcomes" />
          <div className="hrpc-outcomes hrpc-mono">
            {outcomes.map((o) => (
              <div key={o.id} className={`hrpc-outcome hrpc-outcome-${o.kind}`}>
                &gt; {o.text}
              </div>
            ))}
          </div>
        </details>

        <details className="hrpc-panel hrpc-details hrpc-tut-anchor" open id="ticker-outcomes">
          <summary className="hrpc-section-title hrpc-section-title-sm">
            Bot ticker snipes outcomes
          </summary>
          <ToolHelp tutorialId="ticker-outcomes" />
          <div className="hrpc-outcomes hrpc-mono">
            {tickerOutcomes.map((o) => (
              <div key={o.id} className={`hrpc-outcome hrpc-outcome-${o.kind}`}>
                &gt; {o.text}
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
