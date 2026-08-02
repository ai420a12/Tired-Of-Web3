import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import type { WlSubmission } from "@/lib/wl";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "wl-submissions.json");

export type WlStoreKind = "supabase" | "webhook" | "local" | "misconfigured";

export type WlStoreStatus = {
  ok: boolean;
  store: WlStoreKind;
  hasUrl: boolean;
  hasKey: boolean;
  hasWebhook: boolean;
};

export type AddSubmissionResult =
  | { ok: true; store: Exclude<WlStoreKind, "misconfigured"> }
  | {
      ok: false;
      error: string;
      code?: "WL_MISCONFIGURED" | "WL_DUPLICATE" | "WL_STORE_ERROR";
      status?: number;
    };

type DbRow = {
  id: string;
  x_handle: string;
  x_profile: string;
  wallet: string;
  why_tired: string;
  quote_link: string;
  comment_link: string;
  task_follow: boolean;
  task_share: boolean;
  task_tag: boolean;
  submitted_at: string;
};

type EnvLike = Record<string, string | undefined>;

/** True on Vercel / AWS Lambda — read-only filesystem. */
export function isServerlessRuntime(env: EnvLike = process.env) {
  return Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME);
}

/** Production-like: never allow local JSON writes. */
export function forbidsLocalStore(env: EnvLike = process.env) {
  return (
    isServerlessRuntime(env) ||
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.VERCEL_ENV === "preview"
  );
}

export function hasSupabase(env: EnvLike = process.env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasWebhook(env: EnvLike = process.env) {
  return Boolean(env.WL_WEBHOOK_URL?.trim());
}

/**
 * Pure store resolver — used by runtime + regression tests.
 * Priority: Supabase → Discord/Slack webhook → local (dev only) → misconfigured.
 */
export function resolveWriteStore(env: EnvLike = process.env): WlStoreKind {
  if (hasSupabase(env)) return "supabase";
  if (hasWebhook(env)) return "webhook";
  if (forbidsLocalStore(env)) return "misconfigured";
  return "local";
}

export function getStoreStatus(env: EnvLike = process.env): WlStoreStatus {
  const store = resolveWriteStore(env);
  return {
    ok: store !== "misconfigured",
    store,
    hasUrl: Boolean(env.SUPABASE_URL),
    hasKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    hasWebhook: hasWebhook(env),
  };
}

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function rowToSubmission(row: DbRow): WlSubmission {
  return {
    id: row.id,
    xHandle: row.x_handle,
    xProfile: row.x_profile,
    wallet: row.wallet,
    whyTired: row.why_tired,
    verificationLinks: {
      share: row.quote_link,
      tag: row.comment_link,
    },
    tasks: {
      follow: row.task_follow,
      share: row.task_share,
      tag: row.task_tag,
    },
    submittedAt: row.submitted_at,
  };
}

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf8");
  }
}

async function readLocal(): Promise<WlSubmission[]> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  try {
    return JSON.parse(raw) as WlSubmission[];
  } catch {
    return [];
  }
}

/**
 * Local JSON store — localhost / NODE_ENV=development ONLY.
 * Hard-throws on Vercel/production so a future refactor cannot silently recur.
 */
async function addLocal(
  submission: WlSubmission,
): Promise<AddSubmissionResult> {
  if (forbidsLocalStore()) {
    const message =
      "LOCAL_WL_STORE_FORBIDDEN: local JSON store cannot run on Vercel/production. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or WL_WEBHOOK_URL).";
    console.error(`🚨 ${message}`);
    throw new Error(message);
  }

  const existing = await readLocal();

  if (
    existing.some(
      (row) => row.wallet.toLowerCase() === submission.wallet.toLowerCase(),
    )
  ) {
    return {
      ok: false,
      error: "This wallet already submitted.",
      code: "WL_DUPLICATE",
      status: 409,
    };
  }

  if (
    existing.some(
      (row) => row.xHandle.toLowerCase() === submission.xHandle.toLowerCase(),
    )
  ) {
    return {
      ok: false,
      error: "This X handle already submitted.",
      code: "WL_DUPLICATE",
      status: 409,
    };
  }

  existing.push(submission);
  await fs.writeFile(DATA_FILE, JSON.stringify(existing, null, 2), "utf8");
  return { ok: true, store: "local" };
}

async function readSupabase(): Promise<WlSubmission[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("wl_submissions")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Supabase read error:", error.message);
    return [];
  }

  return ((data as DbRow[]) ?? []).map(rowToSubmission);
}

