"use client";

import { motion } from "framer-motion";
import { ROADMAP } from "@/lib/constants";
import GlitchText from "@/components/effects/GlitchText";
import Mascot from "@/components/mascot/Mascot";

const moodPoses = {
  exhausted: "idle" as const,
  cynical: "facepalm" as const,
  delusional: "complaining" as const,
};

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

        <div className="relative">
          <div className="absolute top-0 bottom-0 left-8 hidden w-px bg-gradient-to-b from-neon-green via-neon-purple to-neon-pink sm:block" />

          <div className="space-y-12">
            {ROADMAP.map((phase, i) => (
              <motion.div
                key={phase.phase}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="relative flex flex-col gap-6 sm:flex-row sm:items-start"
              >
                <div className="absolute left-6 hidden h-5 w-5 rounded-full border-2 border-neon-green bg-background sm:block" />

                <div className="sm:ml-16 sm:flex-1">
                  <div className="neon-border rounded-2xl bg-deep-purple/30 p-6 backdrop-blur-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-xs text-neon-green">
                          {phase.phase}
                        </span>
                        <h3 className="font-mono text-2xl font-bold text-foreground">
                          {phase.title}
                        </h3>
                      </div>
                      <Mascot
                        size="md"
                        pose={moodPoses[phase.mood]}
                      />
                    </div>

                    <ul className="space-y-2">
                      {phase.items.map((item, j) => (
                        <motion.li
                          key={j}
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.2 + j * 0.1 }}
                          className="flex items-start gap-2 font-mono text-sm text-foreground/70"
                        >
                          <span className="text-neon-pink">✗</span>
                          {item}
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
