export type LaunchStatus = "LIVE" | "SOON" | "ENDED";

export type MemecoinLaunch = {
  id: string;
  ticker: string;
  name: string;
  age: string;
  liquidity: string;
  mcap: string;
  status: LaunchStatus;
  logo: string;
};

export type UpcomingNft = {
  id: string;
  name: string;
  mintTime: string;
  supply: string;
  price: string;
  countdown: string;
  etaSeconds: number;
  mintAtMs: number;
  logo: string;
  collectionSlug: string;
  openseaUrl: string;
};

export type NftSaleKind = "eth" | "weth";

export type HoodNftSale = {
  id: string;
  tokenName: string;
  collection: string;
  collectionSlug: string;
  openseaUrl: string;
  eth: number;
  usd: number;
  ago: string;
  kind: NftSaleKind;
  image: string;
  rarityRank: number;
  rarityLabel: string;
  rarityUnavailable?: boolean;
  traits: { trait: string; value: string }[];
  /** Unix seconds — used to keep NFT Live newest-first across polls */
  eventTs?: number;
};

export const FEATURES = [
  { label: "ULTRA FAST\nLOW LATENCY", icon: "bolt" },
  { label: "PRECISION\nSNIPING", icon: "crosshair" },
  { label: "MEMECOINS\n& NFTs", icon: "coins" },
  { label: "RELIABLE\n& SECURE", icon: "shield" },
  { label: "MAXIMUM\nSUCCESS", icon: "chart" },
] as const;

export const TICKER_ITEMS = [
  "GLOBAL NODES",
  "SUB-100MS RESPONSE",
  "99.99% UPTIME",
  "PRIVATE & SECURE",
  "DOMINATE EVERY LAUNCH",
] as const;

/** Real Robinhood Chain collections on OpenSea (volume-active + curated). */
export const HOOD_COLLECTIONS = [
  {
    name: "Robinhood Punks",
    slug: "robinhood-punks",
    image: "/images/hood-rpc/nfts/robinhood-punks.png",
    twitter: "https://x.com/RobinhoodPunks",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/robinhood-punks",
  },
  {
    name: "Chain Mancers",
    slug: "chain-mancers",
    image: "/images/hood-rpc/nfts/chain-mancer.jpeg",
    twitter: "https://x.com/search?q=ChainMancers",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/chain-mancers",
  },
  {
    name: "StonkBrokers",
    slug: "stonkbrokers-434284142",
    image: "/images/hood-rpc/nfts/robin-chainmancer.png",
    twitter: "https://x.com/search?q=StonkBrokers",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/stonkbrokers-434284142",
  },
  {
    name: "PitBoys",
    slug: "pitboys",
    image: "/images/hood-rpc/nfts/mancer.png",
    twitter: "https://x.com/search?q=PitBoys",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/pitboys",
  },
  {
    name: "MonkeyHood",
    slug: "monkeyhoodnfts",
    image: "/images/hood-rpc/nfts/zeroguy.jpeg",
    twitter: "https://x.com/search?q=MonkeyHood",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/monkeyhoodnfts",
  },
  {
    name: "Broker Punks",
    slug: "broker-punks-nft",
    image: "/images/hood-rpc/nfts/robinhood-punks.png",
    twitter: "https://x.com/search?q=BrokerPunks",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/broker-punks-nft",
  },
  {
    name: "Cash Cats",
    slug: "cashcatss",
    image: "/images/hood-rpc/nfts/zerohood.jpeg",
    twitter: "https://x.com/search?q=CashCats",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/cashcatss",
  },
  {
    name: "Hoodie Groupies",
    slug: "hoodiegroupies",
    image: "/images/hood-rpc/nfts/ambahood.jpeg",
    twitter: "https://x.com/search?q=HoodieGroupies",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/hoodiegroupies",
  },
  {
    name: "Merry Men",
    slug: "merrymennft",
    image: "/images/hood-rpc/nfts/slonks.jpeg",
    twitter: "https://x.com/search?q=MerryMen",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/merrymennft",
  },
  {
    name: "Zerohood",
    slug: "zerohood",
    image: "/images/hood-rpc/nfts/zerohood.jpeg",
    twitter: "https://x.com/search?q=Zerohood",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/zerohood",
  },
] as const;

