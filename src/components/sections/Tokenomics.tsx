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

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TOKENOMICS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5, boxShadow: "0 0 30px rgba(157,78,221,0.3)" }}
              className="neon-border group relative overflow-hidden rounded-2xl bg-deep-purple/40 p-6 backdrop-blur-sm"
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

              <motion.div
                initial={{ opacity: 0, height: 0 }}
                whileHover={{ opacity: 1, height: "auto" }}
                className="mt-4 overflow-hidden border-t border-neon-purple/20 pt-4"
              >
                <p className="font-mono text-xs text-neon-pink italic">
                  &ldquo;{item.reaction}&rdquo;
                </p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
