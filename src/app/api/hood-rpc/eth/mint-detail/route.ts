import { handleMintDetail } from "../../_handlers/mint-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(req: Request) {
  return handleMintDetail(req, "eth");
}
