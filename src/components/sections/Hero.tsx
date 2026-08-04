"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import GlitchText from "@/components/effects/GlitchText";
import BuyButton from "@/components/ui/BuyButton";
import DexChart from "@/components/ui/DexChart";
import GoalBar from "@/components/ui/GoalBar";
import Trailer from "@/components/ui/Trailer";
import { LINKS } from "@/lib/constants";

const ctaClass =
  "box-border inline-flex h-14 w-full min-w-0 items-center justify-center rounded-lg border px-2 font-mono text-sm font-bold whitespace-nowrap transition-all sm:text-base";

export default function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-4 pt-20 pb-12">
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/banner.jpg"
          alt="TIRED banner"
          fill
          className="object-cover opacity-20"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <GlitchText
            as="h1"
            className="font-mono text-6xl font-black tracking-tighter text-neon-green neon-green-glow sm:text-8xl md:text-9xl"
          >
            $TIRED
          </GlitchText>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 max-w-2xl text-lg text-foreground/80 sm:text-xl"
          >
            Finally, a project that&apos;s as tired of this shit as you are.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="w-full max-w-2xl"
        >
          <Trailer />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <BuyButton className={`${ctaClass} border-neon-green/50 bg-neon-green/10 text-neon-green hover:bg-neon-green/20`} />
          <motion.a
            href={LINKS.wl}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`${ctaClass} border-neon-pink/50 bg-neon-pink/10 text-neon-pink hover:bg-neon-pink/20`}
          >
            GET WL
          </motion.a>
          <motion.a
            href={LINKS.opensea}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`${ctaClass} border-[#2081E2]/50 bg-[#2081E2]/10 text-[#2081E2] hover:bg-[#2081E2]/20`}
          >
            OpenSea
          </motion.a>
          <motion.a
            href={LINKS.sneakpeeks}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`${ctaClass} border-neon-purple/50 bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20`}
          >
            Sneak Peek
          </motion.a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="grid w-full max-w-md grid-cols-2 gap-3"
        >
          <div className="flex flex-col items-center">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className={`${ctaClass} neon-border-red neon-red-glow cursor-not-allowed bg-neon-red/10 text-neon-red opacity-90`}
            >
              STAKING
            </button>
            <span className="mt-1 font-mono text-[10px] leading-none text-neon-red/80">
              ComingSoon
            </span>
          </div>
          <div className="flex flex-col items-center">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className={`${ctaClass} neon-border-matrix neon-matrix-glow cursor-not-allowed bg-matrix-green/10 text-matrix-green opacity-90`}
            >
              MarketPlace
            </button>
            <span className="mt-1 font-mono text-[10px] leading-none text-matrix-green/80">
              ComingSoon
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="flex w-full max-w-2xl flex-col gap-4"
        >
          <DexChart />
          <GoalBar />
        </motion.div>

        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="mt-4 text-foreground/30"
        >
          <span className="font-mono text-xs">scroll down if you have the energy ↓</span>
        </motion.div>
      </div>
    </section>
  );
}
