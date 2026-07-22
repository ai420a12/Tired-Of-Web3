import { promises as fs } from "fs";
import path from "path";
import type { WlSubmission } from "@/lib/wl";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "wl-submissions.json");

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf8");
  }
}

export async function readSubmissions(): Promise<WlSubmission[]> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  try {
    return JSON.parse(raw) as WlSubmission[];
  } catch {
    return [];
  }
}

export async function addSubmission(
  submission: WlSubmission,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await readSubmissions();

  const walletTaken = existing.some(
    (row) => row.wallet.toLowerCase() === submission.wallet.toLowerCase(),
  );
  if (walletTaken) {
    return { ok: false, error: "This wallet already submitted." };
  }

  const handleTaken = existing.some(
    (row) => row.xHandle.toLowerCase() === submission.xHandle.toLowerCase(),
  );
  if (handleTaken) {
    return { ok: false, error: "This X handle already submitted." };
  }

  existing.push(submission);
  await fs.writeFile(DATA_FILE, JSON.stringify(existing, null, 2), "utf8");
  return { ok: true };
}
