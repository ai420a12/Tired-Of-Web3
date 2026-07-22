"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import Link from "next/link";
import { LINKS } from "@/lib/constants";
import {
  WL_TASKS,
  isValidEthWallet,
  isValidXPostUrl,
  isValidWhyTired,
  parseXProfileInput,
  type WlTaskId,
} from "@/lib/wl";
import { playClick, playSigh, playTyping } from "@/lib/sounds";
import GlitchText from "@/components/effects/GlitchText";
import Mascot from "@/components/mascot/Mascot";

type TasksState = Record<WlTaskId, boolean>;
type LinksState = { follow: string; share: string; tag: string };

export default function WhitelistForm() {
  const [wallet, setWallet] = useState("");
  const [whyTired, setWhyTired] = useState("");
  const [verificationLinks, setVerificationLinks] = useState<LinksState>({
    follow: "",
    share: "",
    tag: "",
  });
  const [tasks, setTasks] = useState<TasksState>({
    follow: false,
    share: false,
    tag: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submittedHandle, setSubmittedHandle] = useState("");
  const [submittedWallet, setSubmittedWallet] = useState("");

  const xHandle = parseXProfileInput(verificationLinks.follow);
  const followOk = Boolean(xHandle);
  const shareLinkOk = isValidXPostUrl(verificationLinks.share);
  const tagLinkOk = isValidXPostUrl(verificationLinks.tag);
  const whyTiredOk = isValidWhyTired(whyTired);
  const allTasksDone = tasks.follow && tasks.share && tasks.tag;

  const canSubmit =
    followOk &&
    allTasksDone &&
    shareLinkOk &&
    tagLinkOk &&
    whyTiredOk &&
    isValidEthWallet(wallet) &&
    !submitting;

  const progress = useMemo(() => {
    let n = 0;
    if (tasks.follow && followOk) n += 1;
    if (tasks.share && shareLinkOk) n += 1;
    if (tasks.tag && tagLinkOk) n += 1;
    if (whyTiredOk) n += 1;
    if (isValidEthWallet(wallet)) n += 1;
    return n;
  }, [tasks, followOk, shareLinkOk, tagLinkOk, whyTiredOk, wallet]);

  const totalSteps = 5;

  const toggleTask = (id: WlTaskId) => {
    if (id === "follow" && !followOk) {
      setError("Add your X @handle or profile link before marking Follow as done.");
      playSigh();
      return;
    }
    if (id === "share" && !shareLinkOk) {
      setError("Paste a valid quote-tweet link before marking Quote as done.");
      playSigh();
      return;
    }
    if (id === "tag" && !tagLinkOk) {
      setError("Paste a valid comment link before marking Tag as done.");
      playSigh();
      return;
    }
    playClick();
    setError("");
    setTasks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateLink = (id: WlTaskId, value: string) => {
    setVerificationLinks((prev) => ({ ...prev, [id]: value }));
    if (id === "follow" && tasks.follow && !parseXProfileInput(value)) {
      setTasks((prev) => ({ ...prev, follow: false }));
    }
    if (id === "share" && tasks.share && !isValidXPostUrl(value)) {
      setTasks((prev) => ({ ...prev, share: false }));
    }
    if (id === "tag" && tasks.tag && !isValidXPostUrl(value)) {
      setTasks((prev) => ({ ...prev, tag: false }));
    }
  };

  const submit = async () => {
    if (!canSubmit || !xHandle) return;
    setSubmitting(true);
    setError("");
    playTyping();

    try {
      const res = await fetch("/api/wl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xHandle,
          xProfile: verificationLinks.follow.trim(),
          wallet,
          whyTired: whyTired.trim(),
          verificationLinks: {
            share: verificationLinks.share.trim(),
            tag: verificationLinks.tag.trim(),
          },
          tasks,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Submission failed.");
        playSigh();
        return;
      }
      setSubmittedHandle(xHandle);
      setSubmittedWallet(wallet);
      setSuccess(true);
      playClick();
    } catch {
      setError("Network error. Are you running the local server?");
      playSigh();
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-xl text-center"
      >
        <Mascot
          size="lg"
          pose="idle"
          showSpeech
          quote="You're on the list. Try not to get too excited."
        />
        <GlitchText
          as="h2"
          className="mt-6 font-mono text-3xl font-bold text-neon-green neon-green-glow sm:text-4xl"
        >
          YOU&apos;RE IN THE WL PROCESS
        </GlitchText>
        <p className="mt-3 font-mono text-sm text-foreground/60">
          @{submittedHandle} · {submittedWallet.slice(0, 6)}…
          {submittedWallet.slice(-4)}
        </p>
        <p className="mx-auto mt-2 max-w-md font-mono text-xs leading-relaxed text-foreground/40">
          We&apos;ll review follows, quote links, and comments. Stay tired — if
          you make it, we&apos;ll reach out to you directly on X.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-lg border border-neon-purple/40 px-6 py-2 font-mono text-sm text-neon-purple transition-colors hover:bg-neon-purple/10"
        >
          ← Back home
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-10 text-center">
        <GlitchText
          as="h1"
          className="font-mono text-4xl font-black text-neon-pink neon-pink-glow sm:text-6xl"
        >
          GET WL
        </GlitchText>
        <p className="mt-3 font-mono text-sm text-foreground/60 sm:text-base">
          Complete 5 tasks. Tell us why you&apos;re tired. Drop your ETH wallet.
        </p>
        <div className="mx-auto mt-6 h-2 max-w-md overflow-hidden rounded-full bg-deep-purple/60">
          <motion.div
            className="h-full bg-gradient-to-r from-neon-purple via-neon-pink to-neon-green"
            initial={{ width: 0 }}
            animate={{ width: `${(progress / totalSteps) * 100}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-xs text-foreground/40">
          {progress}/{totalSteps} steps
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {WL_TASKS.map((task, i) => {
          const done = tasks[task.id];
          const linkValue = verificationLinks[task.id];
          const linkOk =
            task.id === "follow"
              ? followOk
              : task.id === "share"
                ? shareLinkOk
                : tagLinkOk;

          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`neon-border flex flex-col rounded-2xl p-5 backdrop-blur-sm transition-colors ${
                done
                  ? "border-neon-green/40 bg-neon-green/5"
                  : "bg-deep-purple/30"
              }`}
            >
              <span className="font-mono text-xs text-neon-purple">
                TASK {task.number}
              </span>
              <h3 className="mt-2 font-mono text-xl font-bold text-foreground">
                {task.title}
              </h3>
              <p className="mt-2 font-mono text-xs leading-relaxed text-foreground/55">
                {task.description}
              </p>

              <a
                href={task.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playClick()}
                className="mt-4 inline-flex items-center justify-center rounded-lg border border-neon-pink/40 bg-neon-pink/10 py-2 font-mono text-xs text-neon-pink transition-colors hover:bg-neon-pink/20"
              >
                {task.cta} ↗
              </a>

              <div className="mt-3">
                <label className="font-mono text-[10px] tracking-wide text-neon-purple uppercase">
                  {task.verificationLabel}
                </label>
                <input
                  type="text"
                  value={linkValue}
                  onChange={(e) => updateLink(task.id, e.target.value)}
                  placeholder={task.verificationPlaceholder}
                  spellCheck={false}
                  className="mt-1.5 w-full rounded-lg border border-neon-purple/30 bg-background/60 px-3 py-2 font-mono text-[11px] text-foreground outline-none placeholder:text-foreground/25 focus:border-neon-green/40"
                />
                {linkValue && !linkOk && (
                  <p className="mt-1 font-mono text-[10px] text-neon-pink">
                    {task.id === "follow"
                      ? "Use @handle or an x.com/profile link."
                      : "Needs a real X post/comment link."}
                  </p>
                )}
              </div>

              <p className="mt-2 flex-1 font-mono text-[10px] leading-relaxed text-foreground/45">
                {task.note}
              </p>

              <button
                onClick={() => toggleTask(task.id)}
                className={`mt-3 rounded-lg py-2.5 font-mono text-sm font-bold transition-colors ${
                  done
                    ? "border border-neon-green/50 bg-neon-green/15 text-neon-green"
                    : "border border-neon-purple/40 bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20"
                }`}
              >
                {done ? "DONE ✓" : "MARK AS DONE"}
              </button>
            </motion.div>
          );
        })}
      </div>

      <div className="neon-border mb-6 rounded-2xl bg-deep-purple/30 p-6 backdrop-blur-sm">
        <h2 className="font-mono text-lg font-bold text-neon-green">
          Why are you tired?
        </h2>
        <p className="mt-1 mb-4 font-mono text-xs leading-relaxed text-foreground/50">
          Say whatever you want. If it&apos;s honest, we&apos;ve probably felt
          it too. There&apos;s no magic phrase that gets you approved — just
          real words.
        </p>
        <textarea
          value={whyTired}
          onChange={(e) => setWhyTired(e.target.value)}
          rows={4}
          placeholder="I'm tired of…"
          className="w-full resize-y rounded-lg border border-neon-purple/30 bg-background/60 px-4 py-3 font-mono text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-neon-green/50"
        />
        {whyTired && !whyTiredOk && (
          <p className="mt-2 font-mono text-xs text-neon-pink">
            Give us at least a sentence (10+ characters).
          </p>
        )}
      </div>

      <div className="neon-border mb-6 rounded-2xl bg-deep-purple/30 p-6 backdrop-blur-sm">
        <h2 className="font-mono text-lg font-bold text-neon-green">
          ETH wallet
        </h2>
        <p className="mt-1 mb-4 font-mono text-xs text-foreground/50">
          Paste the ETH wallet you&apos;ll mint with on OpenSea. Wrong wallet =
          you get nothing. Double-check.
        </p>
        <input
          type="text"
          value={wallet}
          onChange={(e) => setWallet(e.target.value.trim())}
          placeholder="0x…"
          spellCheck={false}
          className="w-full rounded-lg border border-neon-purple/30 bg-background/60 px-4 py-3 font-mono text-sm text-neon-green outline-none placeholder:text-foreground/25 focus:border-neon-green/50"
        />
        {wallet && !isValidEthWallet(wallet) && (
          <p className="mt-2 font-mono text-xs text-neon-pink">
            Needs a valid ETH address (0x + 40 hex chars).
          </p>
        )}
      </div>

      {error && (
        <p className="mb-4 text-center font-mono text-sm text-neon-pink">
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-3">
        <motion.button
          whileHover={canSubmit ? { scale: 1.03 } : undefined}
          whileTap={canSubmit ? { scale: 0.97 } : undefined}
          disabled={!canSubmit}
          onClick={submit}
          className={`rounded-lg px-10 py-3.5 font-mono text-lg font-bold transition-all ${
            canSubmit
              ? "neon-border-green bg-neon-green/15 text-neon-green hover:bg-neon-green/25"
              : "cursor-not-allowed border border-foreground/10 text-foreground/25"
          }`}
        >
          {submitting ? "SUBMITTING…" : "SUBMIT WL APPLICATION"}
        </motion.button>
        <p className="font-mono text-[11px] text-foreground/30">
          Not financial advice. Just tired advice.
        </p>
        <a
          href={LINKS.x}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-foreground/40 hover:text-neon-pink"
        >
          Questions? Ping us on X
        </a>
      </div>
    </div>
  );
}
