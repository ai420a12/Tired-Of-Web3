export const CONTRACT_ADDRESS =
  "0x9D60d91044f1c501fEA4D2E95691b84Edd8CF4CB";

/** Factory funding wallet — 100% of trading fees land here. Swap TBA when ready. */
export const FACTORY_WALLET: string =
  "0xe4716f28d07497F71F275c7dd1962E94B37cf849";

/** USD goal to open the Tired factory (warehouse + machines). */
export const FACTORY_GOAL_USD = 250_000;

/**
 * Display floor for factory raised USD (GoalBar /api/factory-goal).
 * Live wallet ETH→USD is used when it exceeds this; otherwise this value shows.
 */
export const FACTORY_RAISED_USD = 11_486;

/** How often the GoalBar refreshes live ETH → USD from /api/factory-goal. */
export const FACTORY_GOAL_POLL_MS = 3 * 60 * 1000;

/** DexScreener network slug for Robinhood Chain (not EIP-155 4663). */
export const DEX_CHAIN = "robinhood";

/**
 * Uniswap v4 TIRED/ETH pool on Robinhood (post-grad).
 * Do not use the old Pons pool (0xd39d…) or the tiny USDG v4 pool.
 */
export const DEX_POOL_ADDRESS =
  "0xb3068128fd65834a4932f1bf721f6a5e85e8044f6173bca4e2cf09b2abc6f5a1";

export const LINKS = {
  x: "https://x.com/TiredOfWeb3",
  pinnedPost: "https://x.com/TiredOfWeb3/status/2084745609936830558",
  telegram: "https://t.me/TiredOfWeb3Factory" as string | null,
  discord: "https://discord.gg/tiredofweb3" as string | null,
  opensea: "https://opensea.io/collection/tired-of-web3-/overview",
  /** Live chart — DexScreener Uniswap v4 TIRED/ETH pool. */
  chart: `https://dexscreener.com/${DEX_CHAIN}/${DEX_POOL_ADDRESS}`,
  dexscreener: `https://dexscreener.com/${DEX_CHAIN}/${DEX_POOL_ADDRESS}`,
  buy: `https://www.ponsfamily.com/launchpad/${CONTRACT_ADDRESS}`,
  wl: "/wl",
  nfc: "https://x.com/NFCSummit",
  johnKarp: "https://x.com/johnkarp",
  jorgeX: "https://x.com/Ai420a12",
  jorgeInstagram: "https://www.instagram.com/ai420a12/",
  jorgeLinkedIn: "https://www.linkedin.com/in/jorge-m-b22512423/",
  sneakpeeks: "/sneakpeeks",
} as const;

export const FACTORY_MACHINES = [
  {
    id: "embroidery",
    name: "6-Head Embroidery Machines",
    description:
      "Multi-head embroidery for premium hats, hoodies, and stitched collectibles — the kind that lasts longer than a wash cycle.",
    image: "/images/factory/machine-embroidery.png",
  },
  {
    id: "cnc",
    name: "5-Axis CNC Machines",
    description:
      "Precision carving for sculptures, plaques, and physical collectibles at any scale — not another cheap resin blob.",
    image: "/images/factory/machine-cnc.png",
  },
  {
    id: "uv",
    name: "UV Printers",
    description:
      "Full-color UV printing on signs, acrylic, metal, and packaging — Tiredboxes and Peniboxes included.",
    image: "/images/factory/machine-uv-printer.png",
  },
  {
    id: "stamper",
    name: "Stampers",
    description:
      "Industrial stamping for metal, tokens, and high-detail embossed pieces that feel like real collectibles.",
    image: "/images/factory/machine-stamper.png",
  },
  {
    id: "duster",
    name: "Dusters",
    description:
      "Finishing equipment for clean coats and powder application so every piece leaves the floor looking factory-fresh.",
    image: "/images/factory/machine-duster.png",
  },
  {
    id: "air",
    name: "Air Filtration",
    description:
      "Industrial air filtration so the warehouse stays safe while we run dust, powder, and print jobs all day.",
    image: "/images/factory/machine-air-filtration.png",
  },
  {
    id: "pvc",
    name: "PVC Liquid Disposer Machines",
    description:
      "Proper liquid waste handling for PVC and manufacturing runoff — build a factory that doesn't trash the planet.",
    image: "/images/factory/machine-pvc-disposer.png",
  },
  {
    id: "oven",
    name: "Ovens",
    description:
      "Curing ovens for coatings, plastics, and finished goods that need heat to lock in quality.",
    image: "/images/factory/machine-oven.png",
  },
  {
    id: "pressure",
    name: "Hot & Cold Pressure Machines",
    description:
      "Heat presses and cold-pressure systems for apparel, transfers, and layered merch that survives real life.",
    image: "/images/factory/machine-pressure.png",
  },
] as const;

