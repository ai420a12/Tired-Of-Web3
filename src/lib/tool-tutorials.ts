import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";

export type TutBeat = {
  text: string;
  target?: string;
  holdMs?: number;
};

export type ToolTutorialId =
  | "top-tx"
  | "nft-live"
  | "project-sales"
  | "project-listings"
  | "live-mint"
  | "upcoming-nfts"
  | "memecoin-launches"
  | "arm-nft"
  | "arm-meme"
  | "squad"
  | "load-wallets"
  | "generate-wallets"
  | "master-split"
  | "mint-outcomes"
  | "ticker-outcomes";

export type ToolTutorial = {
  id: ToolTutorialId;
  title: string;
  beats: TutBeat[];
};

function desk(variant: HoodRpcVariant) {
  return variant === "eth" ? "E.T.H. R.P.C." : "Hood R.P.C.";
}

function chain(variant: HoodRpcVariant) {
  return variant === "eth" ? "Ethereum" : "Robinhood";
}

export function getToolTutorial(
  id: ToolTutorialId,
  variant: HoodRpcVariant,
): ToolTutorial {
  const d = desk(variant);
  const c = chain(variant);

  const scripts: Record<ToolTutorialId, ToolTutorial> = {
    "top-tx": {
      id: "top-tx",
      title: "Top TX",
      beats: [
        {
          text: `This board ranks real ${d} activity, not fake profit.`,
          target: ".hrpc-pnl-board",
        },
        {
          text: "Every snipe and mint we can prove on this site adds one transaction to a wallet.",
          target: ".hrpc-pnl-list, .hrpc-pnl-empty",
        },
        {
          text: "Set a username in Profile so you show up as a name, not just a 0x address.",
          target: ".hrpc-profile-btn",
        },
        {
          text: "The board refreshes on its own. More tracked transactions means a higher rank.",
          target: ".hrpc-pnl-val, .hrpc-pnl-head",
        },
      ],
    },
    "nft-live": {
      id: "nft-live",
      title: "NFT Live",
      beats: [
        {
          text: `NFT Live is a live ${c} sales tape from OpenSea. New trades roll in continuously.`,
          target: "#nft-live [data-tut='nft-live']",
        },
        {
          text: "Colors on the rank legend tell you how rare a piece is at a glance.",
          target: "#nft-live .hrpc-rarity-legend, #nft-live [data-tut='nft-live'] h2",
        },
        {
          text: "Click any row to lock that collection. That loads Project Sales and Listings on the right.",
          target: "#nft-live .hrpc-table, #nft-live .hrpc-nft-empty",
        },
        {
          text: "Hover a thumbnail for a bigger preview. This board is for spotting what is actually trading right now.",
          target: "#nft-live [data-tut='nft-live']",
        },
      ],
    },
    "project-sales": {
      id: "project-sales",
      title: "Project Sales",
      beats: [
        {
          text: "Project Sales only fills after you click a collection on NFT Live.",
          target: "[data-tut='project-sales']",
        },
        {
          text: "Then you see that project's recent sales, prices, and timing — not the whole chain.",
          target: "[data-tut='project-sales'] .hrpc-table, [data-tut='project-sales'] .hrpc-nft-empty",
        },
        {
          text: "Use it to check if a floor is real before you snipe a listing next door.",
          target: "[data-tut='project-sales']",
        },
      ],
    },
    "project-listings": {
      id: "project-listings",
      title: "Project Listings",
      beats: [
        {
          text: "Project Listings shows live asks for the collection you selected on the left.",
          target: "[data-tut='project-listings']",
        },
        {
          text: "On E.T.H. R.P.C., Snipe can buy a listing with a squad key in your session. Hood uses the same board to inspect asks.",
          target: "[data-tut='project-listings'] .hrpc-table, [data-tut='project-listings'] .hrpc-nft-empty",
        },
        {
          text: "Load wallets under Operator tools first. Without a squad key, there is nothing to sign with.",
          target: "#squad, [data-tut='project-listings']",
        },
      ],
    },
    "live-mint": {
      id: "live-mint",
      title: "Live Mint",
      beats: [
        {
          text: "Live Mint is a radar for mints that are actually live. Pick Trending, New Mints, or Market.",
          target: "#mint-now",
        },
        {
          text: "These columns are the feed. Click a project to load it into the mint box below.",
          target: "#mint-now .hrpc-mint-cols",
        },
        {
          text: "Choose a quantity first. The chips do not send a transaction by themselves.",
          target: "#mint-now .hrpc-mint-qty-row, #mint-now .hrpc-mint-box",
        },
        {
          text: "Hit Mint, confirm in MetaMask, and the N.F.T.s land in the connected wallet. Gas follows this chain, not some random mainnet quote.",
          target: "#mint-now .hrpc-mint-actions, #mint-now .hrpc-mint-box",
        },
      ],
    },
    "upcoming-nfts": {
      id: "upcoming-nfts",
      title: "Upcoming NFTs",
      beats: [
        {
          text: "Upcoming N.F.T.s is a calendar of drops we are tracking on this desk.",
          target: "#upcoming-nfts",
        },
        {
          text: "You get supply, price, mint time, and a countdown so you know when to arm.",
          target: "#upcoming-nfts .hrpc-table",
        },
        {
          text: "Snipe jumps you to Arm Sniper — N.F.T.s so you can load the collection and wait on the right stage.",
          target: "#upcoming-nfts .hrpc-btn, #arm-nft",
        },
      ],
    },
    "memecoin-launches": {
      id: "memecoin-launches",
      title: "Memecoin Launches",
      beats: [
        {
          text: "Memecoin launches is coming soon on this desk. The board is here so you can see how the snipe flow will work.",
          target: "#launches .hrpc-soon-wrap, #launches",
        },
        {
          text: "When it goes live, you will pick wallets, buy size, and slippage, then lock a ticker.",
          target: "#launches .hrpc-launch-presets",
        },
        {
          text: "Snipe will send you down to the memecoin arm panel. Until then, N.F.T. tools are the live product.",
          target: "#launches .hrpc-btn, #arm-meme",
        },
      ],
    },
    "arm-nft": {
      id: "arm-nft",
      title: "Arm Sniper — NFTs",
      beats: [
        {
          text: "This is the N.F.T. sniper. Load first. These buttons do not mint.",
          target: "#arm-nft",
        },
        {
          text: "Paste a contract and hit Load, or paste an OpenSea collection U.R.L. Same idea — pull the project.",
          target: "[data-tut='arm-load-ca']",
        },
        {
          text: "Then pick the real mint stage by name. Live fires now. Upcoming waits until that window opens. Ended is refused.",
          target: "[data-tut='arm-stage']",
        },
        {
          text:
            variant === "eth"
              ? "Set mints per wallet and a gas preset from live quotes. Manual gwei is optional on Ethereum."
              : "Set mints per wallet and a speed. Robinhood gas is auto — Normal, Fast, or Hyper. No custom gwei.",
          target: "#arm-nft .hrpc-qty, #arm-nft .hrpc-gas-controls",
        },
        {
          text: "Select squad wallets, then Save targets and arm mint. That is the only button that actually fires.",
          target: "#arm-nft .hrpc-row-actions",
        },
      ],
    },
    "arm-meme": {
      id: "arm-meme",
      title: "Arm Sniper — Memecoins",
      beats: [
        {
          text: "Memecoin arm is coming soon. When it ships, you enter a ticker here and wait for the deploy.",
          target: "#arm-meme",
        },
        {
          text: "Buy amount, wallets, and slippage will be the sniper settings.",
          target: "#arm-meme .hrpc-meme-form, #arm-meme",
        },
        {
          text: `Until then, use Arm Sniper for N.F.T.s. That path is live on ${d} today.`,
          target: "#arm-nft",
        },
      ],
    },
    squad: {
      id: "squad",
      title: "Squad & balances",
      beats: [
        {
          text: "Squad is your session wallet army. These keys stay in this browser tab. We do not store them.",
          target: "#squad",
        },
        {
          text: "Refresh balances to pull live E.T.H. and N.F.T. counts for every worker.",
          target: "#squad .hrpc-row-actions .hrpc-btn, #squad",
        },
        {
          text: "Click an address to copy it. Snipers and sweeps use this list, so load or generate wallets first.",
          target: "#squad .hrpc-table, #squad .hrpc-nft-empty",
        },
      ],
    },
    "load-wallets": {
      id: "load-wallets",
      title: "Load your wallets",
      beats: [
        {
          text: "Paste private keys or addresses here if you already have a squad on your machine.",
          target: "#load-wallets",
        },
        {
          text: "Load into bot puts them in session only. Clear wipes them from this tab.",
          target: "#load-wallets .hrpc-row-actions",
        },
        {
          text: "Never paste a key on a random site. This box is for operators who already chose this desk.",
          target: "#load-wallets textarea",
        },
      ],
    },
    "generate-wallets": {
      id: "generate-wallets",
      title: "Generate Wallets",
      beats: [
        {
          text: "Generate builds fresh wallets in your browser. Pick a count, then hit Generate.",
          target: "#generate-wallets",
        },
        {
          text: "Copy the keys immediately and save them on your P.C. If you refresh, they are gone from the site.",
          target: "#generate-wallets .hrpc-inline",
        },
        {
          text: "We do not keep private keys. After you copy, those wallets appear in Squad for snipes and splits.",
          target: "#generate-wallets, #squad",
        },
      ],
    },
    "master-split": {
      id: "master-split",
      title: "Master split",
      beats: [
        {
          text: "Master split funds your workers from one bank wallet, then can sweep stuff back.",
          target: "#master-split",
        },
        {
          text: "Paste the master private key, hit Save. Session only, same as squad keys.",
          target: "#master-split input[type='password']",
        },
        {
          text: "Hit a wallet count to split E.T.H. evenly across that many squad workers.",
          target: "#master-split .hrpc-split-grid",
        },
        {
          text: "The two rows at the bottom send N.F.T.s or leftover crypto back to the address you type — usually the master.",
          target: "#master-split .hrpc-input-lime-ph",
        },
      ],
    },
    "mint-outcomes": {
      id: "mint-outcomes",
      title: "Bot NFT outcomes",
      beats: [
        {
          text: "This log is the truth tape for N.F.T. snipes and mints from this session.",
          target: "#mint-outcomes",
        },
        {
          text: "Green-style ok lines are fills. Errors tell you why a mint or snipe failed, like missing keys or no route.",
          target: "#mint-outcomes .hrpc-outcomes",
        },
        {
          text: "If Top T.X. did not move, check here first. A failed transaction never gets counted.",
          target: "#mint-outcomes",
        },
      ],
    },
    "ticker-outcomes": {
      id: "ticker-outcomes",
      title: "Bot ticker snipes outcomes",
      beats: [
        {
          text: "Ticker outcomes will log memecoin snipes the same way N.F.T. outcomes log mints.",
          target: "#ticker-outcomes",
        },
        {
          text: "When memecoin arm is live, armed tickers, hits, and misses print here.",
          target: "#ticker-outcomes .hrpc-outcomes",
        },
        {
          text: "Until that ships, this panel stays idle. N.F.T. work shows up in Bot N.F.T. outcomes instead.",
          target: "#mint-outcomes",
        },
      ],
    },
  };

  return scripts[id];
}

export const TOOL_TUTORIAL_IDS: ToolTutorialId[] = [
  "top-tx",
  "nft-live",
  "project-sales",
  "project-listings",
  "live-mint",
  "upcoming-nfts",
  "memecoin-launches",
  "arm-nft",
  "arm-meme",
  "squad",
  "load-wallets",
  "generate-wallets",
  "master-split",
  "mint-outcomes",
  "ticker-outcomes",
];
