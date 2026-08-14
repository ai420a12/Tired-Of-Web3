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
    chain?: string;
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

  const chain: MintgoChain =
    body.chain === "ethereum" || body.chain === "robinhood"
      ? body.chain
      : variant === "eth"
        ? "ethereum"
        : "robinhood";

  const quantities = [quantity];
  if (quantity >= 80) {
    for (const fallback of [99, 90, 80, 50]) {
      if (fallback < quantity && !quantities.includes(fallback)) {
        quantities.push(fallback);
      }
    }
  }

  try {
    let lastError = "No mint route for this contract";
    let lastAnalysis: Awaited<
      ReturnType<typeof fetchMintgoMintTx>
    >["analysis"];
    for (const qty of quantities) {
      const payload = await fetchMintgoMintTx({
        chain,
        contract,
        quantity: qty,
        from,
        allowPaid: Boolean(body.allowPaid),
      });
      lastAnalysis = payload.analysis || lastAnalysis;
      if (payload?.ok && payload.tx?.to && payload.tx?.data) {
        return NextResponse.json({
          ok: true,
          chain,
          quantity: qty,
          requested: quantity,
          analysis: payload.analysis || null,
          tx: payload.tx,
          gasValidated: Boolean(payload.gasValidated),
        });
      }
      lastError =
        payload?.error ||
        payload?.reason ||
        payload?.analysis?.reason ||
        lastError;
      const simFail = /simulation failed|grouped mint/i.test(lastError);
      if (!simFail) break;
    }
    return NextResponse.json(
      {
        ok: false,
        error: lastError,
        analysis: lastAnalysis || null,
      },
      { status: 422 },
    );
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