/** Curated Ethereum collections for ETH_RPC dashboard */
export const ETH_COLLECTIONS = [
  {
    name: "Tired Of Web3",
    slug: "tired-of-web3",
    image: "/images/hood-rpc/tired-of-web3-blue.png",
    twitter: "https://x.com/tiredofweb3",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/tired-of-web3/overview",
  },
  {
    name: "Bored Ape Yacht Club",
    slug: "boredapeyachtclub",
    image: "/images/hood-rpc/mascot-lime.png",
    twitter: "https://x.com/BoredApeYC",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/boredapeyachtclub",
  },
  {
    name: "Azuki",
    slug: "azuki",
    image: "/images/hood-rpc/mascot-lime.png",
    twitter: "https://x.com/Azuki",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/azuki",
  },
  {
    name: "Pudgy Penguins",
    slug: "pudgypenguins",
    image: "/images/hood-rpc/mascot-lime.png",
    twitter: "https://x.com/pudgypenguins",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/pudgypenguins",
  },
  {
    name: "Doodles",
    slug: "doodles-official",
    image: "/images/hood-rpc/mascot-lime.png",
    twitter: "https://x.com/doodles",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/doodles-official",
  },
  {
    name: "Mutant Ape Yacht Club",
    slug: "mutant-ape-yacht-club",
    image: "/images/hood-rpc/mascot-lime.png",
    twitter: "https://x.com/BoredApeYC",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/mutant-ape-yacht-club",
  },
  {
    name: "Clone X",
    slug: "clonex",
    image: "/images/hood-rpc/mascot-lime.png",
    twitter: "https://x.com/RTFKT",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/clonex",
  },
  {
    name: "Moonbirds",
    slug: "proof-moonbirds",
    image: "/images/hood-rpc/mascot-lime.png",
    twitter: "https://x.com/moonbirds",
    discord: "https://discord.com",
    website: "https://opensea.io/collection/proof-moonbirds",
  },
] as const;

export type HoodCollection = (typeof HOOD_COLLECTIONS)[number];
export type EthCollection = (typeof ETH_COLLECTIONS)[number];

export function getHoodCollection(slug: string): HoodCollection {
  return (
    HOOD_COLLECTIONS.find((c) => c.slug === slug) ?? HOOD_COLLECTIONS[0]
  );
}

const MEME_TOKENS = [
  {
    ticker: "PEPE2",
    name: "Pepe Reloaded",
    logo: "/images/hood-rpc/tokens/pepe.png",
  },
  {
    ticker: "HOODAI",
    name: "Hood Agent",
    logo: "/images/hood-rpc/tokens/hoodai.png",
  },
  {
    ticker: "SNIPE",
    name: "Sniper Cat",
    logo: "/images/hood-rpc/tokens/rh.png",
  },
  {
    ticker: "WIFX",
    name: "Wif Xtreme",
    logo: "/images/hood-rpc/tokens/wif.png",
  },
  {
    ticker: "BONK2",
    name: "Bonk Sequel",
    logo: "/images/hood-rpc/tokens/bonk.png",
  },
  {
    ticker: "RUGLESS",
    name: "No Rug Club",
    logo: "/images/hood-rpc/tokens/eth.png",
  },
  {
    ticker: "FROG",
    name: "Frog Protocol",
    logo: "/images/hood-rpc/tokens/pepe.png",
  },
  {
    ticker: "DOGEAI",
    name: "Doge AI",
    logo: "/images/hood-rpc/tokens/doge.png",
  },
  {
    ticker: "PUMPIT",
    name: "Pump It",
    logo: "/images/hood-rpc/tokens/sol.png",
  },
  {
    ticker: "GREEN",
    name: "Lime Coin",
    logo: "/images/hood-rpc/tokens/rh.png",
  },
] as const;

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

function ethPrice(i: number): number {
  const base = [0.012, 0.028, 0.042, 0.069, 0.088, 0.12, 0.25, 0.41, 0.77, 1.2];
  return base[i % base.length] + (i % 7) * 0.001;
}

function collectionUrl(slug: string) {
  return `https://opensea.io/collection/${slug}`;
}

export function makeLaunches(count = 10, seed = 0): MemecoinLaunch[] {
  return Array.from({ length: count }, (_, i) => {
    const n = seed + i;
    const token = pick(MEME_TOKENS, n);
    const status: LaunchStatus =
      n % 5 === 0 ? "SOON" : n % 11 === 0 ? "ENDED" : "LIVE";
    return {
      id: `launch-${seed}-${i}`,
      ticker: `$${token.ticker}`,
      name: token.name,
      age: status === "SOON" ? "T-" + ((n % 9) + 1) + "m" : (n % 40) + "s",
      liquidity: `$${(12 + (n % 80) * 1.7).toFixed(1)}k`,
      mcap: `$${(40 + (n % 120) * 3.2).toFixed(0)}k`,
      status,
      logo: token.logo,
    };
  });
}

