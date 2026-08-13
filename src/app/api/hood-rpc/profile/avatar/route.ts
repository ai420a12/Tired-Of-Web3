import { NextResponse } from "next/server";
import {
  isAccessDenied,
  requireAccessKey,
} from "@/lib/require-access";
import { uploadAvatar } from "@/lib/rpc-profile-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const access = await requireAccessKey(req);
  if (isAccessDenied(access)) return access;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const file = form.get("avatar");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing avatar file" }, { status: 400 });
  }

  const result = await uploadAvatar(
    access.address,
    file,
    file.type || "application/octet-stream",
  );
  if (!result.ok) {
    const status =
      result.code === "BAD_TYPE" || result.code === "BAD_SIZE"
        ? 400
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
