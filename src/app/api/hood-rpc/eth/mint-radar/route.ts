import { handleMintRadar } from "../../_handlers/mint-radar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(req: Request) {
  return handleMintRadar(req, "eth");
}
