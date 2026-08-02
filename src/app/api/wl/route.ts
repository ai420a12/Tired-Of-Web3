import { NextResponse } from "next/server";
import {
  addSubmission,
  getStoreStatus,
  readSubmissions,
} from "@/lib/wl-store";
import {
  isValidEthWallet,
  isValidXPostUrl,
  isValidWhyTired,
  parseXProfileInput,
  type WlSubmission,
} from "@/lib/wl";

/**
 * GET /api/wl — health / store status (safe for public).
 * With x-wl-admin-secret (or local store), also returns submissions.
 */
export async function GET(request: Request) {
  const status = getStoreStatus();

  const secret = process.env.WL_ADMIN_SECRET;
  const header = request.headers.get("x-wl-admin-secret");
  const adminOk = Boolean(secret && header === secret);
  const allowList = adminOk || status.store === "local";

  if (!allowList) {
    return NextResponse.json(status);
  }

  const submissions = await readSubmissions();
  return NextResponse.json({
    ...status,
    count: submissions.length,
    submissions,
  });
}

export async function POST(request: Request) {
  try {
    const status = getStoreStatus();
    if (!status.ok) {
      console.error(
        "POST /api/wl rejected: store misconfigured",
        JSON.stringify(status),
      );
      return NextResponse.json(
        {
          error:
            "WL intake is temporarily down — ping us on X @TiredOfWeb3 and we'll sort it.",
          code: "WL_MISCONFIGURED",
          store: status.store,
        },
        { status: 503 },
      );
    }

    const body = await request.json();
    const xProfile =
      typeof body.xProfile === "string" ? body.xProfile.trim() : "";
    const rawHandle = typeof body.xHandle === "string" ? body.xHandle : "";
    const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
    const whyTired = typeof body.whyTired === "string" ? body.whyTired : "";
    const verificationLinks = body.verificationLinks ?? {};
    const tasks = body.tasks ?? {};

    const shareLink =
      typeof verificationLinks.share === "string"
        ? verificationLinks.share.trim()
        : "";
    const tagLink =
      typeof verificationLinks.tag === "string"
        ? verificationLinks.tag.trim()
        : "";

    const xHandle =
      parseXProfileInput(xProfile) || parseXProfileInput(rawHandle);

    if (!xHandle) {
      return NextResponse.json(
        { error: "Task 01 needs a valid X @handle or profile link." },
        { status: 400 },
      );
    }

    if (!tasks.follow || !tasks.share || !tasks.tag) {
      return NextResponse.json(
        { error: "Complete all 3 tasks before submitting." },
        { status: 400 },
      );
    }

    if (!isValidXPostUrl(shareLink)) {
      return NextResponse.json(
        { error: "Quote task needs a valid X quote-tweet link." },
        { status: 400 },
      );
    }

    if (!isValidXPostUrl(tagLink)) {
      return NextResponse.json(
        { error: "Tag task needs a valid X comment link." },
        { status: 400 },
      );
    }

    if (!isValidWhyTired(whyTired)) {
      return NextResponse.json(
        { error: "Tell us why you're tired (at least a short sentence)." },
        { status: 400 },
      );
    }

    if (!isValidEthWallet(wallet)) {
      return NextResponse.json(
        { error: "Invalid ETH wallet. Needs a 0x address (42 chars)." },
        { status: 400 },
      );
    }

    const submission: WlSubmission = {
      id: crypto.randomUUID(),
      xHandle,
      xProfile: xProfile || `@${xHandle}`,
      wallet,
      whyTired: whyTired.trim(),
      verificationLinks: {
        share: shareLink,
        tag: tagLink,
      },
      tasks: {
        follow: true,
        share: true,
        tag: true,
      },
      submittedAt: new Date().toISOString(),
    };

    const result = await addSubmission(submission);
    if (!result.ok) {
      const statusCode = result.status ?? 409;
      return NextResponse.json(
        {
          error: result.error,
          ...(result.code ? { code: result.code } : {}),
        },
        { status: statusCode },
      );
    }

    return NextResponse.json({
      ok: true,
      store: result.store,
      submission,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("POST /api/wl failed:", message, err);

    if (message.includes("LOCAL_WL_STORE_FORBIDDEN")) {
      return NextResponse.json(
        {
          error:
            "WL intake is temporarily down — ping us on X @TiredOfWeb3 and we'll sort it.",
          code: "WL_MISCONFIGURED",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Something broke. Try again when you're less tired." },
      { status: 500 },
    );
  }
}
