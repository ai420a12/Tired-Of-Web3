import { NextResponse } from "next/server";
import { proxyJsonRaw, rewriteJobStatusPayload } from "../_lib/forgeProxy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ detail: "Missing JSON body" }, { status: 400 });
  }

  const res = await proxyJsonRaw("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // generate() returns a job_id; no URL rewriting needed yet.
  const payload = rewriteJobStatusPayload(res.data);
  return NextResponse.json(payload, { status: res.status });
}

