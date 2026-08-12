import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

export const CONTRACT_ADDRESS =
  "0x9D60d91044f1c501fEA4D2E95691b84Edd8CF4CB";

export const TOKEN_SYMBOL = "TIRED";
export const TOKEN_NAME = "Tired Of Web3";
export const WEBSITE = "https://hoodrpc.xyz";

export const DEX_CHAIN = process.env.DEX_CHAIN?.trim() || "robinhood";
export const DEX_POOL =
  process.env.DEX_POOL?.trim() ||
  "0xb3068128fd65834a4932f1bf721f6a5e85e8044f6173bca4e2cf09b2abc6f5a1";

export const DEXSCREENER_PAIR_URL = `https://dexscreener.com/${DEX_CHAIN}/${DEX_POOL}`;
export const DEXSCREENER_API_URL = `https://api.dexscreener.com/latest/dex/pairs/${DEX_CHAIN}/${DEX_POOL}`;

/** GeckoTerminal trades feed (works for Robinhood Uni v4 pools). */
export const GECKO_TRADES_URL =
  process.env.GECKO_TRADES_URL?.trim() ||
  `https://api.geckoterminal.com/api/v2/networks/${DEX_CHAIN}/pools/${DEX_POOL}/trades`;

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";

export const POLL_INTERVAL_MS = Math.max(
  15_000,
  Number(process.env.POLL_INTERVAL_MS) || 45_000,
);

export const DATA_PATH =
  process.env.DATA_PATH?.trim() || path.join(root, "data", "alerts.json");

/** Ignore buys below this USD (dust filter). Default $10. */
export const BUY_MIN_USD = Math.max(
  0,
  Number(process.env.BUY_MIN_USD) || 10,
);

/**
 * Image tiers by USD buy size (inclusive upper bounds):
 *   BUY_MIN .. BUY_TIER1_MAX     → small  (Hope thumbs-up)
 *   .. BUY_TIER2_MAX             → medium (red laser gorilla)
 *   .. below BUY_MASSIVE_MIN     → big    (purple shocked gorilla)
 *   ≥ BUY_MASSIVE_MIN            → massive (blue laser crane ape)
 */
export const BUY_TIER1_MAX = Math.max(
  BUY_MIN_USD,
  Number(process.env.BUY_TIER1_MAX) || 50,
);
export const BUY_TIER2_MAX = Math.max(
  BUY_TIER1_MAX,
  Number(process.env.BUY_TIER2_MAX) || 250,
);
/** Buys at/above this USD use the massive image. Default $1000. */
export const BUY_MASSIVE_MIN = Math.max(
  BUY_TIER2_MAX + 0.01,
  Number(process.env.BUY_MASSIVE_MIN) || 1000,
);
/** Upper bound for the "big" tier label helper (just below massive). */
export const BUY_TIER3_MAX = BUY_MASSIVE_MIN - 0.01;

/**
 * Banana count: min(BUY_BANANA_MAX, max(1, round(usd / BUY_BANANA_USD))).
 * Default $25/banana, cap 20 (massive buys can hit the max).
 */
export const BUY_BANANA_USD = Math.max(
  1,
  Number(process.env.BUY_BANANA_USD) || 25,
);
export const BUY_BANANA_MAX = Math.min(
  30,
  Math.max(1, Number(process.env.BUY_BANANA_MAX) || 20),
);

/**
 * Optional comma-separated chat IDs to enable on boot when the store has no
 * buybot chats yet (e.g. first cloud deploy with an empty volume).
 * Example: BUYBOT_SEED_CHATS=-1004310837318
 */
export const BUYBOT_SEED_CHATS: number[] = (process.env.BUYBOT_SEED_CHATS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => Number(s))
  .filter((n) => Number.isFinite(n) && n !== 0);

export const ASSETS_DIR =
  process.env.ASSETS_DIR?.trim() || path.join(root, "assets");

export const BUY_IMAGE_SMALL = path.join(ASSETS_DIR, "buy-small.png");
export const BUY_IMAGE_MEDIUM = path.join(ASSETS_DIR, "buy-medium.png");
export const BUY_IMAGE_LARGE = path.join(ASSETS_DIR, "buy-large.png");
export const BUY_IMAGE_MASSIVE = path.join(ASSETS_DIR, "buy-massive.png");

export function requireToken(): string {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN is missing. Copy .env.example → .env and paste your @BotFather token.",
    );
  }
  return TELEGRAM_BOT_TOKEN;
}
