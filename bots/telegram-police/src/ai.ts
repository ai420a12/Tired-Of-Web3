import {
  AI_CONFIDENCE_MIN,
  GROQ_API_KEY,
  GROQ_API_URL,
  GROQ_MODEL,
  requireGroq,
} from "./config.js";
import type { ViolationCategory } from "./rules.js";
import { normalizeText } from "./rules.js";

export type AiVerdict = {
  violation: boolean;
  category: ViolationCategory | "ok" | "other";
  severity: "high" | "medium" | "low" | "none";
  action: "ban" | "mute" | "delete" | "none";
  confidence: number;
  reason: string;
};

const SYSTEM = `
You are Tired Police — a strict but fair Telegram group moderator for the $TIRED / Tired Of Web3 community.

Your job: decide if a message is harmful and should be removed / user muted / banned.

VIOLATIONS (mark violation=true):
- Scams / phishing: fake airdrops, "DM me", seed phrases, wallet connect to claim, doublers, fake admins, refunds
- Impersonation: pretending to be Tired support / CEO / admin
- Shilling other crypto projects, tokens, presales, signal groups, "next gem", unpaid ads
- Porn / NSFW solicitation, OnlyFans spam, sexual media pitches
- Obvious spam / referral farms unrelated to Tired

NOT violations (violation=false):
- Normal chat, memes, jokes, tired/frustrated talk about crypto
- Questions about $TIRED, CA, chart, NFT, WL, factory, support
- Links to official Tired surfaces (hoodrpc.xyz, tiredofweb3.xyz sniper, Pons TIRED page, DexScreener Robinhood TIRED pool, OpenSea Tired, official socials)
- Sharing the official CA 0x9D60d91044f1c501fEA4D2E95691b84Edd8CF4CB or fee wallet

TRICKY TEXT: attackers obfuscate with spaces, dots, leetspeak, cyrillic lookalikes, emoji between letters, "аirdrop", "D.M me". Treat those as the clear intent.

Severity:
- high → ban (scam, phishing, porn, fake admin, foreign CA)
- medium → mute (shill other projects, unapproved promo links)
- low → delete only (mild spam)

Respond with ONLY compact JSON (no markdown):
{"violation":boolean,"category":"scam"|"phishing"|"shill"|"porn"|"spam"|"impersonation"|"ok"|"other","severity":"high"|"medium"|"low"|"none","action":"ban"|"mute"|"delete"|"none","confidence":0.0-1.0,"reason":"short"}
`.trim();

type GroqResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

function parseVerdict(raw: string): AiVerdict | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(raw.slice(start, end + 1)) as Partial<AiVerdict>;
    if (typeof j.violation !== "boolean") return null;
    const confidence = Number(j.confidence);
    return {
      violation: j.violation,
      category: (j.category as AiVerdict["category"]) || "other",
      severity: (j.severity as AiVerdict["severity"]) || "none",
      action: (j.action as AiVerdict["action"]) || "none",
      confidence: Number.isFinite(confidence) ? confidence : 0,
      reason: String(j.reason || "ai").slice(0, 200),
    };
  } catch {
    return null;
  }
}

export async function classifyMessage(opts: {
  text: string;
  softSignals?: string[];
  hasMedia?: boolean;
  mediaKind?: string;
}): Promise<AiVerdict | null> {
  requireGroq();

  const norm = normalizeText(opts.text);
  const user = [
    `MESSAGE:"""${opts.text.slice(0, 1500)}"""`,
    norm !== opts.text.toLowerCase()
      ? `NORMALIZED:"""${norm.slice(0, 800)}"""`
      : "",
    opts.softSignals?.length
      ? `SOFT_SIGNALS:${opts.softSignals.join(",")}`
      : "",
    opts.hasMedia ? `HAS_MEDIA:${opts.mediaKind || "yes"}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.1,
      max_tokens: 180,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });

  const data = (await res.json()) as GroqResponse;
  if (!res.ok) {
    console.error("[ai]", data.error?.message || res.status);
    return null;
  }

  const content = data.choices?.[0]?.message?.content?.trim() || "";
  const verdict = parseVerdict(content);
  if (!verdict) {
    console.error("[ai] bad json", content.slice(0, 200));
    return null;
  }
  return verdict;
}

export function aiWarrantsAction(v: AiVerdict): boolean {
  return (
    v.violation &&
    v.action !== "none" &&
    v.confidence >= AI_CONFIDENCE_MIN &&
    v.severity !== "none"
  );
}
