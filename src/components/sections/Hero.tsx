"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import GlitchText from "@/components/effects/GlitchText";
import MascotSpeech from "@/components/mascot/MascotSpeech";
import BuyButton from "@/components/ui/BuyButton";
import DexChart from "@/components/ui/DexChart";

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
            Finally, a coin that&apos;s as tired of this shit as you are.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <MascotSpeech />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <BuyButton />
          <motion.a
            href="/wl"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-lg border border-neon-pink/50 bg-neon-pink/10 px-8 py-4 font-mono text-xl font-bold text-neon-pink transition-all hover:bg-neon-pink/20"
          >
            GET WL
          </motion.a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="w-full max-w-2xl"
        >
          <DexChart />
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
