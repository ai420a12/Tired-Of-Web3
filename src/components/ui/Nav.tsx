"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { playClick, playSigh } from "@/lib/sounds";
import SocialLinks from "@/components/ui/SocialLinks";

const navItems = [
  { label: "Manifesto", href: "/#manifesto" },
  { label: "Tokenomics", href: "/#tokenomics" },
  { label: "AI Agent", href: "/#agent" },
  { label: "Roadmap", href: "/#roadmap" },
  { label: "Community", href: "/#community" },
];

interface NavProps {
  onVentClick: () => void;
}

export default function Nav({ onVentClick }: NavProps) {
  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="fixed top-0 right-0 left-0 z-50 border-b border-neon-purple/20 bg-background/80 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/"
            onClick={() => playClick()}
            className="font-mono text-lg font-bold text-neon-green neon-green-glow"
          >
            $TIRED
          </Link>
          <SocialLinks />
        </div>

        <div className="hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => playClick()}
              className="text-sm text-foreground/70 transition-colors hover:text-neon-pink"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/wl"
            onClick={() => playClick()}
            className="rounded-full border border-neon-green/50 bg-neon-green/10 px-3 py-1.5 font-mono text-xs font-bold text-neon-green transition-colors hover:bg-neon-green/20 sm:px-4"
          >
            GET WL
          </Link>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              playSigh();
              onVentClick();
            }}
            className="hidden rounded-full border border-neon-pink/50 bg-neon-pink/10 px-3 py-1.5 font-mono text-xs text-neon-pink transition-colors hover:bg-neon-pink/20 sm:inline-flex sm:px-4"
          >
            VENT 😤
          </motion.button>
        </div>
      </div>
    </motion.nav>
  );
}
