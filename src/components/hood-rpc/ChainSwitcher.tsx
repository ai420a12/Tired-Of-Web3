"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ETH_CHAIN_CONFIG, HOOD_CHAIN_CONFIG } from "@/lib/hood-rpc-chain";

export default function ChainSwitcher() {
  const pathname = usePathname();
  const onEth = pathname?.startsWith("/hood-rpc/eth");

  return (
    <div className="hrpc-chain-switcher" aria-label="Chain switcher">
      <div
        className={`hrpc-chain-option hrpc-chain-option-hood ${
          onEth ? "hrpc-chain-off" : "hrpc-chain-on"
        }`}
      >
        <Link href="/hood-rpc" aria-current={!onEth ? "page" : undefined}>
          {HOOD_CHAIN_CONFIG.switcherLabel}
        </Link>
      </div>

      <div
        className={`hrpc-chain-option hrpc-chain-option-eth ${
          onEth ? "hrpc-chain-on" : "hrpc-chain-off"
        }`}
      >
        <Link href="/hood-rpc/eth" aria-current={onEth ? "page" : undefined}>
          {ETH_CHAIN_CONFIG.switcherLabel}
        </Link>
      </div>

      <div className="hrpc-chain-switcher-label">Switch</div>
    </div>
  );
}

