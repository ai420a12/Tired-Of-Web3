import type { Metadata } from "next";
import HoodDashboard from "@/components/hood-rpc/HoodDashboard";
import { SNIPER_SITE } from "@/lib/site-domains";

export const metadata: Metadata = {
  metadataBase: new URL(SNIPER_SITE),
  title: "Tired Of Web3 — Snipe Memecoins & NFTs",
  description:
    "Tired Of Web3 — the fastest RPC on Robinhood Chain. Snipe memecoin launches and upcoming NFT collections.",
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
    title: "Tired Of Web3 — Snipe Memecoins & NFTs",
    description: "Built for speed. Built to snipe. Power your edge.",
    images: ["/images/hood-rpc/banner-ref.png"],
  },
};

export default function HoodRpcPage() {
  return <HoodDashboard />;
}
