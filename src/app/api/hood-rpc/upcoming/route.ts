import { handleUpcoming } from "../_handlers/upcoming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleUpcoming("hood");
}
