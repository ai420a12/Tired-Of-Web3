"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

type MascotPose = "idle" | "facepalm" | "typing" | "complaining";

interface MascotProps {
  size?: "sm" | "md" | "lg" | "xl";
  pose?: MascotPose;
  quote?: string;
  showSpeech?: boolean;
  className?: string;
}

const sizes = {
  sm: 48,
  md: 80,
  lg: 120,
  xl: 200,
};

const poseAnimations = {
  idle: {
    y: [0, -4, 0],
    rotate: [0, 0, 0],
    scale: [1, 1.02, 1],
  },
  facepalm: {
    y: [0, 2, 0],
    rotate: [0, -5, 0],
    scale: [1, 0.95, 1],
  },
  typing: {
    y: [0, -2, 0, -1, 0],
    rotate: [0, 1, -1, 1, 0],
    scale: [1, 1, 1, 1, 1],
  },
  complaining: {
    y: [0, -6, 0],
    rotate: [0, 3, -3, 0],
    scale: [1, 1.05, 1],
  },
};

export default function Mascot({
  size = "md",
  pose = "idle",
  quote,
  showSpeech = false,
  className = "",
}: MascotProps) {
  const dim = sizes[size];

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <AnimatePresence mode="wait">
        {showSpeech && quote && (
          <motion.div
            key={quote}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="relative mb-3 max-w-xs rounded-lg border border-neon-purple/40 bg-deep-purple/80 px-4 py-2 text-center text-sm backdrop-blur-sm"
          >
            <p className="font-mono text-foreground/90">&ldquo;{quote}&rdquo;</p>
            <div className="absolute -bottom-2 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-neon-purple/40 bg-deep-purple/80" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={poseAnimations[pose]}
        transition={{
          duration: pose === "typing" ? 0.4 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative"
      >
        <div
          className="absolute inset-0 rounded-full blur-xl"
          style={{
            background:
              pose === "facepalm"
                ? "radial-gradient(circle, rgba(255,45,149,0.3) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(57,255,20,0.2) 0%, transparent 70%)",
          }}
        />
        <Image
          src="/images/mascot.gif"
          alt="TIRED mascot — exhausted silhouette leaning on fence"
          width={dim}
          height={dim}
          className="relative z-10 drop-shadow-[0_0_15px_rgba(57,255,20,0.4)]"
          style={{
            filter:
              pose === "facepalm"
                ? "brightness(1.2) contrast(1.1)"
                : pose === "complaining"
                  ? "hue-rotate(30deg)"
                  : "none",
          }}
          unoptimized
        />
      </motion.div>
    </div>
  );
}
