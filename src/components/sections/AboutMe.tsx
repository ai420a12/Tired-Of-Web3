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

          <div className="mt-8 space-y-4 border-t border-neon-purple/25 pt-8 font-mono text-sm leading-relaxed text-foreground/75 sm:text-base">
            <p>
              Words can&apos;t show how genuine I am about this — but{" "}
              <span className="text-neon-pink">time will prove it</span>. I
              promise that{" "}
              <span className="font-bold text-neon-green">
                100% of any LP made by this project
              </span>{" "}
              will be invested into making this factory possible. You will never
              see me buying stupid cars, watches, or holidays with this
              liquidity. I&apos;m truly grateful to everyone who has supported
              me to this day, and to anyone who helps make this real. I promise
              you will never be exploited by me — and you will never catch me in
              a lie. I don&apos;t do lies. I see lying as a mental issue.
            </p>
            <p>
              I&apos;m tired of reaching out to VCs and investors, begging for a
              chance to make this possible. I&apos;m tired of watching those same
              people blow LP into things that make no sense — or into projects
              owned by bad actors. Nevertheless, I&apos;m not wasting any more
              time. I will do this with or without them. I will never pay for
              KOLs. I will never pay for manipulation or fake status. Everything
              you see from me is{" "}
              <span className="text-neon-green">
                100% organic, on-chain, and with good intentions
              </span>
              .
            </p>
            <p className="font-bold text-neon-pink">
              Thank you a million times if you&apos;re supporting us and made it
              this far. If you&apos;re tired too — welcome home.
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
