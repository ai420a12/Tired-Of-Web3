export const CONTRACT_ADDRESS = "TBA";

export const LINKS = {
  x: "https://x.com/TiredOfWeb3",
  /** Update this to your actual pinned tweet URL when ready */
  pinnedPost: "https://x.com/TiredOfWeb3",
  telegram: null as string | null,
  discord: null as string | null,
  opensea: null as string | null,
  dexscreener: `https://dexscreener.com/solana/${CONTRACT_ADDRESS}`,
  buy: `https://pump.fun/coin/${CONTRACT_ADDRESS}`,
  wl: "/wl",
} as const;

export const MASCOT_QUOTES = [
  "Another rug? I'm tired.",
  "Wen Mars? I'm too tired to care.",
  "Dev sold? Shocking. I'm exhausted.",
  "100x or 0x. Either way I need a nap.",
  "Alpha group charged me $500 to say 'gm'.",
  "They said 'community owned'. I own bags of regret.",
  "Gas fees higher than my will to live.",
  "Influencer shilled it. I shilled my soul.",
  "Roadmap? I can barely map my way to bed.",
  "Diamond hands? More like depleted uranium hands.",
] as const;

export const TOKENOMICS = [
  {
    title: "Total Supply",
    value: "1,000,000,000",
    unit: "$TIRED",
    reaction: "A billion tokens. A billion disappointments. Familiar.",
    emoji: "😮‍💨",
  },
  {
    title: "Buy Tax",
    value: "5%",
    unit: "on every buy",
    reaction: "5% to keep the lights on. We're tired, not broke.",
    emoji: "🫠",
  },
  {
    title: "Sell Tax",
    value: "5%",
    unit: "on every sell",
    reaction: "Paper hands pay the toll. We're all tired here.",
    emoji: "📄",
  },
  {
    title: "Burn Tax",
    value: "1%",
    unit: "auto-burned on every trade",
    reaction: "Finally burning something that deserves it.",
    emoji: "🔥",
  },
  {
    title: "Liquidity",
    value: "Locked",
    unit: "probably. we're too tired to rug.",
    reaction: "LP locked. Unlike my therapist's schedule.",
    emoji: "🔒",
  },
  {
    title: "Contract",
    value: "Renounced",
    unit: "dev gave up control. finally.",
    reaction: "Ownership renounced. We can't rug even if we wanted to. Too tired.",
    emoji: "📜",
  },
] as const;

export const ROADMAP = [
  {
    phase: "Phase 1",
    title: "Tired Launch",
    items: [
      "Deploy token while half asleep",
      "Post 'we're so back' (we're not)",
      "Survive first 24 hours without rugging",
      "Mascot achieves consciousness, immediately regrets it",
    ],
    mood: "exhausted",
  },
  {
    phase: "Phase 2",
    title: "Tired of Rugs",
    items: [
      "AI Agent roasts every scam on the timeline",
      "Auto-meme generator for bad projects",
      "No treasury to exploit — we're tired of that too",
      "List on every DEX that'll have us",
    ],
    mood: "cynical",
  },
  {
    phase: "Phase 3",
    title: "Tired of Earth → Mars",
    items: [
      "10K ETH NFT collection — minted directly on OpenSea. No Discord roles needed. A secret snapshot of your $TIRED bags decides your mint: more tokens = more free mints, fewer tokens = still cheaper than public, zero tokens = full price (time to reflect). Splitting across wallets won't work — there's a secret minimum hold, and a cluster agent flags linked wallets on-chain.",
      "Elon tweets about us (he won't)",
      "Actually leave Earth (we won't)",
      "Mars colony for people tired of rugs",
      "Final phase: eternal nap in space",
    ],
    mood: "delusional",
  },
] as const;

export const TESTIMONIALS = [
  {
    name: "DownBadDave.sol",
    quote:
      "Token isn't even deployed yet and it's already changing my life. My therapist disagrees but CT doesn't.",
    rating: 5,
  },
  {
    name: "RugVictim#42069",
    quote:
      "Lost my car, house, and wife to Ansem. $TIRED is the first coin that might actually help. Might.",
    rating: 5,
  },
  {
    name: "WenLamboNever",
    quote:
      "Aped before deployment. No chart, no CA, no liquidity — just vibes and emotional damage. 10/10.",
    rating: 4,
  },
  {
    name: "CTIsACircus",
    quote:
      "Ansem hasn't tweeted about us yet. That's either bearish or we're so early it hurts. I'm too tired to tell.",
    rating: 5,
  },
  {
    name: "GCRsLeftNut",
    quote:
      "Followed 12 KOLs into the ground this month. First project honest enough to say the contract is TBA.",
    rating: 5,
  },
  {
    name: "SolanaSummerVictim",
    quote:
      "My wife's boyfriend said wait for deployment. I refreshed the site 400 times. We're so back. We're not back.",
    rating: 5,
  },
] as const;

export const AGENT_MESSAGES = [
  "Scanning new launches... already tired.",
  "Detected rug pull in progress. Shocking. Absolutely shocking.",
  "Generating roast for 'SafeMoon 2.0'... insufficient vocabulary.",
  "Influencer alert: paid shill detected. Deploying sarcasm.",
  "Your portfolio is down 90%. Have you tried being tired?",
  "New meme generated: 'dev sold, community bought therapy.'",
  "Mars mission status: cancelled. Too tired.",
] as const;
