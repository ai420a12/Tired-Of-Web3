import type { Metadata } from "next";
import HoodDashboard from "@/components/hood-rpc/HoodDashboard";

export const metadata: Metadata = {
  metadataBase: new URL("https://hoodrpc.xyz"),
  title: "ETH_RPC — Snipe Memecoins & NFTs on Ethereum",
  description:
    "The fastest RPC on Ethereum. Snipe memecoin launches and upcoming NFT collections.",
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
    title: "ETH_RPC — Snipe Memecoins & NFTs on Ethereum",
    description: "Built for speed. Built to snipe. Power your edge on Ethereum.",
    images: ["/images/hood-rpc/banner-ref.png"],
  },
};

export default function EthRpcPage() {
  return <HoodDashboard variant="eth" />;
}
