"use client";

import { motion } from "framer-motion";
import { LINKS } from "@/lib/constants";
import GlitchText from "@/components/effects/GlitchText";
import {
  IconInstagram,
  IconLinkedIn,
  IconX,
} from "@/components/ui/SocialIcons";

const socials = [
  {
    label: "X",
    href: LINKS.jorgeX,
    Icon: IconX,
  },
  {
    label: "Instagram",
    href: LINKS.jorgeInstagram,
    Icon: IconInstagram,
  },
  {
    label: "LinkedIn",
    href: LINKS.jorgeLinkedIn,
    Icon: IconLinkedIn,
  },
] as const;

export default function AboutMe() {
  return (
    <section id="about" className="relative px-4 py-24">
      <div className="mx-auto max-w-4xl">
        <div className="mb-16 text-center">
          <GlitchText
            as="h2"
            className="font-mono text-4xl font-bold text-neon-green neon-green-glow sm:text-5xl"
          >
            ABOUT ME
          </GlitchText>
        </div>

        <motion.article
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="neon-border rounded-2xl bg-deep-purple/30 p-6 backdrop-blur-sm sm:p-10"
        >
          <h3 className="font-mono text-xl font-bold text-neon-pink sm:text-2xl">
            Hi, I&apos;m Jorge{" "}
            <a
              href={LINKS.jorgeX}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-green transition-colors hover:text-neon-pink"
            >
              (@Ai420a12)
            </a>
          </h3>

          <div className="mt-5 space-y-4 font-mono text-sm leading-relaxed text-foreground/75 sm:text-base">
            <p>
              I&apos;ve been in Web3 since 2017. I started on BNB memecoins as
              COO of AngelsClan, then moved into NFTs in 2020 when Mike
              (Beeple) started posting about OpenSea. Since then I&apos;ve been
              CMO and COO across dozens of projects — responsible for hundreds
              of millions in volume across OpenSea and memecoins.
            </p>
            <p>
              One of the biggest projects I led was{" "}
              <span className="text-neon-pink">DMAGA</span>, where I got Elon
              Musk to change his PFP to a red-themed character with blue laser
              eyes. That sparked a massive Web3 trend — hundreds of thousands
              followed the same path, and the project went{" "}
              <span className="font-bold text-neon-green">800x</span> almost
              overnight… only to be exploited by its own core team.
            </p>
            <p>
              Most recently I was hired as CMO of The Penimals — and once again
              exploited by its own core team. I&apos;m tired of making other
              people money with my knowledge and labour. I&apos;m tired of being
              left behind with the communities those bad actors wreck.
            </p>
            <p>
              It&apos;s time to build something I can fully control — something
              that actually brings value to people. I believe this cycle will be
              about physical collectibles. Our bubble is still small; there
              isn&apos;t a real mainstream audience for AI-agent tokens and
              similar noise. We need to focus on what people already love —
              their NFTs — and give them the chance to own IRL pieces of those
              same assets. That&apos;s how Web2 sees how strong this culture is,
              and how we push toward mass adoption.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-stretch justify-center gap-4 sm:gap-6">
            {socials.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="neon-border group flex w-[120px] flex-col items-center gap-2 rounded-xl bg-background/40 px-4 py-4 transition-colors hover:border-neon-pink/50 hover:bg-neon-pink/10 sm:w-[140px]"
              >
                <Icon className="h-8 w-8 text-neon-green transition-colors group-hover:text-neon-pink" />
                <span className="font-mono text-xs font-bold text-foreground/70 group-hover:text-neon-pink">
                  {label}
                </span>
              </a>
            ))}
          </div>
        </motion.article>
      </div>
    </section>
  );
}
