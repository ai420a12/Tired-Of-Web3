import { handleMintTx } from "../../_handlers/mint-tx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  return handleMintTx(req, "eth");
}
