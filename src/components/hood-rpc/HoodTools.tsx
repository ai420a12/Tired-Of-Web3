"use client";

import { useEffect, useState } from "react";
import { HOOD_RPC_DEMO } from "@/lib/hood-rpc-demo";
import { SENSITIVE_INPUT_PROPS } from "@/lib/session-isolation";

function looksLikePrivateKey(line: string) {
  const v = line.trim();
  return /^(0x)?[0-9a-fA-F]{64}$/.test(v);
}

type SquadRow = {
  id: number;
  time: string;
  logBal: string;
  activity: string;
  wallet: string;
  live: string;
  usd: string;
  nfts: number;
};

type MintOutcome = {
  id: string;
  text: string;
  kind: "ok" | "err" | "info";
};

type Props = {
  onToast: (msg: string) => void;
  connectedWallet: string | null;
};

const SPLIT_NS = [5, 10, 15, 20, 40, 60, 80, 100] as const;

function randHex(bytes: number) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function demoAddressFromPk(pk: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(pk),
  );
  const hex = [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex.slice(0, 40)}`;
}

function makeSquad(n: number, seed = 0): SquadRow[] {
  const acts = [
    "Initialized State: Active | Waiting…",
    "RPC synced — monitoring",
    "Insufficient Balance — top up",
    "Snipe armed · gas: fast",
    "Balance refresh OK",
    "Listening via WSS · worker alive",
  ];
  return Array.from({ length: n }, (_, i) => {
    const bal = (0.08 + i * 0.041 + (seed % 7) * 0.002).toFixed(4);
    return {
      id: i + 1,
      time: `${i + 1}m ago`,
      logBal: `${bal} ETH`,
      activity: acts[i % acts.length],
      wallet: `0x${(0xa1 + i).toString(16)}${"420a12ff".repeat(4).slice(0, 36)}${i.toString(16).padStart(2, "0")}`,
      live: `${bal} ETH`,
      usd: `$${(parseFloat(bal) * 3240).toFixed(2)}`,
      nfts: (i * 2 + 1) % 14,
    };
  });
}

export default function HoodTools({ onToast, connectedWallet }: Props) {
  const [squad, setSquad] = useState(() => makeSquad(8));
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteKeys, setPasteKeys] = useState("");
  const [wlKeys, setWlKeys] = useState("");
  const [wlStatus, setWlStatus] = useState("No WL temp keys loaded");
  const [outcomes, setOutcomes] = useState<MintOutcome[]>([
    {
      id: "1",
      text: HOOD_RPC_DEMO
        ? "Demo idle — no real txs (Connect Wallet to play)"
        : "Bot idle — waiting for arm",
      kind: "info",
    },
  ]);
  const [tickerOutcomes, setTickerOutcomes] = useState<MintOutcome[]>([
    {
      id: "t1",
      text: HOOD_RPC_DEMO
        ? "Demo ticker sniper — UI only"
        : "Ticker sniper idle — waiting for deploy",
      kind: "info",
    },
  ]);

  function requireDemo() {
    if (!HOOD_RPC_DEMO) return true;
    if (!connectedWallet) {
      onToast("> CONNECT WALLET FIRST (top right)");
      return false;
    }
    return true;
  }

  function demoToast(msg: string) {
    onToast(HOOD_RPC_DEMO ? `${msg} · DEMO · no real tx` : msg);
  }
  const [workers, setWorkers] = useState(10);
  const [masterAddr, setMasterAddr] = useState("Not set — paste master key");
  const [masterPk, setMasterPk] = useState("");
  const [masterBal, setMasterBal] = useState("—");
  const [nftTo, setNftTo] = useState("");
  const [ethTo, setEthTo] = useState("");
  const [genCount, setGenCount] = useState("5");
  const [genOut, setGenOut] = useState("");

  useEffect(() => {
    if (connectedWallet) {
      setMasterAddr(connectedWallet);
    }
  }, [connectedWallet]);

  /** Wipe secrets if this tab hides / unloads (defense in depth). */
  useEffect(() => {
    function wipeSecrets() {
      setPasteKeys("");
      setWlKeys("");
      setMasterPk("");
      setGenOut("");
    }
    const onVis = () => {
      if (document.visibilityState === "hidden") wipeSecrets();
    };
    window.addEventListener("pagehide", wipeSecrets);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      wipeSecrets();
      window.removeEventListener("pagehide", wipeSecrets);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (!genOut) return;
    const id = window.setTimeout(() => setGenOut(""), 60_000);
    return () => window.clearTimeout(id);
  }, [genOut]);

  useEffect(() => {
    const tickers = ["$HOODAI", "$SNIPE", "$LIME", "$RPCX", "$FEATHER"];
    const id = window.setInterval(() => {
      if (Math.random() > 0.55) return;
      const ticker = tickers[Math.floor(Math.random() * tickers.length)];
      const ok = Math.random() > 0.28;
      setTickerOutcomes((o) => [
        {
          id: String(Date.now()),
          text: ok
            ? `${ticker} sniped · fill ${(0.05 + Math.random() * 0.4).toFixed(3)} ETH`
            : `${ticker} miss · too late / slippage`,
          kind: ok ? "ok" : "err",
        },
        ...o.slice(0, 40),
      ]);
    }, 4500);
    return () => window.clearInterval(id);
  }, []);

  const totalEth = squad.reduce((s, r) => s + parseFloat(r.logBal), 0);

  function refreshBalances() {
    if (!requireDemo()) return;
    setSquad((prev) =>
      prev.map((r, i) => {
        const bal = (parseFloat(r.logBal) + (Math.random() - 0.4) * 0.01).toFixed(
          4,
        );
        return {
          ...r,
          time: "just now",
          logBal: `${Math.max(0, parseFloat(bal)).toFixed(4)} ETH`,
          live: `${Math.max(0, parseFloat(bal)).toFixed(4)} ETH`,
          usd: `$${(Math.max(0, parseFloat(bal)) * 3240).toFixed(2)}`,
          activity: "Balance refresh OK",
          nfts: r.nfts + (i % 3 === 0 ? 1 : 0),
        };
      }),
    );
    demoToast("> BALANCES REFRESHED");
  }

  async function loadPasteKeys() {
    if (!requireDemo()) return;
    const lines = pasteKeys
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("0x") && l.length >= 10)
      .slice(0, 60);
    setPasteKeys("");
    if (!lines.length) {
      onToast("> NO VALID 0x KEYS FOUND");
      return;
    }
    const rows: SquadRow[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isPk = looksLikePrivateKey(line);
      const wallet = isPk
        ? await demoAddressFromPk(line)
        : line.length > 42
          ? line.slice(0, 42)
          : line;
      rows.push({
        id: i + 1,
        time: "just now",
        logBal: "0.0000 ETH",
        activity: isPk
          ? "Session key loaded (demo · pk discarded)"
          : "Session address loaded (demo)",
        wallet,
        live: "0.0000 ETH",
        usd: "$0.00",
        nfts: 0,
      });
    }
    setSquad(rows);
    setPasteOpen(false);
    demoToast(`> LOADED ${rows.length} SESSION WALLETS · KEYS NOT STORED`);
  }

  function saveWl() {
    if (!requireDemo()) return;
    const lines = wlKeys
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 2);
    setWlKeys("");
    if (!lines.length) {
      onToast("> PASTE 1–2 WL KEYS");
      return;
    }
    setWlStatus(
      `${lines.length} WL temp key(s) acknowledged (demo · not persisted)`,
    );
    demoToast(`> WL WALLETS ACK · ${lines.length} · NOT SAVED TO DISK`);
  }

  async function saveMaster() {
    if (!requireDemo()) return;
    const pk = masterPk.trim();
    setMasterPk("");
    if (!pk.startsWith("0x") || pk.length < 10) {
      onToast("> PASTE MASTER PRIVATE KEY");
      return;
    }
    const addr = await demoAddressFromPk(pk);
    setMasterAddr(addr);
    setMasterBal("0.0000 ETH");
    demoToast(`> MASTER BOUND · ${addr.slice(0, 10)}… · PK DISCARDED`);
  }

  function splitTo(n: number) {
    if (!requireDemo()) return;
    if (!masterAddr.startsWith("0x")) {
      onToast("> SET MASTER WALLET FIRST");
      return;
    }
    setSquad(makeSquad(Math.min(n, 60), n));
    setWorkers(n);
    demoToast(`> SPLIT QUEUED · ${n} WALLETS`);
    setOutcomes((o) => [
      {
        id: String(Date.now()),
        text: `Demo master split → ${n} equal shares (no chain)`,
        kind: "ok",
      },
      ...o.slice(0, 40),
    ]);
  }

  async function generateWallets() {
    if (!requireDemo()) return;
    const n = Math.min(100, Math.max(1, parseInt(genCount, 10) || 1));
    const lines: string[] = [];
    for (let i = 0; i < n; i++) {
      const pk = `0x${randHex(32)}`;
      const addr = await demoAddressFromPk(pk);
      lines.push(`#${i + 1}  ${addr}  ${pk}`);
    }
    setGenOut(lines.join("\n"));
    demoToast(`> GENERATED ${n} DEMO WALLETS · AUTO-CLEARS IN 60s`);
  }

  return (
    <div className="hrpc-tools" id="tools">
      <div className="hrpc-tools-head">
        <div>
          <h2 className="hrpc-section-title">Operator tools</h2>
        </div>
      </div>

      <p className="hrpc-tools-safe">
        Security: private keys stay in this browser tab only — never uploaded.
        Switching or disconnecting your wallet hard-resets all tool fields.
        Demo mode does not broadcast real txs.
      </p>

      {/* Squad */}
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
              className="hrpc-btn hrpc-btn-ghost"
              onClick={() => setPasteOpen((v) => !v)}
            >
              Paste squad keys (session)
            </button>
            <button type="button" className="hrpc-btn" onClick={refreshBalances}>
              Refresh balances
            </button>
          </div>
        </div>

        {pasteOpen ? (
          <div className="hrpc-inset">
            <textarea
              className="hrpc-textarea hrpc-mono"
              rows={6}
              value={pasteKeys}
              onChange={(e) => setPasteKeys(e.target.value)}
              placeholder={"0x…\n0x…"}
              {...SENSITIVE_INPUT_PROPS}
            />
            <div className="hrpc-row-actions" style={{ marginTop: "0.5rem" }}>
              <button
                type="button"
                className="hrpc-btn"
                onClick={() => void loadPasteKeys()}
              >
                Load keys into bot
              </button>
              <button
                type="button"
                className="hrpc-btn hrpc-btn-ghost"
                onClick={() => {
                  setSquad(makeSquad(8));
                  setPasteKeys("");
                  onToast("> USING DEFAULT FLEET");
                }}
              >
                Use default fleet
              </button>
              <button
                type="button"
                className="hrpc-btn hrpc-btn-ghost"
                onClick={() => {
                  setPasteKeys("");
                  setPasteOpen(false);
                }}
              >
                Hide
              </button>
            </div>
          </div>
        ) : null}

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
            <div className="hrpc-stat-value">{workers}</div>
          </div>
          <div className="hrpc-stat">
            <div className="hrpc-stat-label">Gas</div>
            <div className="hrpc-stat-value">fast</div>
          </div>
        </div>

        <div className="hrpc-table-wrap hrpc-table-wrap-tall">
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
                  <td className="hrpc-mono hrpc-addr" title={r.wallet}>
                    {r.wallet}
                  </td>
                  <td className="hrpc-mono hrpc-lime">{r.live}</td>
                  <td className="hrpc-mono">{r.usd}</td>
                  <td>{r.nfts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* WL */}
      <details className="hrpc-panel hrpc-details" open id="wl-setup">
        <summary className="hrpc-section-title hrpc-section-title-sm">
          WL setup — paste / clear temp key
        </summary>
        <p className="hrpc-mono hrpc-muted">{wlStatus}</p>
        <textarea
          className="hrpc-textarea hrpc-mono"
          rows={4}
          value={wlKeys}
          onChange={(e) => setWlKeys(e.target.value)}
          placeholder={"0x… first key\n0x… second key"}
          {...SENSITIVE_INPUT_PROPS}
        />
        <div className="hrpc-row-actions" style={{ marginTop: "0.5rem" }}>
          <button type="button" className="hrpc-btn" onClick={saveWl}>
            Save WL wallets
          </button>
          <button
            type="button"
            className="hrpc-btn hrpc-btn-ghost"
            onClick={() => {
              setWlKeys("");
              setWlStatus("No WL temp keys loaded");
              onToast("> WL TEMP CLEARED");
            }}
          >
            Clear WL temp
          </button>
        </div>
      </details>

      {/* Generate wallets — between WL setup and Master split */}
      <details className="hrpc-panel hrpc-details" open id="generate-wallets">
        <summary className="hrpc-section-title hrpc-section-title-sm">
          Generate Wallets
        </summary>
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
          >
            Generate
          </button>
        </div>
        {genOut ? (
          <div className="hrpc-inset" style={{ marginTop: "0.55rem" }}>
            <p className="hrpc-tools-safe">
              DEMO keys only — copy offline now. Auto-clears in 60s. Never fund
              these on mainnet.
            </p>
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

      {/* Master split */}
      <section className="hrpc-panel" id="master-split">
        <h3 className="hrpc-section-title hrpc-section-title-sm">Master split</h3>
        <label className="hrpc-label">Master wallet</label>
        <div className="hrpc-inline">
          <div className="hrpc-master-addr hrpc-mono">{masterAddr}</div>
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
            value={masterPk}
            onChange={(e) => setMasterPk(e.target.value)}
            {...SENSITIVE_INPUT_PROPS}
          />
          <button type="button" className="hrpc-btn" onClick={() => void saveMaster()}>
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
              onClick={() => splitTo(n)}
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
              if (!requireDemo()) return;
              if (!nftTo.startsWith("0x")) {
                onToast("> PASTE NFT RECIPIENT");
                return;
              }
              demoToast("> NFT CONSOLIDATE QUEUED");
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
            onClick={() => {
              if (!requireDemo()) return;
              if (!ethTo.startsWith("0x")) {
                onToast("> PASTE ETH RECIPIENT");
                return;
              }
              demoToast("> ETH CONSOLIDATE QUEUED");
            }}
          >
            Send now
          </button>
        </div>
      </section>

      {/* Logs — both at the bottom */}
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
