"use client";

import { useEffect } from "react";
import ChainSwitcher from "@/components/hood-rpc/ChainSwitcher";
import "./eth-forge.css";

export default function EthForgePage() {
  useEffect(() => {
    const $ = (id: string) =>
      document.getElementById(id) as
        | (HTMLElement & { value?: string; hidden?: boolean })
        | null;

    type ForgeProvider = {
      id: string;
      label: string;
      ready: boolean;
      note?: string;
    };

    type ForgePresetLayer = {
      name: string;
      options: Array<{ value: string; weight: number }>;
    };

    type ForgePresetsResponse = {
      styles: Record<string, string>;
      default_provider: string;
      default_layers: ForgePresetLayer[];
      providers: ForgeProvider[];
    };

    type ForgeHealthResponse = {
      gemini: boolean;
      openai: boolean;
      default_provider: string;
    };

    type TraitOption = { value: string; weight: number } | string;
    type TraitLayer = { name: string; options: TraitOption[] };

    let mode = "collection";
    let defaultLayers: TraitLayer[] = [];
    let pollTimer: number | null = null;
    let refSession: string | null = null;

    async function loadPresets() {
      const r = await fetch("/api/hood-rpc/eth-forge/presets");
      const j = (await r.json()) as ForgePresetsResponse;

      const styleSel = $("style") as HTMLSelectElement | null;
      if (styleSel) {
        styleSel.innerHTML = "";
        Object.keys(j.styles || {}).forEach((k) => {
          const opt = document.createElement("option");
          opt.value = k;
          opt.textContent = k;
          styleSel.appendChild(opt);
        });
      }

      const providerSel = $("provider") as HTMLSelectElement | null;
      if (providerSel) {
        providerSel.innerHTML = "";
        (j.providers || []).forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = p.ready ? p.label : `${p.label} — needs key`;
          opt.disabled = !p.ready && p.id !== "pollinations" && p.id !== "procedural";
          opt.title = p.note || "";
          providerSel.appendChild(opt);
        });
        if (j.default_provider) providerSel.value = j.default_provider;
      }

      defaultLayers = j.default_layers || [];
      renderLayers(defaultLayers);

      const h = await fetch("/api/hood-rpc/eth-forge/health").then((x) =>
        x.json(),
      );
      const health = (h as unknown) as ForgeHealthResponse;
      const keyStatus = $("keyStatus");
      if (keyStatus) {
        const bits = [];
        bits.push(health.gemini ? "Gemini ✓" : "Gemini ✗");
        bits.push(health.openai ? "OpenAI ✓" : "OpenAI ✗");
        keyStatus.textContent =
          bits.join(" · ") + ` · default ${health.default_provider}`;
      }
    }

    function renderLayers(layers: TraitLayer[]) {
      const root = $("layersEditor");
      if (!root) return;
      root.innerHTML = "";
      layers.forEach((layer) => {
        const card = document.createElement("div");
        card.className = "layer-card";
        const name = document.createElement("input");
        name.type = "text";
        name.value = layer.name;
        const area = document.createElement("textarea");
        area.value = (layer.options || [])
          .map((o) => (typeof o === "string" ? o : `${o.value}: ${o.weight ?? 1}`))
          .join("\n");
        card.appendChild(name);
        card.appendChild(area);
        root.appendChild(card);
      });
    }

    function readLayers(): TraitLayer[] {
      const root = $("layersEditor");
      if (!root) return [];
      const cards = root.querySelectorAll(".layer-card");
      return [...cards]
        .map((card) => {
          const nameEl = card.querySelector("input") as HTMLInputElement | null;
          const areaEl = card.querySelector("textarea") as HTMLTextAreaElement | null;
          const name = nameEl?.value.trim() || "";
          const options = (areaEl?.value || "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              const m = line.match(/^(.*?)\s*:\s*([0-9.]+)\s*$/);
              if (m) return { value: m[1].trim(), weight: Number(m[2]) || 1 };
              return { value: line, weight: 1 };
            });
          return { name, options };
        })
        .filter((l) => l.name && l.options.length);
    }

    document.querySelectorAll<HTMLButtonElement>(".mode").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll<HTMLButtonElement>(".mode")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        mode = btn.dataset.mode || "collection";
        const traitsBox = $("traitsBox") as HTMLDetailsElement | null;
        if (traitsBox) traitsBox.open = mode === "wizard";
        const size = $("size") as HTMLInputElement | null;
        if (size && mode === "single") size.value = "1";
      });
    });

    const resetBtn = $("resetLayers") as HTMLButtonElement | null;
    resetBtn?.addEventListener("click", () => renderLayers(defaultLayers));

    async function uploadRefs(fileList: FileList | File[]) {
      const files = [...fileList]
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, 8);
      if (!files.length) return;

      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));

      const message = $("message");
      if (message) message.textContent = "Uploading references…";

      const r = await fetch("/api/hood-rpc/eth-forge/refs", {
        method: "POST",
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Upload failed");

      refSession = j.ref_session;
      const box = $("refPreview");
      if (box) {
        box.innerHTML = "";
        (j.previews || []).forEach((src: string) => {
          const img = document.createElement("img");
          img.src = src;
          img.alt = "ref";
          box.appendChild(img);
        });
      }

      const clearRefsBtn = $("clearRefs") as HTMLButtonElement | null;
      if (clearRefsBtn) {
        clearRefsBtn.hidden = false;
      }
      if (message) message.textContent = `${j.count} reference image(s) ready`;
    }

    const refFiles = $("refFiles") as HTMLInputElement | null;
    refFiles?.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (!target.files) return;
      uploadRefs(target.files).catch((err) => {
        const message = $("message");
        if (message) message.textContent = String(err.message || err);
      });
    });

    const dz = $("dropzone") as HTMLElement | null;
    dz?.addEventListener("dragover", (e) => {
      e.preventDefault();
      dz.classList.add("hot");
    });
    dz?.addEventListener("dragleave", () => dz.classList.remove("hot"));
    dz?.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("hot");
      const dt = e.dataTransfer;
      if (!dt?.files || dt.files.length === 0) return;
      uploadRefs(dt.files).catch((err) => {
        const message = $("message");
        if (message) message.textContent = String(err.message || err);
      });
    });

    const clearRefsBtn = $("clearRefs") as HTMLButtonElement | null;
    clearRefsBtn?.addEventListener("click", async () => {
      if (refSession) {
        await fetch(`/api/hood-rpc/eth-forge/refs/${refSession}`, {
          method: "DELETE",
        });
      }
      refSession = null;
      const box = $("refPreview");
      if (box) box.innerHTML = "";
      if (clearRefsBtn) clearRefsBtn.hidden = true;
      if (refFiles) refFiles.value = "";
    });

    function setStatus(kind: string, text: string) {
      const el = $("status");
      if (!el) return;
      el.className = `status ${kind}`;
      el.textContent = text;
    }

    async function poll(jobId: string) {
      const r = await fetch(`/api/hood-rpc/eth-forge/jobs/${jobId}`);
      const j = await r.json();
      const pct = j.total ? Math.round((j.progress / j.total) * 100) : 0;

      const bar = $("bar") as HTMLDivElement | null;
      if (bar) bar.style.width = `${pct}%`;

      const message = $("message");
      if (message) message.textContent = j.message || "";

      setStatus(
        j.status === "done"
          ? "done"
          : j.status === "error"
            ? "error"
            : "running",
        j.status,
      );

      const prev = $("preview");
      if (prev) {
        prev.innerHTML = "";
        (j.preview || []).forEach((src: string) => {
          const img = document.createElement("img");
          img.src = src;
          img.alt = "preview";
          prev.appendChild(img);
        });
      }

      if (j.status === "done") {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;

        const actions = $("resultActions");
        if (actions) actions.hidden = false;
        const downloadZip = $("downloadZip") as HTMLAnchorElement | null;
        if (downloadZip) downloadZip.href = j.zip_url;
        const openFolder = $("openFolder") as HTMLAnchorElement | null;
        if (openFolder) openFolder.href = j.folder;

        const genBtn = $("generateBtn") as HTMLButtonElement | null;
        if (genBtn) genBtn.disabled = false;
        if (j.error && message) message.textContent += ` · ${j.error}`;
      } else if (j.status === "error") {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;

        const genBtn = $("generateBtn") as HTMLButtonElement | null;
        if (genBtn) genBtn.disabled = false;

        if (message) message.textContent = j.error || "Failed";
      }
    }

    const genBtn = $("generateBtn") as HTMLButtonElement | null;
    genBtn?.addEventListener("click", async () => {
      const promptEl = $("prompt") as HTMLTextAreaElement | null;
      const prompt = promptEl?.value.trim() || "";
      if (!prompt) {
        const message = $("message");
        if (message) message.textContent = "Add a prompt first.";
        return;
      }

      if (genBtn) genBtn.disabled = true;

      const resultActions = $("resultActions");
      if (resultActions) resultActions.hidden = true;
      const prev = $("preview");
      if (prev) prev.innerHTML = "";
      const bar = $("bar") as HTMLDivElement | null;
      if (bar) bar.style.width = "0%";

      setStatus("running", "starting");

      const message = $("message");
      if (message) message.textContent = "Queued…";

      const provider = (($("provider") as HTMLSelectElement | null)?.value ||
        "flux") as string;

      const name = (($("name") as HTMLInputElement | null)?.value || "Collection")
        .trim()
        .replace(/^$/, "Collection");

      const description = (($("description") as HTMLInputElement | null)?.value || "")
        .trim()
        .replace(/^$/, "Generated locally with NFT Forge.");

      const sizeVal = Number(($("size") as HTMLInputElement | null)?.value || 1);

      const body: {
        mode: string;
        prompt: string;
        name: string;
        description: string;
        size: number;
        style: string;
        provider: string;
        concurrency: number;
        layers: TraitLayer[];
        image_size: number;
        ref_session?: string;
        seed?: number;
      } = {
        mode,
        prompt,
        name,
        description,
        size: Number.isFinite(sizeVal) ? sizeVal : 1,
        style: (($("style") as HTMLSelectElement | null)?.value ||
          "cartoon") as string,
        provider,
        concurrency: ["flux", "flux_dev", "zimage", "klein"].includes(provider)
          ? 1
          : 2,
        layers: readLayers(),
        image_size: 1024,
      };

      if (refSession) body.ref_session = refSession;

      const seedVal = (($("seed") as HTMLInputElement | null)?.value || "").trim();
      if (seedVal !== "") body.seed = Number(seedVal);

      try {
        const r = await fetch("/api/hood-rpc/eth-forge/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await r.json();

        if (!r.ok) {
          const detail = j.detail;
          throw new Error(typeof detail === "string" ? detail : JSON.stringify(j));
        }

        if (pollTimer) clearInterval(pollTimer);
        pollTimer = window.setInterval(() => poll(j.job_id), 1000);
        poll(j.job_id);
      } catch (e: unknown) {
        setStatus("error", "error");
        if (message)
          message.textContent =
            e instanceof Error ? e.message : String(e);
        if (genBtn) genBtn.disabled = false;
      }
    });

    loadPresets().catch((e) => {
      const message = $("message");
      if (message) message.textContent = "Failed to load presets: " + e;
    });
  }, []);

  return (
    <div className="hrpc eth-forge">
      <div className="bg" />

      <nav className="hrpc-nav">
        <div className="hrpc-nav-left">
          <ChainSwitcher />
          <a className="hrpc-brand" href="/hood-rpc/eth">
            <span className="hrpc-wordmark">ETH_RPC</span>
          </a>
        </div>
        <div />
        <div className="hrpc-nav-right" />
      </nav>

      <header className="top">
        <div className="brand">
          <span className="mark">NF</span>
          <div>
            <strong>NFT Forge</strong>
            <small id="keyStatus">checking keys…</small>
          </div>
        </div>
        <div className="top-meta">Flux · refs · OpenSea metadata</div>
      </header>

      <main className="shell">
        <section className="panel form-panel">
          <div className="modes" role="tablist">
            <button type="button" className="mode active" data-mode="collection">
              Collection
            </button>
            <button type="button" className="mode" data-mode="wizard">
              Wizard
            </button>
            <button type="button" className="mode" data-mode="single">
              Single
            </button>
          </div>

          <label className="field">
            <span>Prompt</span>
            <textarea
              id="prompt"
              rows={3}
              placeholder="pixel punk character, clean pixel art, no shadows, solid color background…"
            />
          </label>

          <div className="ref-block">
            <div className="ref-head">
              <span>Reference images</span>
              <button type="button" className="ghost tiny" id="clearRefs" hidden>
                Clear
              </button>
            </div>
            <p className="hint">Drop 1–8 style / character refs. Gemini will match them across the whole batch.</p>
            <label className="drop" id="dropzone">
              <input id="refFiles" type="file" accept="image/*" multiple hidden />
              <span>Click or drop images here</span>
            </label>
            <div className="ref-preview" id="refPreview" />
          </div>

          <div className="grid-2">
            <label className="field">
              <span>Collection name</span>
              <input id="name" type="text" value="Hood Batch" />
            </label>
            <label className="field">
              <span>Style</span>
              <select id="style" />
            </label>
          </div>

          <label className="field">
            <span>Description</span>
            <input
              id="description"
              type="text"
              value="Generated locally with NFT Forge."
            />
          </label>

          <div className="grid-3">
            <label className="field">
              <span>Size</span>
              <input id="size" type="number" min={1} max={200} defaultValue={8} />
            </label>
            <label className="field">
              <span>AI model</span>
              <select id="provider" />
            </label>
            <label className="field">
              <span>Seed</span>
              <input id="seed" type="number" placeholder="random" />
            </label>
          </div>

          <details id="traitsBox" className="traits">
            <summary>Trait layers</summary>
            <p className="hint">
              One option per line as <code>name: weight</code>. Lower weight =
              rarer.
            </p>
            <div id="layersEditor" />
            <button type="button" className="ghost" id="resetLayers">
              Reset defaults
            </button>
          </details>

          <div className="actions">
            <button type="button" className="primary" id="generateBtn">
              Generate
            </button>
            <p className="hint" id="limitHint">
              Default is free <strong>Flux</strong> via Pollinations. Keep batch size small (rate limits).
            </p>
          </div>
        </section>

        <section className="panel result-panel">
          <div className="result-head">
            <h2>Output</h2>
            <div id="status" className="status idle">
              Idle
            </div>
          </div>
          <div className="progress">
            <div id="bar" />
          </div>
          <p id="message" className="msg">
            Add a prompt + optional refs, then generate.
          </p>
          <div className="preview" id="preview" />
          <div className="result-actions" id="resultActions" hidden>
            <a className="primary" id="downloadZip" href="#" download>
              Download ZIP
            </a>
            <a className="ghost" id="openFolder" href="#" target="_blank" rel="noreferrer">
              Open pack
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

