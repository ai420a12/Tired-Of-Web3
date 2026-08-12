import { NextResponse } from "next/server";
import {
  proxyJsonRaw,
  rewriteJobStatusPayload,
} from "../../_lib/forgeProxy";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const res = await proxyJsonRaw(`/api/jobs/${jobId}`);
  const payload = rewriteJobStatusPayload(res.data);
  return NextResponse.json(payload, { status: res.status });
}

