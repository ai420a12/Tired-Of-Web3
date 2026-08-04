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
  const pattern = /(\$TIRED|RobinHood|Robinhood)/g;
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    if (part === "$TIRED" || part === "RobinHood" || part === "Robinhood") {
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
            What Can $TIRED Do?
          </GlitchText>
          <p className="mt-2 font-mono text-sm text-foreground/50">
            real bags. real utility. still tired.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <UtilityCard index="01">
            <p>
              {highlightBrand(
                "$TIRED will fund buybacks and RobinHood Stock buys, stocks will be distributed between our holders depending on how many $TIRED tokens you hold. (This will be done manually & after we reach our factory goal)",
              )}
            </p>
          </UtilityCard>

          <UtilityCard index="02">
            <p>
              {highlightBrand(
                "By holding your $TIRED memecoin you will be able to mint The Tired NFT collection on September 11th — the more tokens you hold, the more NFTs you get and the bigger your WL allocation. (min 500k $TIRED to qualify)",
              )}
            </p>
          </UtilityCard>

          <UtilityCard index="03">
            <p>
              {highlightBrand(
                "You will be able to pay for merch with $TIRED once our collection goes live and we unlock our Marketplace and staking mechanism for The Tired NFT collection",
              )}
            </p>
          </UtilityCard>
        </div>

        <div className="mt-20 mb-12 text-center">
          <h3 className="font-mono text-2xl font-bold text-neon-pink neon-pink-glow sm:text-3xl">
            What can The Tired NFT collection do?
          </h3>
          <p className="mt-2 font-mono text-sm text-foreground/50">
            stake longer. stack more. get the goods.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <UtilityCard index="01">
            <p>
              {highlightBrand(
                "You will be able to stake the NFTs and get the TiredBoxes for free based on that exact NFT, and will only need to pay for shipping with the $TIRED memecoin. The longer you stake your NFTs, the more merch you get. Stack multiple TIRED NFTs to get multiple TiredBoxes. Real utility. Real ownership. Real merch.",
              )}
            </p>
          </UtilityCard>

          <UtilityCard index="02">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[260px] border-collapse border-2 border-neon-pink text-left text-[11px] leading-snug sm:text-xs">
                <thead>
                  <tr>
                    <th className="border-b-2 border-neon-pink px-2 py-3.5 font-mono font-bold text-neon-green">
                      Lock Duration
                    </th>
                    <th className="border-b-2 border-neon-pink px-2 py-3.5 font-mono font-bold text-neon-green">
                      Reward Tier
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stakeTiers.map((tier, i) => (
                    <tr key={tier.duration} className="align-middle">
                      <td
                        className={`px-2 py-4 font-mono font-bold text-neon-pink whitespace-nowrap ${
                          i < stakeTiers.length - 1
                            ? "border-b-2 border-neon-pink"
                            : ""
                        }`}
                      >
                        {tier.duration}
                      </td>
                      <td
                        className={`px-2 py-4 font-mono text-foreground/80 ${
                          i < stakeTiers.length - 1
                            ? "border-b-2 border-neon-pink"
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
                "Want merch or physicals based on other NFTs you own — or something totally custom? No problem. Order a TiredBox from us, send the content, pay with $TIRED, and we'll make it for you.",
              )}
            </p>
          </UtilityCard>
        </div>
      </div>
    </section>
  );
}
