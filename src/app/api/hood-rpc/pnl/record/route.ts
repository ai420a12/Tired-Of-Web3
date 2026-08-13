import { NextResponse } from "next/server";
import {
  isAccessDenied,
  requireAccessKey,
} from "@/lib/require-access";
import { recordSnipeFill } from "@/lib/rpc-pnl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  txHash?: string;
  contract?: string;
  tokenId?: string;
  costEth?: number;
  collectionSlug?: string;
  tokenName?: string;
};

export async function POST(req: Request) {
  const access = await requireAccessKey(req);
  if (isAccessDenied(access)) return access;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await recordSnipeFill({
    wallet: access.address,
    txHash: String(body.txHash || ""),
    contract: String(body.contract || ""),
    tokenId: String(body.tokenId || ""),
    costEth: Number(body.costEth),
    collectionSlug: body.collectionSlug
      ? String(body.collectionSlug)
      : undefined,
    tokenName: body.tokenName ? String(body.tokenName) : undefined,
  });

  if (!result.ok) {
    const status =
      result.code === "NO_STORE"
        ? 503
        : result.code?.startsWith("BAD_")
          ? 400
          : 500;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }
  return NextResponse.json({ ok: true, fill: result.fill });
}