export function makeNfts(count = 8, seed = 0): UpcomingNft[] {
  const rows = Array.from({ length: count }, (_, i) => {
    const n = seed + i;
    const col = pick(HOOD_COLLECTIONS, n);
    // Soonest first: ~20m, 45m, 1h20m, … spaced out
    const etaSeconds = 20 * 60 + i * (25 * 60) + ((n * 17) % 40) * 60;
    const hours = Math.floor(etaSeconds / 3600);
    const mins = Math.floor((etaSeconds % 3600) / 60);
    const secs = etaSeconds % 60;
    const mintLabel =
      hours > 0 ? `in ${hours}h` : mins > 0 ? `in ${mins}m` : "soon";
    const mintAtMs = Date.now() + etaSeconds * 1000;
    return {
      id: `nft-${seed}-${i}`,
      name: col.name,
      mintTime: mintLabel,
      supply: `${(2222 + n * 111).toLocaleString()}`,
      price: n % 3 === 0 ? "FREE" : `${(0.02 + (n % 8) * 0.01).toFixed(2)} ETH`,
      countdown: `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
      etaSeconds,
      mintAtMs,
      logo: col.image,
      collectionSlug: col.slug,
      openseaUrl: collectionUrl(col.slug),
    };
  });
  return rows.sort((a, b) => a.mintAtMs - b.mintAtMs);
}

const AGOS = ["just now", "12s ago", "28s ago", "1m ago", "2m ago", "3m ago", "5m ago"];
const TRAIT_POOLS = [
  ["Background", "Neon Lime"],
  ["Background", "Void Black"],
  ["Eyes", "Laser"],
  ["Eyes", "Hooded"],
  ["Head", "Feather Cap"],
  ["Mouth", "Grin"],
  ["Accessory", "RPC Badge"],
  ["Body", "Pixel Hoodie"],
] as const;

function rarityFor(n: number) {
  const bands = [5, 28, 120, 380, 750, 2400];
  const rank = bands[n % bands.length] + (n % 7);
  const traits = [
    { trait: pick(TRAIT_POOLS, n)[0], value: pick(TRAIT_POOLS, n)[1] },
    { trait: pick(TRAIT_POOLS, n + 3)[0], value: pick(TRAIT_POOLS, n + 3)[1] },
    { trait: pick(TRAIT_POOLS, n + 5)[0], value: pick(TRAIT_POOLS, n + 5)[1] },
  ];
  return { rarityRank: rank, rarityLabel: "", traits };
}

export function makeHoodSales(count = 16, seed = 0): HoodNftSale[] {
  return Array.from({ length: count }, (_, i) => {
    const n = seed + i;
    const col = pick(HOOD_COLLECTIONS, n);
    const eth = ethPrice(n);
    const tokenId = 1000 + ((n * 37) % 9000);
    const rarity = rarityFor(n);
    return {
      id: `sale-${seed}-${i}`,
      tokenName: `${col.name.split(" ")[0]} #${tokenId}`,
      collection: col.name,
      collectionSlug: col.slug,
      openseaUrl: collectionUrl(col.slug),
      eth,
      usd: eth * 3240,
      ago: AGOS[Math.min(i, AGOS.length - 1)],
      kind: n % 4 === 0 ? "weth" : "eth",
      image: col.image,
      ...rarity,
    };
  });
}

export function makeProjectSales(
  collectionSlug: string,
  collectionName: string,
  count = 12,
  seed = 0,
): HoodNftSale[] {
  const col = getHoodCollection(collectionSlug);
  return Array.from({ length: count }, (_, i) => {
    const n = seed + i;
    const eth = ethPrice(n + 3);
    const short = collectionName.split(" ")[0];
    const rarity = rarityFor(n + 11);
    return {
      id: `psale-${collectionSlug}-${seed}-${i}`,
      tokenName: `${short} #${200 + ((n * 19) % 8000)}`,
      collection: collectionName,
      collectionSlug,
      openseaUrl: collectionUrl(collectionSlug),
      eth,
      usd: eth * 3240,
      ago: AGOS[Math.min(i, AGOS.length - 1)],
      kind: n % 5 === 0 ? "weth" : "eth",
      image: col.image,
      ...rarity,
    };
  });
}

export function makeProjectListings(
  collectionSlug: string,
  collectionName: string,
  count = 12,
  seed = 0,
): HoodNftSale[] {
  const col = getHoodCollection(collectionSlug);
  return Array.from({ length: count }, (_, i) => {
    const n = seed + i + 11;
    const eth = ethPrice(n) * 0.92;
    const short = collectionName.split(" ")[0];
    const rarity = rarityFor(n + 29);
    return {
      id: `plist-${collectionSlug}-${seed}-${i}`,
      tokenName: `${short} #${500 + ((n * 23) % 8000)}`,
      collection: collectionName,
      collectionSlug,
      openseaUrl: collectionUrl(collectionSlug),
      eth,
      usd: eth * 3240,
      ago: AGOS[Math.min(i, AGOS.length - 1)],
      kind: "eth" as const,
      image: col.image,
      ...rarity,
    };
  });
}
