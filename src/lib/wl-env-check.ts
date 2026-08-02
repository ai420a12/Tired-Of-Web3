/**
 * Build / startup scream when Vercel has no durable WL store configured.
 * Does NOT fail the build (so hardening can deploy before secrets are set),
 * but prints a loud error every Vercel build.
 */
export function warnIfWlMisconfiguredOnVercel(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const onVercel = env.VERCEL === "1";
  if (!onVercel) return;

  const hasSupabase = Boolean(
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const hasWebhook = Boolean(env.WL_WEBHOOK_URL?.trim());

  if (hasSupabase || hasWebhook) return;

  console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  🚨🚨🚨  WL STORE MISCONFIGURED ON VERCEL  🚨🚨🚨                ║
║                                                                  ║
║  Submissions will return 503 until you set ONE of:               ║
║                                                                  ║
║  PRIMARY (recommended):                                          ║
║    SUPABASE_URL                                                  ║
║    SUPABASE_SERVICE_ROLE_KEY                                     ║
║                                                                  ║
║  FALLBACK (one env var):                                         ║
║    WL_WEBHOOK_URL  (Discord webhook URL)                         ║
║                                                                  ║
║  After setting → Redeploy → GET /api/wl should show:             ║
║    { "ok": true, "store": "supabase" }  (or "webhook")           ║
║                                                                  ║
║  See WL-DATA.md — "Never break again" checklist.                 ║
╚══════════════════════════════════════════════════════════════════╝
`);
}
