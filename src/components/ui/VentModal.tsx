"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { generateRant } from "@/lib/rants";
import { playTyping, playSigh, playClick } from "@/lib/sounds";
import Mascot from "@/components/mascot/Mascot";

interface VentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VentModal({ isOpen, onClose }: VentModalProps) {
  const [rant, setRant] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(() => {
    setIsGenerating(true);
    playTyping();
    window.setTimeout(() => {
      setRant(generateRant());
      setIsGenerating(false);
      playSigh();
    }, 600);
  }, []);

  const handleClose = useCallback(() => {
    setRant("");
    setIsGenerating(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, handleClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            onAnimationComplete={() => {
              if (!rant && !isGenerating) generate();
            }}
            onClick={(e) => e.stopPropagation()}
            className="neon-border relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-deep-purple/90 p-6 backdrop-blur-md"
          >
            <button
              onClick={() => {
                playClick();
                handleClose();
              }}
              className="absolute top-4 right-4 text-foreground/50 transition-colors hover:text-neon-pink"
              aria-label="Close vent modal"
            >
              ✕
            </button>

            <div className="mb-4 flex items-center gap-4">
              <Mascot size="sm" pose="complaining" />
              <div>
                <h3 className="font-mono text-lg font-bold text-neon-pink">
                  RANT GENERATOR™
                </h3>
                <p className="text-xs text-foreground/50">
                  Because therapy is expensive
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-neon-purple/30 bg-background/50 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
              {isGenerating ? (
                <span className="animate-pulse text-neon-green">
                  Generating rage...
                </span>
              ) : (
                rant
              )}
            </div>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={generate}
                className="flex-1 rounded-lg border border-neon-green/50 bg-neon-green/10 py-2 font-mono text-sm text-neon-green hover:bg-neon-green/20"
              >
                NEW RANT
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  navigator.clipboard.writeText(rant);
                  playClick();
                }}
                className="flex-1 rounded-lg border border-neon-purple/50 bg-neon-purple/10 py-2 font-mono text-sm text-neon-purple hover:bg-neon-purple/20"
              >
                COPY RANT
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
