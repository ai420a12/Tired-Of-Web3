import { LINKS } from "@/lib/constants";

export const WL_TASKS = [
  {
    id: "follow",
    number: "01",
    title: "Follow us",
    description: "Follow @TiredOfWeb3 on X and stay with the Tired Army.",
    cta: "Follow on X",
    href: LINKS.x,
    verificationLabel: "Add your X profile",
    verificationPlaceholder: "@yourhandle or x.com/yourhandle",
    note: "When we review your application, your account must still be following @TiredOfWeb3.",
  },
  {
    id: "share",
    number: "02",
    title: "Quote the pin",
    description:
      "Quote-tweet our pinned post (a plain repost / RT does not count).",
    cta: "Open pinned post",
    href: LINKS.pinnedPost,
    verificationLabel: "Add verification link",
    verificationPlaceholder: "Paste your quote-tweet URL (x.com/…)",
    note: "If your quote-tweet is deleted when we review your application, it will be refused.",
  },
  {
    id: "tag",
    number: "03",
    title: "Tag 3 friends",
    description:
      "Comment on the pinned post and tag 3 friends who are also tired of Web3.",
    cta: "Open comments",
    href: LINKS.pinnedPost,
    verificationLabel: "Add verification link",
    verificationPlaceholder: "Paste your comment URL (x.com/…/status/…)",
    note: "If your comment is deleted when we review the 3 tagged friends, your application will be denied.",
  },
] as const;

export type WlTaskId = (typeof WL_TASKS)[number]["id"];

export interface WlSubmission {
  id: string;
  xHandle: string;
  xProfile: string;
  wallet: string;
  whyTired: string;
  verificationLinks: {
    share: string;
    tag: string;
  };
  tasks: {
    follow: boolean;
    share: boolean;
    tag: boolean;
  };
  submittedAt: string;
}

const ETH_REGEX = /^0x[a-fA-F0-9]{40}$/;
const X_POST_URL_REGEX =
  /^https?:\/\/(www\.)?(x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/\d+/i;
const X_PROFILE_URL_REGEX =
  /^https?:\/\/(www\.)?(x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})\/?$/i;

export function isValidEthWallet(wallet: string): boolean {
  return ETH_REGEX.test(wallet.trim());
}

export function normalizeXHandle(handle: string): string {
  const cleaned = handle.trim().replace(/^@/, "");
  return cleaned.toLowerCase();
}

export function isValidXHandle(handle: string): boolean {
  const cleaned = normalizeXHandle(handle);
  return /^[a-zA-Z0-9_]{1,15}$/.test(cleaned);
}

/** Accepts @handle or x.com/handle (profile URL). Returns normalized handle or null. */
export function parseXProfileInput(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (value.startsWith("@") || /^[A-Za-z0-9_]{1,15}$/.test(value)) {
    const handle = normalizeXHandle(value);
    return isValidXHandle(handle) ? handle : null;
  }

  const match = value.match(X_PROFILE_URL_REGEX);
  if (match?.[3]) {
    const handle = match[3].toLowerCase();
    const reserved = ["home", "explore", "search", "i", "intent", "share", "settings"];
    if (reserved.includes(handle)) return null;
    return isValidXHandle(handle) ? handle : null;
  }

  return null;
}

export function isValidXPostUrl(url: string): boolean {
  return X_POST_URL_REGEX.test(url.trim());
}

export function isValidWhyTired(text: string): boolean {
  return text.trim().length >= 10;
}
