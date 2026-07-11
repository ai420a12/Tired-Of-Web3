"use client";

import { motion } from "framer-motion";

interface GlitchTextProps {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "span" | "p";
}

export default function GlitchText({
  children,
  className = "",
  as: Tag = "span",
}: GlitchTextProps) {
  return (
    <motion.div
      className="relative inline-block"
      whileHover={{ scale: 1.02 }}
    >
      <Tag
        className={`glitch-text relative z-10 ${className}`}
        data-text={typeof children === "string" ? children : undefined}
      >
        {children}
      </Tag>
      <Tag
        className={`absolute inset-0 z-0 text-neon-green opacity-30 ${className}`}
        aria-hidden="true"
        style={{ clipPath: "inset(40% 0 30% 0)", transform: "translateX(-2px)" }}
      >
        {children}
      </Tag>
      <Tag
        className={`absolute inset-0 z-0 text-neon-pink opacity-30 ${className}`}
        aria-hidden="true"
        style={{ clipPath: "inset(60% 0 10% 0)", transform: "translateX(2px)" }}
      >
        {children}
      </Tag>
    </motion.div>
  );
}
