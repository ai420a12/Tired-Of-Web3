"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  isValidEthWallet,
  isValidXPostUrl,
  parseXProfileInput,
} from "@/lib/wl";
import { HOOD_RPC_LINKS, HOOD_RPC_WL_TASKS, type HoodWlTaskId } from "./hood-wl";
import "./hood-rpc.css";

type TasksState = Record<HoodWlTaskId, boolean>;
type LinksState = { follow: string; share: string; tag: string };

/** Satisfies shared /api/wl whyTired min-length without a UI field. */
const HOOD_RPC_WHY_PLACEHOLDER = "[HOOD_RPC] WL application";

export default function HoodWhitelistForm() {
  const [wallet, setWallet] = useState("");
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
  const [intakeDown, setIntakeDown] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submittedHandle, setSubmittedHandle] = useState("");
  const [submittedWallet, setSubmittedWallet] = useState("");

  const xHandle = parseXProfileInput(verificationLinks.follow);
  const followOk = Boolean(xHandle);
  const shareLinkOk = isValidXPostUrl(verificationLinks.share);
  const tagLinkOk = isValidXPostUrl(verificationLinks.tag);
  const allTasksDone = tasks.follow && tasks.share && tasks.tag;

  const canSubmit =
    followOk &&
    allTasksDone &&
    shareLinkOk &&
    tagLinkOk &&
    isValidEthWallet(wallet) &&
    !submitting;

  const progress = useMemo(() => {
    let n = 0;
    if (tasks.follow && followOk) n += 1;
    if (tasks.share && shareLinkOk) n += 1;
    if (tasks.tag && tagLinkOk) n += 1;
    if (isValidEthWallet(wallet)) n += 1;
    return n;
  }, [tasks, followOk, shareLinkOk, tagLinkOk, wallet]);

  const totalSteps = 4;

  function toggleTask(id: HoodWlTaskId) {
    if (id === "follow" && !followOk) {
      setError("Add your X @handle or profile link before marking Follow as done.");
      return;
    }
    if (id === "share" && !shareLinkOk) {
      setError("Paste a valid quote-tweet link before marking Quote as done.");
      return;
    }
    if (id === "tag" && !tagLinkOk) {
      setError("Paste a valid comment link before marking Tag as done.");
      return;
    }
    setError("");
    setTasks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function updateLink(id: HoodWlTaskId, value: string) {
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
  }

  async function submit() {
    if (!canSubmit || !xHandle) return;
    setSubmitting(true);
    setError("");
    setIntakeDown(false);

    try {
      const res = await fetch("/api/wl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xHandle,
          xProfile: verificationLinks.follow.trim(),
          wallet,
          whyTired: HOOD_RPC_WHY_PLACEHOLDER,
          verificationLinks: {
            share: verificationLinks.share.trim(),
            tag: verificationLinks.tag.trim(),
          },
          tasks,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503 || data.code === "WL_MISCONFIGURED") {
          setIntakeDown(true);
          setError(
            data.error ||
              "WL intake is temporarily down — ping us on X @Hood_RPC and we'll sort it.",
          );
        } else {
          setError(data.error || "Submission failed.");
        }
        return;
      }
      setSubmittedHandle(xHandle);
      setSubmittedWallet(wallet);
      setSuccess(true);
    } catch {
      setError("Network error. Are you running the local server?");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="hrpc-wl-success">
        <Image
          src="/images/hood-rpc/mascot-lime.png"
          alt=""
          width={96}
          height={96}
          className="hrpc-wl-success-mascot"
        />
        <h2 className="hrpc-section-title">YOU&apos;RE IN THE WL PROCESS</h2>
        <p className="hrpc-mono hrpc-muted">
          @{submittedHandle} · {submittedWallet.slice(0, 6)}…
          {submittedWallet.slice(-4)}
        </p>
        <p className="hrpc-help">
          We&apos;ll review follows, quote links, and comments. If you make it,
          we&apos;ll reach out on X.
        </p>
        <Link href={HOOD_RPC_LINKS.home} className="hrpc-btn">
          ← Back to HOOD_RPC
        </Link>
      </div>
    );
  }

  return (
    <div className="hrpc-wl-form">
      <header className="hrpc-wl-hero">
        <h1 className="hrpc-section-title hrpc-wl-title">GET WL</h1>
        <p className="hrpc-section-sub">
          Complete 3 tasks. Drop your ETH wallet.
        </p>
        <div className="hrpc-wl-progress-track">
          <div
            className="hrpc-wl-progress-bar"
            style={{ width: `${(progress / totalSteps) * 100}%` }}
          />
        </div>
        <p className="hrpc-mono hrpc-muted">
          {progress}/{totalSteps} steps
        </p>
      </header>

      <div className="hrpc-wl-tasks">
        {HOOD_RPC_WL_TASKS.map((task) => {
          const done = tasks[task.id];
          const linkValue = verificationLinks[task.id];
          const linkOk =
            task.id === "follow"
              ? followOk
              : task.id === "share"
                ? shareLinkOk
                : tagLinkOk;

          return (
            <article
              key={task.id}
              className={`hrpc-panel hrpc-wl-task ${done ? "hrpc-wl-task-done" : ""}`}
            >
              <div className="hrpc-wl-task-head">
                <span className="hrpc-mono hrpc-muted">TASK {task.number}</span>
                <h3 className="hrpc-section-title hrpc-section-title-sm">
                  {task.title}
                </h3>
                <p className="hrpc-help hrpc-wl-task-desc">{task.description}</p>
              </div>

              <a
                href={task.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hrpc-btn hrpc-btn-ghost hrpc-wl-task-cta"
              >
                {task.cta} ↗
              </a>

              <div className="hrpc-wl-task-verify">
                <label className="hrpc-label">{task.verificationLabel}</label>
                <input
                  type="text"
                  className="hrpc-input hrpc-mono"
                  value={linkValue}
                  onChange={(e) => updateLink(task.id, e.target.value)}
                  placeholder={task.verificationPlaceholder}
                  spellCheck={false}
                />
                <p
                  className={`hrpc-wl-field-err ${linkValue && !linkOk ? "" : "hrpc-wl-field-err-slot"}`}
                  aria-hidden={!(linkValue && !linkOk)}
                >
                  {linkValue && !linkOk
                    ? task.id === "follow"
                      ? "Use @handle or an x.com/profile link."
                      : "Needs a real X post/comment link."
                    : "\u00a0"}
                </p>
              </div>

              <p className="hrpc-help hrpc-wl-task-note">{task.note}</p>

              <button
                type="button"
                className={`hrpc-btn hrpc-wl-task-done-btn ${done ? "" : "hrpc-btn-ghost"}`}
                onClick={() => toggleTask(task.id)}
              >
                {done ? "DONE ✓" : "MARK AS DONE"}
              </button>
            </article>
          );
        })}
      </div>

      <section className="hrpc-panel hrpc-wl-block">
        <h2 className="hrpc-section-title hrpc-section-title-sm">
          ETH wallet
        </h2>
        <p className="hrpc-help">Paste the 0x address you&apos;ll mint with.</p>
        <input
          type="text"
          className="hrpc-input hrpc-mono"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
        />
      </section>

      {error ? (
        <p className={`hrpc-wl-error ${intakeDown ? "hrpc-wl-error-down" : ""}`}>
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="hrpc-btn hrpc-wl-submit"
        disabled={!canSubmit}
        onClick={() => void submit()}
      >
        {submitting ? "SUBMITTING…" : "SUBMIT WL APPLICATION"}
      </button>
    </div>
  );
}
