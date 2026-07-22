"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import MatrixRain from "@/components/effects/MatrixRain";
import VentModal from "@/components/ui/VentModal";
import SocialLinks from "@/components/ui/SocialLinks";
import WhitelistForm from "@/components/wl/WhitelistForm";
import { playClick, playSigh } from "@/lib/sounds";

export default function WhitelistPage() {
  const [ventOpen, setVentOpen] = useState(false);

  const openVent = useCallback(() => {
    playSigh();
    setVentOpen(true);
  }, []);

  return (
    <div className="scanlines relative min-h-screen">
      <MatrixRain />
      <VentModal isOpen={ventOpen} onClose={() => setVentOpen(false)} />

      <nav className="fixed top-0 right-0 left-0 z-50 border-b border-neon-purple/20 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/"
              onClick={() => playClick()}
              className="font-mono text-lg font-bold text-neon-green neon-green-glow"
            >
              $TIRED
            </Link>
            <SocialLinks />
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              onClick={() => playClick()}
              className="font-mono text-xs text-foreground/50 hover:text-neon-pink"
            >
              ← Home
            </Link>
            <button
              onClick={openVent}
              className="rounded-full border border-neon-pink/50 bg-neon-pink/10 px-4 py-1.5 font-mono text-xs text-neon-pink"
            >
              VENT 😤
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 px-4 pt-24 pb-16">
        <WhitelistForm />
      </main>
    </div>
  );
}
