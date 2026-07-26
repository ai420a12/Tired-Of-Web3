"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { MANIFESTO_LINES } from "@/lib/rants";
import GlitchText from "@/components/effects/GlitchText";

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
      </div>
    </section>
  );
}
