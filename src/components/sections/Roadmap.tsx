"use client";

import { motion } from "framer-motion";
import { ROADMAP } from "@/lib/constants";
import GlitchText from "@/components/effects/GlitchText";

const phaseDotColors = [
  "border-neon-green",
  "border-neon-purple",
  "border-neon-pink",
] as const;

function formatRoadmapItem(item: string) {
  const parts = item.split("Ethereum");
  if (parts.length === 1) return item;

  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <span key={i} className="text-neon-green">
            Ethereum
          </span>,
          part,
        ],
  );
}

export default function Roadmap() {
  return (
    <section id="roadmap" className="relative px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <GlitchText
            as="h2"
            className="font-mono text-4xl font-bold text-neon-pink neon-pink-glow sm:text-5xl"
          >
            ROADMAP
          </GlitchText>
          <p className="mt-2 font-mono text-sm text-foreground/50">
            (we&apos;ll probably miss every deadline)
          </p>
        </div>

        <div className="relative pl-10 sm:pl-12">
          {/* Continuous spine through all phases + end cap */}
          <div
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-[0.875rem] w-px -translate-x-1/2 bg-gradient-to-b from-neon-green via-neon-purple to-neon-pink sm:left-[1.125rem]"
          />

          <div className="space-y-12">
            {ROADMAP.map((phase, i) => (
              <motion.div
                key={phase.phase}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="relative"
              >
                <div
                  aria-hidden="true"
                  className={`absolute top-6 left-[-2.125rem] h-4 w-4 rounded-full border-2 bg-background sm:left-[-2.5rem] sm:h-5 sm:w-5 ${
                    phaseDotColors[i] ?? "border-neon-pink"
                  }`}
                />

                <div className="neon-border rounded-2xl bg-deep-purple/30 p-6 backdrop-blur-sm">
                  <div className="mb-4">
                    <span className="font-mono text-xs text-neon-green">
                      {phase.phase}
                    </span>
                    <h3 className="font-mono text-2xl font-bold text-foreground">
                      {phase.title}
                    </h3>
                  </div>

                  <ul className="space-y-2">
                    {phase.items.map((item, j) => {
                      const completed = item.done;

                      return (
                        <motion.li
                          key={j}
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.2 + j * 0.1 }}
                          className="flex items-start gap-2 font-mono text-sm text-foreground/70"
                        >
                          <span
                            className={
                              completed ? "text-neon-green" : "text-neon-pink"
                            }
                            aria-hidden="true"
                          >
                            {completed ? "✓" : "✗"}
                          </span>
                          <span className="min-w-0 flex-1">
                            {formatRoadmapItem(item.text)}
                          </span>
                        </motion.li>
                      );
                    })}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>

          <div
            aria-hidden="true"
            className="absolute -bottom-1 left-[0.375rem] h-4 w-4 rounded-full border-2 border-neon-pink bg-background sm:left-[0.5rem] sm:h-5 sm:w-5"
          />
        </div>
      </div>
    </section>
  );
}
