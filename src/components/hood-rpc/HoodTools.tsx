"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { isAddress, type Address, type Hex } from "viem";
import { SENSITIVE_INPUT_PROPS } from "@/lib/session-isolation";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";
import {
  addressFromPk,
  emptyRow,
  generateSquadWallet,
  normalizePk,
  parseAddress,
  shortAddr,
  type SquadWallet,
} from "@/lib/operator-wallets";
import {
  consolidateEth,
  formatEth,
  getNativeBalance,
  splitFromMaster,
} from "@/lib/operator-tx";

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

  useEffect(() => {
    if (connectedWallet) {
      setMasterAddr((prev) =>
        prev.startsWith("0x") ? prev : connectedWallet,
      );
    }
  }, [connectedWallet]);

  useEffect(() => {
    function wipeSecrets() {
      setPasteKeys("");
      setMasterPkInput("");
      setGenOut("");
      masterPkRef.current = null;
      pkById.current.clear();
    }
    window.addEventListener("pagehide", wipeSecrets);
    return () => {
      window.removeEventListener("pagehide", wipeSecrets);
    };
  }, [pkById]);

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

  async function loadPasteKeys() {
    if (!requireWallet()) return;
    const lines = pasteKeys
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 80);
    setPasteKeys("");
    if (!lines.length) {
      onToast("> NO KEYS / ADDRESSES FOUND");
      return;
    }
    pkById.current.clear();
    const rows: SquadWallet[] = [];
    for (let i = 0; i < lines.length; i++) {
      const id = i + 1;
      const pk = normalizePk(lines[i]);
      if (pk) {
        const address = addressFromPk(pk);
        pkById.current.set(id, pk);
        rows.push(
          emptyRow(id, address, `Wallet ${id}`, true, "Session key loaded"),
        );
        continue;
      }
      const addr = parseAddress(lines[i]);
      if (addr) {
        rows.push(
          emptyRow(id, addr, `Wallet ${id}`, false, "Address loaded"),
        );
      }
    }
    if (!rows.length) {
      onToast("> NO VALID KEYS OR ADDRESSES");
      return;
    }
    setBusy(true);
    try {
      const withBal = await applyBalances(rows);
      setSquad(withBal);
      setWorkers(withBal.length);
      onToast(`> LOADED ${withBal.length} WALLETS INTO BOT`);
      pushOutcome(`Loaded ${withBal.length} wallets into bot`);
    } finally {
      setBusy(false);
    }
  }

  async function saveMaster() {
    if (!requireWallet()) return;
    const pk = normalizePk(masterPkInput);
    setMasterPkInput("");
    if (!pk) {
      onToast("> PASTE MASTER PRIVATE KEY");
      return;
    }
    const addr = addressFromPk(pk);
    masterPkRef.current = pk;
    setMasterAddr(addr);
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
    const pk = masterPkRef.current;
    if (!pk) {
      onToast("> SET MASTER PRIVATE KEY FIRST");
      return;
    }
    if (squad.length < n) {
      onToast(`> NEED ${n} SQUAD WALLETS · GENERATE OR PASTE FIRST`);
      return;
    }
    const targets = squad.slice(0, n);
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
      });
      setWorkers(n);
      onToast(`> SPLIT SENT · ${n} WALLETS · ${formatEth(perWei)} ETH EACH`);
      pushOutcome(
        `Master split → ${n} wallets · ${formatEth(perWei)} ETH · ${hashes[0]?.slice(0, 10)}…`,
        "ok",
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
    pkById.current.clear();
    const rows: SquadWallet[] = [];
    const lines: string[] = [];
    for (let i = 0; i < n; i++) {
      const { wallet, pk } = generateSquadWallet(i + 1);
      pkById.current.set(wallet.id, pk);
      rows.push(wallet);
      lines.push(`#${wallet.id}  ${wallet.address}  ${pk}`);
    }
    setSquad(rows);
    setWorkers(n);
    setGenOut(lines.join("\n"));
    onToast(`> GENERATED ${n} WALLETS · COPY NOW · KEYS STAY IN THIS TAB`);
    pushOutcome(`Generated ${n} wallets (session)`);
  }

  async function sendEthConsolidate() {
    if (!requireWallet()) return;
    if (!isAddress(ethTo)) {
      onToast("> PASTE ETH RECIPIENT");
      return;
    }
    const keys = [...pkById.current.values()];
    if (!keys.length) {
      onToast("> SQUAD NEEDS SESSION KEYS (GENERATE / PASTE PKS)");
      return;
    }
    setBusy(true);
    try {
      const hashes = await consolidateEth({
        variant,
        apiBase,
        keys,
        to: ethTo as Address,
      });
      onToast(`> ETH SENT · ${hashes.length} TXS`);
      pushOutcome(
        `ETH consolidate · ${hashes.length} txs · ${shortAddr(ethTo)}`,
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
      pushOutcome(`ETH consolidate failed · ${msg}`, "err");
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

      <section className="hrpc-panel" aria-label="Squad and balances" id="squad">
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
                    <td className="hrpc-activity">{r.activity}</td>
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

      <details className="hrpc-panel hrpc-details" open id="load-wallets">
        <summary className="hrpc-section-title hrpc-section-title-sm">
          Load your wallets
        </summary>
        <textarea
          className="hrpc-textarea hrpc-mono"
          rows={6}
          value={pasteKeys}
          onChange={(e) => setPasteKeys(e.target.value)}
          placeholder={"0x… private key or address\n0x…"}
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
              setPasteKeys("");
              onToast("> WALLETS CLEARED");
            }}
          >
            Clear
          </button>
        </div>
      </details>

      <details className="hrpc-panel hrpc-details" open id="generate-wallets">
        <summary className="hrpc-section-title hrpc-section-title-sm">
          Generate Wallets
        </summary>
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
            <button
              type="button"
              className="hrpc-btn hrpc-btn-ghost"
              style={{ marginTop: "0.45rem" }}
              onClick={() => setGenOut("")}
            >
              Clear from screen
            </button>
          </div>
        ) : null}
      </details>

      <section className="hrpc-panel" id="master-split">
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
            placeholder="Send all NFTs to master wallet"
            value={nftTo}
            onChange={(e) => setNftTo(e.target.value)}
          />
          <button
            type="button"
            className="hrpc-btn"
            onClick={() => {
              if (!isAddress(nftTo)) {
                onToast("> PASTE NFT RECIPIENT");
                return;
              }
              onToast("> NFT CONSOLIDATE COMING SOON");
              pushOutcome("NFT consolidate · coming soon", "info");
            }}
          >
            Send now
          </button>
        </div>
        <div className="hrpc-inline" style={{ marginTop: "0.55rem" }}>
          <input
            className="hrpc-input hrpc-mono hrpc-input-lime-ph"
            placeholder="Send all crypto balance to master wallet"
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
        <details className="hrpc-panel hrpc-details" open id="mint-outcomes">
          <summary className="hrpc-section-title hrpc-section-title-sm">
            Bot mint outcomes
          </summary>
          <div className="hrpc-outcomes hrpc-mono">
            {outcomes.map((o) => (
              <div key={o.id} className={`hrpc-outcome hrpc-outcome-${o.kind}`}>
                &gt; {o.text}
              </div>
            ))}
          </div>
        </details>

        <details className="hrpc-panel hrpc-details" open id="ticker-outcomes">
          <summary className="hrpc-section-title hrpc-section-title-sm">
            Bot ticker snipes outcomes
          </summary>
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
