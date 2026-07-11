"use client";

import { useEffect, useState } from "react";
import { MASCOT_QUOTES } from "@/lib/constants";
import Mascot from "./Mascot";

export default function MascotSpeech() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [pose, setPose] = useState<"idle" | "facepalm" | "typing" | "complaining">("complaining");

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % MASCOT_QUOTES.length);
      const poses = ["idle", "facepalm", "typing", "complaining"] as const;
      setPose(poses[Math.floor(Math.random() * poses.length)]);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Mascot
      size="xl"
      pose={pose}
      quote={MASCOT_QUOTES[quoteIndex]}
      showSpeech
    />
  );
}
