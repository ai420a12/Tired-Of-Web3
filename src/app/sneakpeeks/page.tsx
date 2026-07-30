"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import MatrixRain from "@/components/effects/MatrixRain";
import GlitchText from "@/components/effects/GlitchText";
import SocialLinks from "@/components/ui/SocialLinks";
import { playClick } from "@/lib/sounds";

const SNEAK_PEEKS = [
  { src: "/images/sneakpeeks/mars.png", alt: "Mars astronaut hoodie sneak peek" },
  { src: "/images/sneakpeeks/hope.png", alt: "Hope character sneak peek" },
  { src: "/images/sneakpeeks/love-community.png", alt: "Love community sneak peek" },
  { src: "/images/sneakpeeks/make-2026.png", alt: "Make 2026 gorilla cowboy sneak peek" },
  { src: "/images/sneakpeeks/maybe-lasers.png", alt: "Maybe laser eyes sneak peek" },
  { src: "/images/sneakpeeks/silence.png", alt: "Silence sneak peek" },
  { src: "/images/sneakpeeks/heart.png", alt: "Heart astronaut sneak peek" },
  { src: "/images/sneakpeeks/smiley.png", alt: "Orange smiley hoodie sneak peek" },
  { src: "/images/sneakpeeks/tired-crown.png", alt: "Tired crown laser eyes sneak peek" },
  { src: "/images/sneakpeeks/starmind-flag.png", alt: "Starmind Mars robot sneak peek" },
  { src: "/images/sneakpeeks/multiplanetary.png", alt: "Multiplanetary species sneak peek" },
  { src: "/images/sneakpeeks/support-communities.png", alt: "Support real communities sneak peek" },
] as const;

export default function SneakPeeksPage() {
  return (
    <div className="scanlines relative min-h-screen">
      <MatrixRain />

      <nav className="fixed top-0 right-0 left-0 z-50 border-b border-neon-purple/20 bg-background/80 backdrop-blur-md">
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
          <Link
            href="/"
            onClick={() => playClick()}
            className="font-mono text-xs text-foreground/50 hover:text-neon-pink"
          >
            ← Home
          </Link>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pt-24 pb-16">
        <div className="mb-10 text-center">
          <GlitchText
            as="h1"
            className="font-mono text-3xl font-bold text-[#2081E2] sm:text-5xl"
          >
            TIRED COLLECTION
          </GlitchText>
          <p className="mt-2 font-mono text-sm text-foreground/50">
            OpenSea sneak peeks — coming soon
          </p>
        </div>

        <div className="neon-border mb-10 rounded-2xl bg-deep-purple/40 p-5 backdrop-blur-sm sm:p-6">
          <p className="font-mono text-xs font-bold tracking-wide text-neon-pink uppercase sm:text-sm">
            Disclaimer
          </p>
          <p className="mt-2 font-mono text-sm leading-relaxed text-foreground/75 sm:text-base">
            This artwork is only an illustration of how the $TIRED NFTs may look
            while our artists finish the collection by hand — with full layers /
            PSD files and metadata. Final traits, rarity, and mint details will
            be confirmed closer to launch.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SNEAK_PEEKS.map((item, i) => (
            <motion.figure
              key={item.src}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="overflow-hidden rounded-xl border border-[#2081E2]/30 bg-[#0a0a12]"
            >
              <div className="relative aspect-square">
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  className="object-contain p-1"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
            </motion.figure>
          ))}
        </div>
      </main>
    </div>
  );
}
