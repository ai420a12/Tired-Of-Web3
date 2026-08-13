import type { NextConfig } from "next";
import { warnIfWlMisconfiguredOnVercel } from "./src/lib/wl-env-check";

// Screams on every Vercel build if neither Supabase nor WL_WEBHOOK_URL is set.
// Does not fail the build — hardened code must be deployable before secrets exist.
warnIfWlMisconfiguredOnVercel();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
