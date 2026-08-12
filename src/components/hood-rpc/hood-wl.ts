export const HOOD_RPC_LINKS = {
  x: "https://x.com/TiredOfWeb3",
  /** Open profile — users quote the pinned post from here */
  pinnedPost: "https://x.com/TiredOfWeb3/status/2084745609936830558",
  home: "/hood-rpc",
  wl: "/hood-rpc/wl",
  /** Live OpenSea collection */
  opensea: "https://opensea.io/collection/hoodrpc",
} as const;

/** Aug 12 2026, 19:00 UK (BST / Europe/London) */
export const HOOD_NFT_DROP_AT = new Date("2026-08-12T18:00:00.000Z");
/** Aug 16 2026, 19:00 UK (BST) */
export const HOOD_PLATFORM_LIVE_AT = new Date("2026-08-16T18:00:00.000Z");

export const HOOD_RPC_WL_TASKS = [
  {
    id: "follow" as const,
    number: "01",
    title: "Follow us",
    description: "Follow @TiredOfWeb3 on X and stay locked on the feed.",
    cta: "Follow on X",
    href: HOOD_RPC_LINKS.x,
    verificationLabel: "Add your X profile",
    verificationPlaceholder: "@yourhandle or x.com/yourhandle",
    note: "When we review your application, your account must still be following @TiredOfWeb3.",
  },
  {
    id: "share" as const,
    number: "02",
    title: "Quote the pin",
    description:
      "Quote-tweet our pinned post (a plain repost / RT does not count).",
    cta: "Open pinned post",
    href: HOOD_RPC_LINKS.pinnedPost,
    verificationLabel: "Add verification link",
    verificationPlaceholder: "Paste your quote-tweet URL (x.com/…)",
    note: "If your quote-tweet is deleted when we review your application, it will be refused.",
  },
  {
    id: "tag" as const,
    number: "03",
    title: "Tag 3 friends",
    description:
      "Comment on the pinned post and tag 3 friends who want HOOD_RPC WL.",
    cta: "Open comments",
    href: HOOD_RPC_LINKS.pinnedPost,
    verificationLabel: "Add verification link",
    verificationPlaceholder: "Paste your comment URL (x.com/…/status/…)",
    note: "If your comment is deleted when we review the 3 tagged friends, your application will be denied.",
  },
];

export type HoodWlTaskId = (typeof HOOD_RPC_WL_TASKS)[number]["id"];
