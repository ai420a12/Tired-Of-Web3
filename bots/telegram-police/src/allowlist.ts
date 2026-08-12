/**
 * Official Tired / $TIRED surfaces — never treat these as shills.
 * Keep in sync with FAQ knowledge + site.
 */

export const OFFICIAL_CA =
  "0x9d60d91044f1c501fea4d2e95691b84edd8cf4cb".toLowerCase();

export const OFFICIAL_POOL =
  "0xb3068128fd65834a4932f1bf721f6a5e85e8044f6173bca4e2cf09b2abc6f5a1".toLowerCase();

export const FEE_WALLET =
  "0xe4716f28d07497f71f275c7dd1962e94b37cf849".toLowerCase();

/** Hostnames (lowercase, no www.) that are always allowed. */
export const ALLOWED_HOSTS = new Set([
  "hoodrpc.xyz",
  "www.hoodrpc.xyz",
  "tiredofweb3.xyz",
  "www.tiredofweb3.xyz",
  "ponsfamily.com",
  "www.ponsfamily.com",
  "dexscreener.com",
  "www.dexscreener.com",
  "geckoterminal.com",
  "www.geckoterminal.com",
  "opensea.io",
  "www.opensea.io",
  "t.me",
  "telegram.me",
  "discord.gg",
  "discord.com",
  "x.com",
  "twitter.com",
  "instagram.com",
  "www.instagram.com",
  "linkedin.com",
  "www.linkedin.com",
  "blockscout.com",
  "robinhood.com",
  "www.robinhood.com",
  "giphy.com",
  "media.giphy.com",
  "tenor.com",
  "media.tenor.com",
]);

/** Path/query snippets that confirm an official X/TG/Discord link. */
export const ALLOWED_SOCIAL_HINTS = [
  "tiredofweb3",
  "tired_faq",
  "tiredfaq",
  "ai420a12",
  "tired of web3",
];

export function isAllowedUrl(raw: string): boolean {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase();
    if (ALLOWED_HOSTS.has(host)) {
      // DexScreener / Gecko: allow robinhood + our pool; still allow general RH charts
      if (host.includes("dexscreener") || host.includes("geckoterminal")) {
        return true;
      }
      if (host === "t.me" || host === "telegram.me") {
        const path = u.pathname.toLowerCase();
        // Allow official-ish Tired rooms; unknown invite links get AI review
        if (
          ALLOWED_SOCIAL_HINTS.some((h) => path.includes(h.replace(/\s/g, "")))
        ) {
          return true;
        }
        // Generic t.me links → not auto-allowed (AI decides)
        return false;
      }
      if (host === "x.com" || host === "twitter.com") {
        const path = u.pathname.toLowerCase();
        return ALLOWED_SOCIAL_HINTS.some((h) =>
          path.includes(h.replace(/\s/g, "")),
        );
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function extractUrls(text: string): string[] {
  const out: string[] = [];
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[0].replace(/[.,;:!?)]+$/, ""));
  // bare domains common in crypto spam
  const bare = /(?:^|\s)((?:[a-z0-9-]+\.)+(?:com|xyz|io|net|app|fi|gg|org|co)(?:\/[^\s]*)?)/gi;
  while ((m = bare.exec(text))) {
    const cand = m[1];
    if (!out.some((u) => u.includes(cand))) out.push(`https://${cand}`);
  }
  return out;
}

export function extractEthAddresses(text: string): string[] {
  return (text.match(/0x[a-fA-F0-9]{40}/g) || []).map((a) => a.toLowerCase());
}
