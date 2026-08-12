import { ETH_COLLECTIONS, HOOD_COLLECTIONS } from "@/components/hood-rpc/mock-data";
import {
  HOOD_NFT_DROP_AT,
  HOOD_PLATFORM_LIVE_AT,
  HOOD_RPC_LINKS,
} from "@/components/hood-rpc/hood-wl";

export type HoodRpcVariant = "hood" | "eth";

export type HoodRpcChainConfig = {
  variant: HoodRpcVariant;
  brand: string;
  homePath: string;
  wlPath: string;
  apiBase: string;
  chainLabel: string;
  geckoNetwork: string;
  openseaChain: string;
  openseaAssetsChain: string;
  defaultTokenLogo: string;
  mascotLogo: string;
  wordmarkClass: string;
  rootClass: string;
  storagePrefix: string;
  openseaCollectionUrl: string;
  videoLabel: string;
  heroChainBadge: string;
  curatedSource: string;
};

export const HOOD_CHAIN_CONFIG: HoodRpcChainConfig = {
  variant: "hood",
  brand: "HOOD_RPC",
  homePath: "/hood-rpc",
  wlPath: HOOD_RPC_LINKS.wl,
  apiBase: "/api/hood-rpc",
  chainLabel: "Robinhood",
  geckoNetwork: "robinhood",
  openseaChain: "robinhood",
  openseaAssetsChain: "robinhood",
  defaultTokenLogo: "/images/hood-rpc/tokens/rh.png",
  mascotLogo: "/images/hood-rpc/mascot-lime.png",
  wordmarkClass: "hrpc-wordmark",
  rootClass: "hrpc",
  storagePrefix: "hrpc",
  openseaCollectionUrl: HOOD_RPC_LINKS.opensea,
  videoLabel: "How HOOD_RPC works",
  heroChainBadge: "ROBINHOOD CHAIN",
  curatedSource: "curated-robinhood",
};

export const ETH_CHAIN_CONFIG: HoodRpcChainConfig = {
  variant: "eth",
  brand: "ETH_RPC",
  homePath: "/hood-rpc/eth",
  wlPath: "/hood-rpc/wl",
  apiBase: "/api/hood-rpc/eth",
  chainLabel: "Ethereum",
  geckoNetwork: "eth",
  openseaChain: "ethereum",
  openseaAssetsChain: "ethereum",
  defaultTokenLogo: "/images/hood-rpc/tokens/eth.png",
  mascotLogo: "/images/hood-rpc/tokens/eth.png",
  wordmarkClass: "hrpc-wordmark hrpc-wordmark-eth",
  rootClass: "hrpc hrpc-eth",
  storagePrefix: "ethrpc",
  openseaCollectionUrl: "https://opensea.io/collection/tired-of-web3/overview",
  videoLabel: "How ETH_RPC works",
  heroChainBadge: "ETHEREUM",
  curatedSource: "curated-ethereum",
};

export function getHoodRpcConfig(variant: HoodRpcVariant): HoodRpcChainConfig {
  return variant === "eth" ? ETH_CHAIN_CONFIG : HOOD_CHAIN_CONFIG;
}

export function getCollections(variant: HoodRpcVariant) {
  return variant === "eth" ? ETH_COLLECTIONS : HOOD_COLLECTIONS;
}

export type CuratedUpcomingDrop = {
  id: string;
  name: string;
  mintAt: string;
  supply: string;
  price: string;
  logo: string;
  collectionSlug: string;
  openseaUrl: string;
};

export function getCuratedUpcoming(variant: HoodRpcVariant): CuratedUpcomingDrop[] {
  if (variant === "eth") {
    return [
      {
        id: "tired-of-web3",
        name: "Tired Of Web3",
        mintAt: HOOD_NFT_DROP_AT.toISOString(),
        supply: "10K",
        price: "TBA",
        logo: "/images/hood-rpc/tokens/eth.png",
        collectionSlug: "tired-of-web3",
        openseaUrl: "https://opensea.io/collection/tired-of-web3/overview",
      },
      {
        id: "eth-platform",
        name: "ETH_RPC Platform Live",
        mintAt: HOOD_PLATFORM_LIVE_AT.toISOString(),
        supply: "—",
        price: "—",
        logo: "/images/hood-rpc/tokens/eth.png",
        collectionSlug: "eth-rpc-live",
        openseaUrl: ETH_CHAIN_CONFIG.homePath,
      },
    ];
  }

  return [
    {
      id: "hood-rpc",
      name: "HOOD_RPC Genesis",
      mintAt: HOOD_NFT_DROP_AT.toISOString(),
      supply: "3333",
      price: "TBA",
      logo: "/images/hood-rpc/mascot-lime.png",
      collectionSlug: "hood-rpc",
      openseaUrl: HOOD_RPC_LINKS.opensea,
    },
    {
      id: "hood-platform",
      name: "HOOD_RPC Platform Live",
      mintAt: HOOD_PLATFORM_LIVE_AT.toISOString(),
      supply: "—",
      price: "—",
      logo: "/images/hood-rpc/mascot-lime.png",
      collectionSlug: "hood-rpc-live",
      openseaUrl: HOOD_RPC_LINKS.home,
    },
  ];
}

export function resolveApiVariant(req: Request): HoodRpcVariant {
  const url = new URL(req.url);
  if (url.pathname.includes("/api/hood-rpc/eth")) return "eth";
  const chain = url.searchParams.get("chain");
  if (chain === "eth" || chain === "ethereum") return "eth";
  return "hood";
}
