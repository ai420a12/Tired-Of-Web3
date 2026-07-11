"use client";

import { motion } from "framer-motion";
import { playClick, playSigh } from "@/lib/sounds";

const navItems = [
  { label: "Manifesto", href: "#manifesto" },
  { label: "Tokenomics", href: "#tokenomics" },
  { label: "AI Agent", href: "#agent" },
  { label: "Roadmap", href: "#roadmap" },
  { label: "Community", href: "#community" },
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
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <a
          href="#"
          onClick={() => playClick()}
          className="font-mono text-lg font-bold text-neon-green neon-green-glow"
        >
          $TIRED
        </a>

        <div className="hidden items-center gap-6 md:flex">
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

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            playSigh();
            onVentClick();
          }}
          className="rounded-full border border-neon-pink/50 bg-neon-pink/10 px-4 py-1.5 font-mono text-xs text-neon-pink transition-colors hover:bg-neon-pink/20"
        >
          VENT 😤
        </motion.button>
      </div>
    </motion.nav>
  );
}
