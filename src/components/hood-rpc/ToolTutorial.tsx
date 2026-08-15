"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";
import {
  getToolTutorial,
  type ToolTutorialId,
} from "@/lib/tool-tutorials";

type Ctx = {
  variant: HoodRpcVariant;
  activeId: ToolTutorialId | null;
  start: (id: ToolTutorialId) => void;
  stop: () => void;
};

const TutorialCtx = createContext<Ctx | null>(null);

function pickUsVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const us = voices.filter((v) => /en-US/i.test(v.lang));
  const named =
    us.find((v) =>
      /Google US English|Samantha|Aaron|Daniel|Nicky|Microsoft (Aria|Guy|Jenny|Andrew|Davis)/i.test(
        v.name,
      ),
    ) || us[0];
  return (
    named ||
    voices.find((v) => /^en(-|$)/i.test(v.lang)) ||
    voices[0] ||
    null
  );
}

function firstMatch(selector?: string): HTMLElement | null {
  if (!selector) return null;
  for (const part of selector.split(",").map((s) => s.trim()).filter(Boolean)) {
    const el = document.querySelector(part);
    if (el instanceof HTMLElement) return el;
  }
  return null;
}

function wordsOf(text: string) {
  return text.split(/(\s+)/).filter((w) => w.length > 0);
}

function wordAt(text: string, charIndex: number) {
  const words = wordsOf(text);
  let pos = 0;
  let idx = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (charIndex >= pos && charIndex < pos + w.length && /\S/.test(w)) {
      idx = i;
      break;
    }
    if (/\S/.test(w)) idx = i;
    pos += w.length;
  }
  return idx;
}

export function ToolTutorialProvider({
  variant,
  children,
}: {
  variant: HoodRpcVariant;
  children: ReactNode;
}) {
  const [activeId, setActiveId] = useState<ToolTutorialId | null>(null);
  const stop = useCallback(() => {
    setActiveId(null);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);
  const start = useCallback((id: ToolTutorialId) => {
    window.speechSynthesis?.cancel();
    setActiveId(id);
  }, []);
  const value = useMemo(
    () => ({ variant, activeId, start, stop }),
    [variant, activeId, start, stop],
  );
  return (
    <TutorialCtx.Provider value={value}>
      {children}
      {activeId ? <ToolTutorialPlayer key={activeId} /> : null}
    </TutorialCtx.Provider>
  );
}

export function useToolTutorial() {
  const ctx = useContext(TutorialCtx);
  if (!ctx) {
    throw new Error("useToolTutorial requires ToolTutorialProvider");
  }
  return ctx;
}

export function ToolHelp({
  tutorialId,
  label = "Tutorial",
}: {
  tutorialId: ToolTutorialId;
  label?: string;
}) {
  const { start, activeId, stop } = useToolTutorial();
  const on = activeId === tutorialId;
  return (
    <button
      type="button"
      className={`hrpc-tut-btn${on ? " is-on" : ""}`}
      aria-label={`${label} — how this tool works`}
      title={`${label} — how this tool works`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (on) stop();
        else start(tutorialId);
      }}
    >
      ?
    </button>
  );
}

