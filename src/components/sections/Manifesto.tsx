"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { MANIFESTO_LINES } from "@/lib/rants";
import GlitchText from "@/components/effects/GlitchText";

const memeRotations = [-2, 1.5, -1, 2];

const memeReactions = [
  { text: "me watching another '100x gem' thread", emoji: "💀" },
  { text: "my portfolio after 'diamond hands'", emoji: "📉" },
  { text: "influencer posting 'still bullish'", emoji: "🤡" },
  { text: "dev wallet after 'community vote'", emoji: "🏃‍♂️💨" },
];

export default function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const x = useTransform(scrollYProgress, [0, 1], [-100, 100]);

  return (
    <section id="manifesto" ref={ref} className="relative px-4 py-24">
      <div className="mx-auto max-w-4xl">
        <motion.div style={{ x }} className="mb-12 text-center">
          <GlitchText
            as="h2"
            className="font-mono text-4xl font-bold text-neon-pink neon-pink-glow sm:text-5xl"
          >
            THE MANIFESTO
          </GlitchText>
          <p className="mt-2 font-mono text-sm text-foreground/50">
            trigger warning: truth
          </p>
        </motion.div>

        <div className="neon-border space-y-1 rounded-2xl bg-deep-purple/30 p-8 backdrop-blur-sm sm:p-12">
            {MANIFESTO_LINES.map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.03 }}
                className={`font-mono leading-relaxed ${
                  line === ""
                    ? "h-4"
                    : line.startsWith("$") || line.startsWith("Stay")
                      ? "text-lg font-bold text-neon-green"
                      : line.includes("tired") || line.includes("Tired")
                        ? "text-neon-pink"
                        : "text-foreground/80"
                }`}
              >
                {line}
              </motion.p>
            ))}
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {memeReactions.map((meme, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.05, rotate: memeRotations[i] }}
              className="neon-border rounded-xl bg-background/50 p-4 text-center"
            >
              <span className="text-3xl">{meme.emoji}</span>
              <p className="mt-2 font-mono text-xs text-foreground/60">
                {meme.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
