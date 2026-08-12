import { proxyJson } from "../_lib/forgeProxy";

export const runtime = "nodejs";

export async function GET() {
  return proxyJson("/api/health");
}

