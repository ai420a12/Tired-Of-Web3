import { proxyJson } from "../../_lib/forgeProxy";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ session: string }> },
) {
  const { session } = await params;
  return proxyJson(`/api/refs/${session}`, { method: "DELETE" });
}

