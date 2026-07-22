import { NextResponse } from "next/server";
import { addSubmission, readSubmissions, usingCloudStore } from "@/lib/wl-store";
import {
  isValidEthWallet,
  isValidXPostUrl,
  isValidWhyTired,
  parseXProfileInput,
  type WlSubmission,
} from "@/lib/wl";

export async function GET(request: Request) {
  // Don't expose the full WL list publicly on the live site
  if (usingCloudStore()) {
    const secret = process.env.WL_ADMIN_SECRET;
    const header = request.headers.get("x-wl-admin-secret");
    if (!secret || header !== secret) {
      return NextResponse.json(
        { error: "Forbidden. View submissions in the Supabase dashboard." },
        { status: 403 },
      );
    }
  }

  const submissions = await readSubmissions();
  return NextResponse.json({
    count: submissions.length,
    store: usingCloudStore() ? "supabase" : "local",
    submissions,
  });
}

export async function POST(request: Request) {
  try {
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
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ ok: true, submission });
  } catch {
    return NextResponse.json(
      { error: "Something broke. Try again when you're less tired." },
      { status: 500 },
    );
  }
}
