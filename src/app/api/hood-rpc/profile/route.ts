import { NextResponse } from "next/server";
import {
  isAccessDenied,
  requireAccessKey,
} from "@/lib/require-access";
import {
  ensureProfile,
  getProfile,
  upsertUsername,
} from "@/lib/rpc-profile-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireAccessKey(req);
  if (isAccessDenied(access)) return access;

  await ensureProfile(access.address);
  const profile = await getProfile(access.address);
  return NextResponse.json({
    ok: true,
    profile: profile || {
      wallet: access.address.toLowerCase(),
      username: null,
      avatarUrl: null,
      updatedAt: null,
    },
  });
}

export async function POST(req: Request) {
  const access = await requireAccessKey(req);
  if (isAccessDenied(access)) return access;

  let body: { username?: string };
  try {
    body = (await req.json()) as { username?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await upsertUsername(
    access.address,
    String(body.username || ""),
  );
  if (!result.ok) {
    const status =
      result.code === "BAD_USERNAME"
        ? 400
        : result.code === "USERNAME_TAKEN"
          ? 409
          : result.code === "NO_STORE"
            ? 503
            : 500;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }
  return NextResponse.json({ ok: true, profile: result.profile });
}