export const MERCH_CATALOG = [
  {
    id: "tired-hoodie-zip",
    label: "Tired zip hoodie",
    category: "Apparel",
    image: "/images/merch/tired-hoodie-zip.png",
  },
  {
    id: "tired-tracksuit",
    label: "Tired tracksuit",
    category: "Apparel",
    image: "/images/merch/tired-tracksuit.png",
  },
  {
    id: "tired-tee-beanie",
    label: "Tired tee & beanie",
    category: "Apparel",
    image: "/images/merch/tired-tee-beanie.png",
  },
  {
    id: "tired-mars-cap",
    label: "Tired Mars drop",
    category: "Apparel",
    image: "/images/merch/tired-mars-cap.png",
  },
  {
    id: "penimals-grey-tee",
    label: "Penimals grey tee",
    category: "Apparel",
    image: "/images/merch/penimals-grey-tee.png",
  },
  {
    id: "penimals-pink-tee",
    label: "Penimals pink tee",
    category: "Apparel",
    image: "/images/merch/penimals-pink-tee.png",
  },
  {
    id: "penimals-print-tee",
    label: "Penimals print tee",
    category: "Apparel",
    image: "/images/merch/penimals-print-tee.png",
  },
  {
    id: "penimals-cream-tee",
    label: "Penimals cream tee",
    category: "Apparel",
    image: "/images/merch/penimals-cream-tee.png",
  },
  {
    id: "nft-collab-hoodie",
    label: "Custom NFT hoodie",
    category: "NFT Merch",
    image: "/images/merch/nft-collab-hoodie.png",
  },
  {
    id: "collectible-cryptopunk",
    label: "CryptoPunk",
    category: "Collectible",
    image: "/images/merch/collectible-cryptopunk.png",
  },
  {
    id: "collectible-creepz",
    label: "Creepz",
    category: "Collectible",
    image: "/images/merch/collectible-creepz.png",
  },
  {
    id: "collectible-bayc",
    label: "BAYC",
    category: "Collectible",
    image: "/images/merch/collectible-bayc.png",
  },
  {
    id: "collectible-penimals",
    label: "Penimals",
    category: "Collectible",
    image: "/images/merch/collectible-penimals.png",
  },
  {
    id: "collectible-voxel",
    label: "Norman by Meebits",
    category: "Collectible",
    image: "/images/merch/collectible-voxel.png",
  },
  {
    id: "framed-acrylic-art",
    label: "Chromie Squiggle by Snowfro",
    category: "Digital PVC display",
    image: "/images/merch/framed-acrylic-art.png",
  },
  {
    id: "framed-chromie-art",
    label: "Fidenza by Tyler Hobbs",
    category: "Physical prints",
    image: "/images/merch/framed-chromie-art.png",
  },
] as const;

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
    emoji: "💪",
  },
  {
    title: "Buy Tax",
    value: "4%",
    unit: "on every buy",
    reaction: "4% to keep the lights on. We're tired, not broke.",
    emoji: "🫠",
  },
  {
    title: "Sell Tax",
    value: "4%",
    unit: "on every sell",
    reaction: "Paper hands pay the toll. We're all tired here.",
    emoji: "📄",
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
      {
        text: "Deploy the $TIRED memecoin on Robinhood while half asleep",
        done: true,
      },
      { text: "Pay for DEX before our eyes close", done: true },
      { text: "Survive the first 24 hours without rugging", done: true },
      {
        text: "Lock the supply and always make transparency posts about anything we do.",
        done: true,
      },
    ],
    mood: "exhausted",
  },
  {
    phase: "Phase 2",
    title: "Production + Support",
    items: [
      {
        text: "Secure the funding to open the factory and buy the machines",
        done: false,
      },
      {
        text: "Offer free 1:1 support for anyone in the space who's feeling down",
        done: false,
      },
      { text: "Prepare our own Robinhood NFT collection", done: false },
      {
        text: "Deploy the $TIRED collection — 10K Robinhood NFTs minted directly on OpenSea. A snapshot of your $TIRED bags decides your mint: Bigger WL for the Tired NFT collection, fewer tokens = still cheaper than public, zero tokens = full price (time to reflect). Splitting across wallets won't work — there's a minimum hold, and a cluster agent flags linked wallets on-chain.",
        done: false,
      },
    ],
    mood: "cynical",
  },
  {
    phase: "Phase 3",
    title: "Tired of Earth → Mars",
    items: [
      {
        text: "Open the factory and take our MarketPlace live online",
        done: false,
      },
      { text: "Activate our Staking mechanism", done: false },
      {
        text: "Donate signs and merch to as many NFT events as possible",
        done: false,
      },
      { text: "Make a statue for Adam Weitsman", done: false },
      { text: "Mars colony for people tired of rugs", done: false },
      { text: "Final phase: eternal nap in space", done: false },
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
