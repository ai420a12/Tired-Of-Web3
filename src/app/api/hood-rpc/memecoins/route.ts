import { HOOD_CHAIN_CONFIG } from "@/lib/hood-rpc-chain";
import { handleMemecoins } from "../_handlers/memecoins";

export const runtime = "nodejs";
export const revalidate = 30;

export async function GET() {
  return handleMemecoins(HOOD_CHAIN_CONFIG);
}
