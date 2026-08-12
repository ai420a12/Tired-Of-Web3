import type { Metadata } from "next";
import HoodDashboard from "@/components/hood-rpc/HoodDashboard";

export const metadata: Metadata = {
  metadataBase: new URL("https://hoodrpc.xyz"),
  title: "Tired Of Web3 — Snipe Memecoins & NFTs on Ethereum",
  description:
    "Tired Of Web3 — the fastest sniper on Ethereum. Memecoin launches and NFT collections.",
  icons: {
    icon: [
      { url: "/images/hood-rpc/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/images/hood-rpc/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/images/hood-rpc/icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/images/hood-rpc/icon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/images/hood-rpc/icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Tired Of Web3 — Snipe Memecoins & NFTs on Ethereum",
    description: "Built for speed. Built to snipe. Power your edge on Ethereum.",
    images: ["/images/hood-rpc/tired-of-web3-blue.png"],
  },
};

export default function EthRpcPage() {
  return <HoodDashboard variant="eth" />;
}
