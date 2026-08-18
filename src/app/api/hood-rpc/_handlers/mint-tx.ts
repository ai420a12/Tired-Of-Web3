import { NextResponse } from "next/server";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";
import {
  fetchMintgoCollection,
  fetchMintgoMintTx,
  type MintgoChain,
} from "@/lib/mintgo";
import {
  isAllowlistMintError,
  isStageNotLiveError,
  quantityCandidates,
  stageKind,
} from "@/lib/mint-phases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PhaseHint = {
  id?: string;
  label?: string;
  stageType?: string;
  priceWei?: string;
  maxPerWallet?: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function padGas(gas?: string): string | undefined {
  if (!gas) return gas;
  try {
    const raw = BigInt(gas);
    const padded = (raw * BigInt(13)) / BigInt(10);
    const next = padded > BigInt(500000) ? padded : BigInt(500000);
    return `0x${next.toString(16)}`;
  } catch {
    return gas;
  }
}

function analysisMax(analysis?: {
  maxPerWallet?: number;
  maxBatch?: number;
}): number | undefined {
  const a = Number(analysis?.maxPerWallet || 0);
  const b = Number(analysis?.maxBatch || 0);
  const n = Math.max(a, b);
  return n > 0 ? n : undefined;
}

function stageMismatch(
  phase: PhaseHint | undefined,
  analysisLabel: string,
): string | null {
  if (!phase?.label && !phase?.stageType) return null;
  const want = stageKind(
    `${phase.label || ""} ${phase.stageType || ""}`.trim(),
  );
  const have = stageKind(analysisLabel);
  if (want === "other" || have === "other") return null;
  if (want === have) return null;
  return `Mint route is ${have.toUpperCase()} but you picked ${want.toUpperCase()} — switch stage or wait`;
}

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
    phase?: PhaseHint;
    stageOpen?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contract = (body.contract || "").trim().toLowerCase();
  const from = (body.from || "").trim().toLowerCase();
  const quantity = Math.floor(Number(body.quantity || 0));
  const phase = body.phase;
  const stageOpen = Boolean(body.stageOpen);

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

  let collectionAnalysis:
    | {
        ready?: boolean;
        reason?: string;
        functionLabel?: string;
        maxPerWallet?: number;
        maxBatch?: number;
      }
    | undefined;
  try {
    const raw = await fetchMintgoCollection(chain, contract);
    const mintAnalysis = raw.mintAnalysis as
      | {
          ready?: boolean;
          reason?: string;
          functionLabel?: string;
          maxPerWallet?: number;
          maxBatch?: number;
        }
      | undefined;
    if (mintAnalysis) collectionAnalysis = mintAnalysis;
  } catch {
    /* MintGo collection optional */
  }

  const maxHint = analysisMax(collectionAnalysis);
  const phaseCap =
    phase?.maxPerWallet && phase.maxPerWallet > 0
      ? phase.maxPerWallet
      : undefined;
  const quantities = quantityCandidates(quantity, { maxPerWallet: phaseCap || 0 }, maxHint);

  const mismatch = stageMismatch(
    phase,
    String(collectionAnalysis?.functionLabel || ""),
  );
  if (mismatch && collectionAnalysis?.ready && !stageOpen) {
    return NextResponse.json(
      {
        ok: false,
        error: mismatch,
        analysis: collectionAnalysis || null,
      },
      { status: 422 },
    );
  }

  const attempts = stageOpen ? 14 : 6;

  try {
    let lastError = "No mint route for this contract";
    let lastAnalysis: Awaited<
      ReturnType<typeof fetchMintgoMintTx>
    >["analysis"];

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) {
        await sleep(stageOpen ? 500 + attempt * 450 : 700 + attempt * 400);
      }

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
          if (payload.tx.gas) {
            payload.tx.gas = padGas(payload.tx.gas);
          }
          return NextResponse.json({
            ok: true,
            chain,
            quantity: qty,
            requested: quantity,
            phase: phase || null,
            analysis: payload.analysis || collectionAnalysis || null,
            tx: payload.tx,
            gasValidated: Boolean(payload.gasValidated),
          });
        }
        lastError =
          payload?.error ||
          payload?.reason ||
          payload?.analysis?.reason ||
          lastError;

        if (isAllowlistMintError(lastError)) break;
        if (!isStageNotLiveError(lastError) && attempt === 0) break;
      }

      if (isAllowlistMintError(lastError)) break;

      const retryable =
        isStageNotLiveError(lastError) ||
        /timeout|502|503|429|MintGo mint-tx/i.test(lastError);
      if (!retryable) break;
    }

    if (isAllowlistMintError(lastError)) {
      lastError =
        "Wallet not on allowlist for this stage — use a whitelisted wallet or wait for public";
    }

    return NextResponse.json(
      {
        ok: false,
        error: lastError,
        analysis: lastAnalysis || collectionAnalysis || null,
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