function ToolTutorialPlayer() {
  const { variant, activeId, stop } = useToolTutorial();
  const tutorial = activeId ? getToolTutorial(activeId, variant) : null;
  const [beatIdx, setBeatIdx] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [cursor, setCursor] = useState({ x: 48, y: 80, visible: false });
  const [spot, setSpot] = useState<DOMRect | null>(null);
  const run = useRef(0);
  const pos = useRef({ x: 48, y: 80 });

  const beat = tutorial?.beats[beatIdx] || null;

  const moveCursor = useCallback((el: HTMLElement | null) => {
    const fallback = {
      x: window.innerWidth - 72,
      y: 96,
    };
    const box = el?.getBoundingClientRect();
    const x = box ? box.left + Math.min(box.width * 0.55, 140) : fallback.x;
    const y = box ? box.top + Math.min(Math.max(box.height * 0.4, 18), 72) : fallback.y;
    setSpot(box || null);
    const startX = pos.current.x;
    const startY = pos.current.y;
    const t0 = performance.now();
    const dur = 420;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - t) ** 3;
      pos.current = {
        x: startX + (x - startX) * e,
        y: startY + (y - startY) * e,
      };
      setCursor({ ...pos.current, visible: true });
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const script = getToolTutorial(activeId, variant);
    const current = script.beats[beatIdx];
    if (!current) return;
    const token = ++run.current;
    let cancelled = false;

    async function play() {
      const el = firstMatch(current.target);
      el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      await new Promise((r) => window.setTimeout(r, 280));
      if (cancelled || token !== run.current) return;
      moveCursor(firstMatch(current.target));
      setCharIndex(0);

      if (!window.speechSynthesis) {
        const words = current.text.split(/\s+/).filter(Boolean);
        const step = Math.max(180, Math.min(320, 14000 / Math.max(words.length, 1)));
        for (let i = 0; i < words.length; i++) {
          if (cancelled || token !== run.current) return;
          const prefix = words.slice(0, i).join(" ");
          setCharIndex(prefix.length);
          await new Promise((r) => window.setTimeout(r, step));
        }
      } else {
        await new Promise<void>((resolve) => {
          const waitVoices = () => {
            if (window.speechSynthesis.getVoices().length) resolve();
            else window.setTimeout(resolve, 250);
          };
          window.speechSynthesis.addEventListener("voiceschanged", waitVoices, {
            once: true,
          });
          waitVoices();
        });
        if (cancelled || token !== run.current) return;
        await new Promise<void>((resolve) => {
          const u = new SpeechSynthesisUtterance(current.text);
          u.lang = "en-US";
          u.rate = 1.02;
          u.pitch = 1;
          const voice = pickUsVoice();
          if (voice) u.voice = voice;
          u.onboundary = (ev) => {
            if (cancelled || token !== run.current) return;
            if (typeof ev.charIndex === "number") setCharIndex(ev.charIndex);
          };
          u.onend = () => resolve();
          u.onerror = () => resolve();
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
        });
      }
      if (cancelled || token !== run.current) return;
      await new Promise((r) => window.setTimeout(r, current.holdMs ?? 280));
      if (cancelled || token !== run.current) return;
      setBeatIdx((i) => {
        if (i + 1 >= script.beats.length) {
          stop();
          return i;
        }
        return i + 1;
      });
    }

    void play();
    return () => {
      cancelled = true;
      window.speechSynthesis?.cancel();
    };
  }, [activeId, beatIdx, variant, moveCursor, stop]);

  useEffect(() => {
    if (!activeId) {
      setCursor((c) => ({ ...c, visible: false }));
      setSpot(null);
    }
  }, [activeId]);

  if (!tutorial || !beat) return null;

  const parts = wordsOf(beat.text);
  const hot = wordAt(beat.text, charIndex);

  return (
    <div className="hrpc-tut-stage" aria-live="polite">
      {spot ? (
        <div
          className="hrpc-tut-spot"
          style={{
            top: spot.top - 6,
            left: spot.left - 6,
            width: spot.width + 12,
            height: spot.height + 12,
          }}
        />
      ) : null}
      <div
        className={`hrpc-tut-cursor${cursor.visible ? " is-on" : ""}`}
        style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        aria-hidden
      >
        <svg width="28" height="28" viewBox="0 0 28 28">
          <path
            d="M4 3l16 8.2-7.1 2.1L10.6 24 4 3z"
            fill="var(--lime)"
            stroke="#000"
            strokeWidth="1.4"
          />
        </svg>
      </div>
      <div className="hrpc-tut-karaoke">
        <div className="hrpc-tut-karaoke-top">
          <span className="hrpc-tut-k-title">{tutorial.title}</span>
          <span className="hrpc-tut-k-step">
            {beatIdx + 1}/{tutorial.beats.length}
          </span>
          <button type="button" className="hrpc-tut-skip" onClick={stop}>
            Close
          </button>
        </div>
        <p className="hrpc-tut-line" aria-label={beat.text}>
          {parts.map((w, i) =>
            /\S/.test(w) ? (
              <span
                key={`${i}-${w}`}
                className={`hrpc-tut-word${i === hot ? " is-sing" : i < hot ? " is-done" : ""}`}
              >
                {w}
              </span>
            ) : (
              <span key={`${i}-s`}>{w}</span>
            ),
          )}
        </p>
      </div>
    </div>
  );
}
