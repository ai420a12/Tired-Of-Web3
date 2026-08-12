import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import HoodWhitelistForm from "@/components/hood-rpc/HoodWhitelistForm";
import { HOOD_RPC_LINKS } from "@/components/hood-rpc/hood-wl";
import "@/components/hood-rpc/hood-rpc.css";

export const metadata: Metadata = {
  title: "HOOD_RPC — Get WL",
  description: "Apply for the HOOD_RPC whitelist. Follow, quote, tag, and drop your ETH wallet.",
  icons: {
    icon: [
      { url: "/images/hood-rpc/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/images/hood-rpc/icon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/images/hood-rpc/icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function HoodRpcWlPage() {
  return (
    <div className="hrpc hrpc-wl-page">
      <nav className="hrpc-nav">
        <Link className="hrpc-brand" href={HOOD_RPC_LINKS.home}>
          <Image
            src="/images/hood-rpc/mascot-lime.png"
            alt="HOOD_RPC"
            width={40}
            height={40}
            className="hrpc-nav-logo"
            priority
          />
          <span className="hrpc-wordmark">HOOD_RPC</span>
        </Link>
        <div className="hrpc-nav-right">
          <div className="hrpc-nav-account">
            <a
              className="hrpc-x-link"
              href={HOOD_RPC_LINKS.x}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TiredOfWeb3 on X"
              title="@TiredOfWeb3"
            >
              <svg viewBox="0 0 24 24" aria-hidden width="14" height="14">
                <path
                  fill="currentColor"
                  d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.743l7.727-8.889L1.25 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"
                />
              </svg>
            </a>
            <Link className="hrpc-nav-link" href={HOOD_RPC_LINKS.home}>
              ← Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="hrpc-wl-main">
        <HoodWhitelistForm />
      </main>
    </div>
  );
}
