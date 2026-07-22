"use client";

import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { playSadTrombone, playClick } from "@/lib/sounds";

interface BuyButtonProps {
  className?: string;
  size?: "sm" | "lg";
}

export default function BuyButton({ className = "", size = "lg" }: BuyButtonProps) {
  const handleBuy = () => {
    playClick();

    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#39ff14", "#ff2d95", "#9d4edd", "#ffffff"],
    });

    setTimeout(() => playSadTrombone(), 300);
  };

  const sizeClasses =
    size === "lg"
      ? "px-10 py-4 text-xl"
      : "px-6 py-2 text-sm";

  return (
    <motion.button
      whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(57,255,20,0.5)" }}
      whileTap={{ scale: 0.95 }}
      onClick={handleBuy}
      className={`neon-border-green rounded-lg bg-neon-green/10 font-mono font-bold text-neon-green transition-all hover:bg-neon-green/20 ${sizeClasses} ${className}`}
    >
      BUY $TIRED
    </motion.button>
  );
}
