import type { NextConfig } from "next";
import { warnIfWlMisconfiguredOnVercel } from "./src/lib/wl-env-check";

// Screams on every Vercel build if neither Supabase nor WL_WEBHOOK_URL is set.
// Does not fail the build — hardened code must be deployable before secrets exist.
warnIfWlMisconfiguredOnVercel();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
