"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import GlitchText from "@/components/effects/GlitchText";

const stakeTiers = [
  {
    duration: "2 weeks (Tier 1)",
    reward:
      "Free Tired T-Shirt of your exact NFT + The Tired souvenirs",
  },
  {
    duration: "1 month (Tier 2)",
    reward:
      "Tier 1 + Cap + Physical Print Signed by the Artists of that exact Stacked NFT",
  },
  {
    duration: "3 months (Tier 3)",
    reward: "Tier 2 + Hoodie + 3D print of Stacked NFT",
  },
  {
    duration: "6 months",
    reward:
      "Full Bundle: Tier 3 + Bottoms + scarf + surprise goodies",
  },
] as const;

function highlightBrand(text: string): ReactNode[] {
  const pattern = /(TiredBoxes|TiredBox|RobinHood|Robinhood)/g;
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    if (
      part === "TiredBoxes" ||
      part === "TiredBox" ||
      part === "RobinHood" ||
      part === "Robinhood"
    ) {
      return (
        <span key={i} className="font-bold text-neon-green">
          {part}
        </span>
      );
    }
    return part;
  });
}

function UtilityCard({
  index,
  children,
}: {
  index: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45 }}
      className="neon-border flex h-full flex-col rounded-2xl bg-deep-purple/40 p-6 backdrop-blur-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-mono text-xs tracking-widest text-neon-purple">
          {index}
        </span>
      </div>
      <div className="font-mono text-sm leading-relaxed text-foreground/85">
        {children}
      </div>
    </motion.div>
  );
}

export default function WhatCanTiredDo() {
  return (
    <section id="utility" className="relative px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <GlitchText
            as="h2"
            className="font-mono text-4xl font-bold text-neon-green neon-green-glow sm:text-5xl"
          >
            What Can Tired Do?
          </GlitchText>
          <p className="mt-2 font-mono text-sm text-foreground/50">
            real NFTs. real merch. still tired.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <UtilityCard index="01">
            <p>
              {highlightBrand(
                "Stake Tired NFTs and get TiredBoxes for free based on that exact NFT — you only pay shipping. The longer you stake, the more merch you get. Stack multiple Tired NFTs to get multiple TiredBoxes. Real utility. Real ownership. Real merch.",
              )}
            </p>
          </UtilityCard>

          <UtilityCard index="02">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[260px] border-collapse border border-neon-pink/45 text-left font-mono text-[11px] leading-relaxed sm:text-xs">
                <thead>
                  <tr>
                    <th className="border-r border-b border-neon-pink/45 px-3 py-2 font-semibold tracking-wide text-neon-green">
                      Lock Duration
                    </th>
                    <th className="border-b border-neon-pink/45 px-3 py-2 font-semibold tracking-wide text-neon-green">
                      Reward Tier
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stakeTiers.map((tier, i) => (
                    <tr key={tier.duration} className="align-middle">
                      <td
                        className={`border-r border-neon-pink/45 px-3 py-2.5 font-semibold text-neon-pink whitespace-nowrap ${
                          i < stakeTiers.length - 1
                            ? "border-b border-neon-pink/45"
                            : ""
                        }`}
                      >
                        {tier.duration}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-foreground/75 ${
                          i < stakeTiers.length - 1
                            ? "border-b border-neon-pink/45"
                            : ""
                        }`}
                      >
                        {tier.reward}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-foreground/70">
              The longer you stake your NFTs the more merch you get. Stack
              multiple Tired NFTs to get multiple{" "}
              <span className="font-bold text-neon-green">TiredBoxes</span>. Real
              utility. Real ownership. Real merch.
            </p>
          </UtilityCard>

          <UtilityCard index="03">
            <p>
              {highlightBrand(
                "Want merch or physicals based on other NFTs you own — or something totally custom? No problem. Order a TiredBox from us, send the content, pay in FIAT or ETH, and we'll make it for you.",
              )}
            </p>
          </UtilityCard>
        </div>
      </div>
    </section>
  );
}
