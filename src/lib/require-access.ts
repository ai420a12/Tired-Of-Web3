import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Address } from "viem";
import { ACCESS_COOKIE, readAccessToken } from "@/lib/access-key";

/** Returns 401 response if the request is missing a valid access-key cookie. */
export async function requireAccessKey(
  request?: Request,
): Promise<NextResponse | { address: Address }> {
  let token: string | undefined;
  if (request) {
    const raw = request.headers.get("cookie") || "";
    const match = raw.match(
      new RegExp(`(?:^|;\\s*)${ACCESS_COOKIE}=([^;]+)`),
    );
    token = match?.[1] ? decodeURIComponent(match[1]) : undefined;
  } else {
    const jar = await cookies();
    token = jar.get(ACCESS_COOKIE)?.value;
  }

  const session = readAccessToken(token);
  if (!session) {
    return NextResponse.json(
      {
        error: "Access Key required. Connect MetaMask and verify ownership.",
        code: "ACCESS_REQUIRED",
      },
      { status: 401 },
    );
  }
  return { address: session.address };
}

export function isAccessDenied(
  value: NextResponse | { address: Address },
): value is NextResponse {
  return value instanceof NextResponse;
}