async function addSupabase(
  submission: WlSubmission,
): Promise<AddSubmissionResult> {
  const supabase = getSupabase();

  const { error } = await supabase.from("wl_submissions").insert({
    id: submission.id,
    x_handle: submission.xHandle,
    x_profile: submission.xProfile,
    wallet: submission.wallet,
    why_tired: submission.whyTired,
    quote_link: submission.verificationLinks.share,
    comment_link: submission.verificationLinks.tag,
    task_follow: submission.tasks.follow,
    task_share: submission.tasks.share,
    task_tag: submission.tasks.tag,
    submitted_at: submission.submittedAt,
  });

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("wallet")) {
        return {
          ok: false,
          error: "This wallet already submitted.",
          code: "WL_DUPLICATE",
          status: 409,
        };
      }
      if (error.message.includes("x_handle")) {
        return {
          ok: false,
          error: "This X handle already submitted.",
          code: "WL_DUPLICATE",
          status: 409,
        };
      }
      return {
        ok: false,
        error: "This application was already submitted.",
        code: "WL_DUPLICATE",
        status: 409,
      };
    }
    console.error(
      "Supabase insert error:",
      error.message,
      error.code,
      error.details,
    );
    return {
      ok: false,
      error: `Could not save application. (${error.message})`,
      code: "WL_STORE_ERROR",
      status: 500,
    };
  }

  return { ok: true, store: "supabase" };
}

/** Discord (or Slack-compatible) webhook — one env var, works on Vercel. */
async function addWebhook(
  submission: WlSubmission,
): Promise<AddSubmissionResult> {
  const url = process.env.WL_WEBHOOK_URL!.trim();

  const payload = {
    username: "Tired WL",
    content: "**New WL application**",
    embeds: [
      {
        title: `@${submission.xHandle}`,
        color: 0xd4fd36,
        fields: [
          { name: "Wallet", value: `\`${submission.wallet}\``, inline: false },
          {
            name: "X profile",
            value: submission.xProfile.slice(0, 200),
            inline: true,
          },
          {
            name: "Why tired",
            value: submission.whyTired.slice(0, 1000) || "—",
            inline: false,
          },
          {
            name: "Quote link",
            value: submission.verificationLinks.share.slice(0, 300),
            inline: false,
          },
          {
            name: "Comment link",
            value: submission.verificationLinks.tag.slice(0, 300),
            inline: false,
          },
          { name: "ID", value: submission.id, inline: true },
          { name: "Submitted", value: submission.submittedAt, inline: true },
        ],
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        "🚨 WL webhook POST failed:",
        res.status,
        body.slice(0, 300),
      );
      return {
        ok: false,
        error: "Could not save application. Try again later.",
        code: "WL_STORE_ERROR",
        status: 502,
      };
    }

    return { ok: true, store: "webhook" };
  } catch (err) {
    console.error("🚨 WL webhook request error:", err);
    return {
      ok: false,
      error: "Could not save application. Try again later.",
      code: "WL_STORE_ERROR",
      status: 502,
    };
  }
}

function misconfiguredResult(): AddSubmissionResult {
  console.error(
    [
      "",
      "🚨🚨🚨 WL STORE MISCONFIGURED 🚨🚨🚨",
      "Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on Vercel (primary),",
      "OR set WL_WEBHOOK_URL (Discord webhook fallback).",
      "Local JSON writes are FORBIDDEN on Vercel — they cause read-only FS 500s.",
      "Verify after deploy: GET /api/wl → { store: \"supabase\" | \"webhook\" }",
      "",
    ].join("\n"),
  );

  return {
    ok: false,
    error:
      "WL intake is temporarily down — ping us on X @TiredOfWeb3 and we'll sort it.",
    code: "WL_MISCONFIGURED",
    status: 503,
  };
}

export async function readSubmissions(): Promise<WlSubmission[]> {
  if (hasSupabase()) return readSupabase();
  if (forbidsLocalStore()) return [];
  return readLocal();
}

export async function addSubmission(
  submission: WlSubmission,
): Promise<AddSubmissionResult> {
  const store = resolveWriteStore();

  switch (store) {
    case "supabase":
      return addSupabase(submission);
    case "webhook":
      return addWebhook(submission);
    case "local":
      return addLocal(submission);
    case "misconfigured":
      return misconfiguredResult();
    default: {
      const _exhaustive: never = store;
      return _exhaustive;
    }
  }
}

/** @deprecated Prefer getStoreStatus().store === "supabase" */
export function usingCloudStore() {
  return hasSupabase();
}
