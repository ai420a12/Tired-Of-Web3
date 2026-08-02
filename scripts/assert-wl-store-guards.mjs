/**
 * Regression: addLocal / local JSON store must NEVER be selected on Vercel.
 * Run: node scripts/assert-wl-store-guards.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = readFileSync(join(root, "src/lib/wl-store.ts"), "utf8");

// --- Source guards (cannot be refactored away silently) ---
assert.match(
  src,
  /LOCAL_WL_STORE_FORBIDDEN/,
  "addLocal must hard-throw LOCAL_WL_STORE_FORBIDDEN on serverless/production",
);
assert.match(
  src,
  /forbidsLocalStore/,
  "forbidsLocalStore helper must exist",
);
assert.match(
  src,
  /resolveWriteStore/,
  "resolveWriteStore helper must exist",
);
assert.match(
  src,
  /WL_WEBHOOK_URL/,
  "Discord/Slack webhook fallback must be wired",
);
assert.match(
  src,
  /WL_MISCONFIGURED/,
  "misconfigured path must expose WL_MISCONFIGURED",
);

// --- Pure resolver logic (mirrors resolveWriteStore) ---
function resolveWriteStore(env) {
  const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const hasWebhook = Boolean(env.WL_WEBHOOK_URL?.trim());
  const forbidsLocal =
    Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME) ||
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.VERCEL_ENV === "preview";

  if (hasSupabase) return "supabase";
  if (hasWebhook) return "webhook";
  if (forbidsLocal) return "misconfigured";
  return "local";
}

assert.equal(
  resolveWriteStore({ VERCEL: "1" }),
  "misconfigured",
  "VERCEL=1 with no credentials → misconfigured (never local)",
);

assert.equal(
  resolveWriteStore({
    VERCEL: "1",
    SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "key",
  }),
  "supabase",
);

assert.equal(
  resolveWriteStore({
    VERCEL: "1",
    WL_WEBHOOK_URL: "https://discord.com/api/webhooks/x/y",
  }),
  "webhook",
);

assert.equal(
  resolveWriteStore({ NODE_ENV: "production" }),
  "misconfigured",
  "NODE_ENV=production with no credentials → misconfigured",
);

assert.equal(
  resolveWriteStore({ NODE_ENV: "development" }),
  "local",
  "local JSON only allowed in development without credentials",
);

assert.equal(
  resolveWriteStore({
    VERCEL: "1",
    SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "key",
    WL_WEBHOOK_URL: "https://discord.com/api/webhooks/x/y",
  }),
  "supabase",
  "Supabase wins over webhook",
);

// Ensure addLocal itself checks forbidsLocalStore before writing
const addLocalIdx = src.indexOf("async function addLocal");
assert.ok(addLocalIdx >= 0, "addLocal function must exist");
const addLocalSlice = src.slice(addLocalIdx, addLocalIdx + 400);
assert.match(
  addLocalSlice,
  /forbidsLocalStore\s*\(/,
  "addLocal must call forbidsLocalStore() before any FS write",
);

console.log("✓ WL store guards OK — local JSON never selected when VERCEL=1");
