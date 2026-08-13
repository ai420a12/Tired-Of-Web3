import { NextResponse } from "next/server";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";
import { fetchMintgoMintTx, type MintgoChain } from "@/lib/mintgo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function handleMintTx(req: Request, variant: HoodRpcVariant) {
  const { isAccessDenied, requireAccessKey } = await import(
    "@/lib/require-access"
  );
  const access = await requireAccessKey(req);
  if (isAccessDenied(access)) return access;

  let body: {
    contract?: string;
    quantity?: number;
    from?: string;
    allowPaid?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contract = (body.contract || "").trim().toLowerCase();
  const from = (body.from || "").trim().toLowerCase();
  const quantity = Math.floor(Number(body.quantity || 0));
  if (!/^0x[a-f0-9]{40}$/.test(contract) || !/^0x[a-f0-9]{40}$/.test(from)) {
    return NextResponse.json(
      { ok: false, error: "Invalid contract or wallet" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) {
    return NextResponse.json(
      { ok: false, error: "Quantity must be 1–100" },
      { status: 400 },
    );
  }

  const chain: MintgoChain = variant === "eth" ? "ethereum" : "robinhood";
  try {
    const payload = await fetchMintgoMintTx({
      chain,
      contract,
      quantity,
      from,
      allowPaid: Boolean(body.allowPaid),
    });
    if (!payload?.ok || !payload.tx?.to || !payload.tx?.data) {
      return NextResponse.json(
        {
          ok: false,
          error:
            payload?.error ||
            payload?.reason ||
            payload?.analysis?.reason ||
            "No mint route for this contract",
          analysis: payload?.analysis || null,
        },
        { status: 422 },
      );
    }
    return NextResponse.json({
      ok: true,
      chain,
      analysis: payload.analysis || null,
      tx: payload.tx,
      gasValidated: Boolean(payload.gasValidated),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "MINT_TX_FAILED",
      },
      { status: 502 },
    );
  }
}
