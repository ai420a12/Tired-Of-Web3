"use client";

import { useState, useCallback } from "react";
import MatrixRain from "@/components/effects/MatrixRain";
import Nav from "@/components/ui/Nav";
import VentModal from "@/components/ui/VentModal";
import Hero from "@/components/sections/Hero";
import Manifesto from "@/components/sections/Manifesto";
import Tokenomics from "@/components/sections/Tokenomics";
import TiredAgent from "@/components/sections/TiredAgent";
import Roadmap from "@/components/sections/Roadmap";
import Community from "@/components/sections/Community";
import { playSigh } from "@/lib/sounds";

export default function Home() {
  const [ventOpen, setVentOpen] = useState(false);

  const openVent = useCallback(() => {
    playSigh();
    setVentOpen(true);
  }, []);

  const closeVent = useCallback(() => {
    setVentOpen(false);
  }, []);

  return (
    <div className="scanlines relative min-h-screen">
      <MatrixRain />
      <Nav onVentClick={openVent} />
      <VentModal isOpen={ventOpen} onClose={closeVent} />

      <main className="relative z-10">
        <Hero />
        <Manifesto />
        <Tokenomics />
        <TiredAgent />
        <Roadmap />
        <Community />
      </main>

      <footer className="relative z-10 border-t border-neon-purple/20 px-4 py-8 text-center">
        <p className="font-mono text-xs text-foreground/30">
          $TIRED — Not financial advice. Not medical advice. Just tired advice.
        </p>
        <p className="mt-1 font-mono text-xs text-foreground/20">
          © 2026 TiredOfWeb3. All rugs reserved.
        </p>
      </footer>

      <button
        id="vent-fab"
        onClick={openVent}
        className="fixed right-4 bottom-4 z-50 rounded-full border border-neon-pink/50 bg-neon-pink/20 px-4 py-3 font-mono text-sm text-neon-pink shadow-lg backdrop-blur-sm transition-all hover:bg-neon-pink/30 hover:shadow-neon-pink/20 sm:right-6 sm:bottom-6"
        aria-label="Open rant generator"
      >
        VENT 😤
      </button>
    </div>
  );
}
