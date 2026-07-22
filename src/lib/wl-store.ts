import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import type { WlSubmission } from "@/lib/wl";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "wl-submissions.json");

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

function hasSupabase() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
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

async function addLocal(
  submission: WlSubmission,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await readLocal();

  if (
    existing.some(
      (row) => row.wallet.toLowerCase() === submission.wallet.toLowerCase(),
    )
  ) {
    return { ok: false, error: "This wallet already submitted." };
  }

  if (
    existing.some(
      (row) => row.xHandle.toLowerCase() === submission.xHandle.toLowerCase(),
    )
  ) {
    return { ok: false, error: "This X handle already submitted." };
  }

  existing.push(submission);
  await fs.writeFile(DATA_FILE, JSON.stringify(existing, null, 2), "utf8");
  return { ok: true };
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
): Promise<{ ok: true } | { ok: false; error: string }> {
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
        return { ok: false, error: "This wallet already submitted." };
      }
      if (error.message.includes("x_handle")) {
        return { ok: false, error: "This X handle already submitted." };
      }
      return { ok: false, error: "This application was already submitted." };
    }
    console.error("Supabase insert error:", error.message);
    return { ok: false, error: "Could not save application. Try again." };
  }

  return { ok: true };
}

export async function readSubmissions(): Promise<WlSubmission[]> {
  if (hasSupabase()) return readSupabase();
  return readLocal();
}

export async function addSubmission(
  submission: WlSubmission,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (hasSupabase()) return addSupabase(submission);
  return addLocal(submission);
}

export function usingCloudStore() {
  return hasSupabase();
}
