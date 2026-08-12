import { NextResponse } from "next/server";
import {
  proxyJsonRaw,
  rewriteRefsPayload,
} from "../_lib/forgeProxy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();

  // Forward multipart to FastAPI
  const res = await proxyJsonRaw("/api/refs", {
    method: "POST",
    body: form,
  });

  const payload = rewriteRefsPayload(res.data);
  return NextResponse.json(payload, { status: res.status });
}

