"use client";

import { motion } from "framer-motion";
import { type ComponentType } from "react";
import { LINKS, TESTIMONIALS } from "@/lib/constants";
import { playClick } from "@/lib/sounds";
import GlitchText from "@/components/effects/GlitchText";
import {
  IconDiscord,
  IconOpenSea,
  IconTelegram,
  IconX,
} from "@/components/ui/SocialIcons";

type SocialCard = {
  label: string;
  href: string | null;
  live: boolean;
  Icon: ComponentType<{ className?: string }>;
  iconClass: string;
};

export default function Community() {
  const links: SocialCard[] = [
    {
      label: "X / Twitter",
      href: LINKS.x,
      live: true,
      Icon: IconX,
      iconClass: "text-foreground",
    },
    {
      label: "Telegram",
      href: LINKS.telegram,
      live: Boolean(LINKS.telegram),
      Icon: IconTelegram,
      iconClass: "text-[#2AABEE]",
    },
    {
      label: "OpenSea",
      href: LINKS.opensea,
      live: Boolean(LINKS.opensea),
      Icon: IconOpenSea,
      iconClass: "text-[#2081E2]",
    },
    {
      label: "Discord",
      href: LINKS.discord,
      live: Boolean(LINKS.discord),
      Icon: IconDiscord,
      iconClass: "text-[#5865F2]",
    },
  ];

  return (
    <section id="community" className="relative px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <GlitchText
            as="h2"
            className="font-mono text-4xl font-bold text-neon-green neon-green-glow sm:text-5xl"
          >
            JOIN THE TIRED ARMY
          </GlitchText>
        </div>

        <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {links.map((link, i) =>
            link.live && link.href ? (
              <motion.a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.05, y: -3 }}
                onClick={() => playClick()}
                className="neon-border flex flex-col items-center gap-3 rounded-xl bg-deep-purple/30 p-6 text-center transition-colors hover:bg-deep-purple/50"
              >
                <link.Icon className={`h-8 w-8 ${link.iconClass}`} />
                <span className="font-mono text-sm text-foreground/80">
                  {link.label}
                </span>
              </motion.a>
            ) : (
              <motion.div
                key={link.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="neon-border flex flex-col items-center gap-3 rounded-xl bg-deep-purple/20 p-6 text-center opacity-70"
              >
                <link.Icon className={`h-8 w-8 ${link.iconClass}`} />
                <span className="font-mono text-sm text-foreground/50">
                  {link.label}
                </span>
                <span className="font-mono text-[10px] text-neon-purple">
                  coming soon
                </span>
              </motion.div>
            ),
          )}
        </div>

        <div className="mb-12 grid gap-4 sm:grid-cols-2">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="neon-border rounded-xl bg-deep-purple/20 p-5"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-neon-purple">
                  {t.name}
                </span>
                <span className="text-neon-green text-xs">
                  {"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}
                </span>
              </div>
              <p className="font-mono text-sm text-foreground/70 italic">
                &ldquo;{t.quote}&rdquo;
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
