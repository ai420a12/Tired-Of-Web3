"use client";

import { motion } from "framer-motion";
import { TOKENOMICS } from "@/lib/constants";
import GlitchText from "@/components/effects/GlitchText";

export default function Tokenomics() {
  return (
    <section id="tokenomics" className="relative px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <GlitchText
            as="h2"
            className="font-mono text-4xl font-bold text-neon-green neon-green-glow sm:text-5xl"
          >
            TOKENOMICS
          </GlitchText>
          <p className="mt-2 font-mono text-sm text-foreground/50">
            numbers that won&apos;t save you, but at least they&apos;re honest
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          {TOKENOMICS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5, boxShadow: "0 0 30px rgba(157,78,221,0.3)" }}
              className="neon-border group relative w-full overflow-hidden rounded-2xl bg-deep-purple/40 p-6 backdrop-blur-sm sm:w-[calc(50%-0.75rem)] lg:w-[calc((100%-3rem)/3)]"
            >
              <div className="mb-4">
                <span className="text-2xl">{item.emoji}</span>
              </div>

              <h3 className="font-mono text-sm text-neon-purple">
                {item.title}
              </h3>
              <p className="mt-1 font-mono text-3xl font-bold text-neon-green">
                {item.value}
              </p>
              <p className="mt-1 text-xs text-foreground/50">{item.unit}</p>

              <div className="mt-4 max-h-0 overflow-hidden border-t border-transparent opacity-0 transition-all duration-300 ease-out group-hover:max-h-24 group-hover:border-neon-purple/20 group-hover:pt-4 group-hover:opacity-100">
                <p className="font-mono text-xs text-neon-pink italic">
                  &ldquo;{item.reaction}&rdquo;
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
