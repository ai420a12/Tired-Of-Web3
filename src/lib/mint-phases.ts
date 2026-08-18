export type MintPhaseStatus = "live" | "upcoming" | "ended";

export type MintPhaseInfo = {
  id: string;
  label: string;
  stageType: string;
  priceWei: string;
  priceEth: number;
  startAt: number;
  endAt: number;
  maxPerWallet: number;
  status: MintPhaseStatus;
};

export function phaseStatus(
  startAt: number,
  endAt: number,
  now: number,
): MintPhaseStatus {
  if (endAt && now >= endAt) return "ended";
  if (startAt && now < startAt) return "upcoming";
  return "live";
}

/** Infer missing end times and keep only one LIVE stage (WL → FCFS → public). */
export function normalizeMintPhases(
  phases: MintPhaseInfo[],
  now = Date.now(),
): MintPhaseInfo[] {
  if (!phases.length) return phases;

  const sorted = [...phases].sort(
    (a, b) => (a.startAt || 0) - (b.startAt || 0),
  );
  const withEnds = sorted.map((phase, i) => {
    let endAt = phase.endAt;
    if (!endAt && sorted[i + 1]?.startAt) {
      endAt = sorted[i + 1].startAt;
    }
    return { ...phase, endAt };
  });

  const normalized = withEnds.map((phase) => ({
    ...phase,
    status: phaseStatus(phase.startAt, phase.endAt, now),
  }));

  const live = normalized.filter((p) => p.status === "live");
  if (live.length <= 1) return normalized;

  const pick = live.reduce((best, p) =>
    (p.startAt || 0) >= (best.startAt || 0) ? p : best,
  );
  return normalized.map((p) =>
    p.status === "live" && p.id !== pick.id
      ? { ...p, status: "ended" as const }
      : p,
  );
}

export function refreshMintPhase(
  phase: MintPhaseInfo,
  now = Date.now(),
): MintPhaseInfo {
  return normalizeMintPhases([phase], now)[0] || phase;
}

export function stageKind(raw: string): "public" | "wl" | "fcfs" | "other" {
  const text = raw.toLowerCase();
  if (/\b(?:fcfs|first\s*come)\b/.test(text)) return "fcfs";
  if (/\b(?:wl|allowlist|whitelist|presale|pre[- ]?sale|gtd)\b/.test(text)) {
    return "wl";
  }
  if (/\bpublic\b/.test(text)) return "public";
  return "other";
}

export function phaseQtyCap(
  requested: number,
  phase?: Pick<MintPhaseInfo, "maxPerWallet"> | null,
  analysisMax?: number,
): number {
  let qty = Math.max(1, Math.min(100, Math.floor(requested)));
  if (phase?.maxPerWallet && phase.maxPerWallet > 0) {
    qty = Math.min(qty, phase.maxPerWallet);
  }
  if (analysisMax && analysisMax > 0) {
    qty = Math.min(qty, analysisMax);
  }
  return Math.max(1, qty);
}

export function quantityCandidates(
  requested: number,
  phase?: Pick<MintPhaseInfo, "maxPerWallet"> | null,
  analysisMax?: number,
): number[] {
  const primary = phaseQtyCap(requested, phase, analysisMax);
  const out = [primary];
  if (phase?.maxPerWallet && phase.maxPerWallet > 0 && phase.maxPerWallet < primary) {
    out.push(phase.maxPerWallet);
  }
  if (analysisMax && analysisMax > 0 && analysisMax < primary) {
    out.push(analysisMax);
  }
  if (!out.includes(1)) out.push(1);
  return [...new Set(out.filter((q) => q >= 1 && q <= 100))];
}

export function isAllowlistMintError(msg: string): boolean {
  return /allowlist|whitelist|merkle|not eligible|not on (the )?list|proof/i.test(
    msg,
  );
}

export function isStageNotLiveError(msg: string): boolean {
  return /simulation failed|grouped mint|not (yet )?live|not started|inactive|stage (?:is )?closed|sale (?:is )?not/i.test(
    msg,
  );
}
