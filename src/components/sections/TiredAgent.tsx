"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { AGENT_MESSAGES } from "@/lib/constants";
import { playTyping } from "@/lib/sounds";
import GlitchText from "@/components/effects/GlitchText";
import Mascot from "@/components/mascot/Mascot";

interface ChatMessage {
  id: number;
  text: string;
  isAgent: boolean;
  timestamp: string;
}

const userPrompts = [
  "Is this project safe?",
  "Should I ape?",
  "Wen moon?",
  "Is the dev doxxed?",
  "What's the utility?",
];

export default function TiredAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const msgId = useRef(0);

  const addMessage = (text: string, isAgent: boolean) => {
    const id = msgId.current++;
    setMessages((prev) => [
      ...prev.slice(-8),
      {
        id,
        text,
        isAgent,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  };

  useEffect(() => {
    const initial = setTimeout(() => {
      addMessage("TIRED Agent online. Already regretting it.", true);
    }, 1000);

    const interval = setInterval(() => {
      setIsTyping(true);
      playTyping();
      setTimeout(() => {
        setIsTyping(false);
        addMessage(
          AGENT_MESSAGES[Math.floor(Math.random() * AGENT_MESSAGES.length)],
          true,
        );
      }, 1200);
    }, 5000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleUserPrompt = (prompt: string) => {
    addMessage(prompt, false);
    setIsTyping(true);
    playTyping();
    setTimeout(() => {
      setIsTyping(false);
      const roasts: Record<string, string> = {
        "Is this project safe?":
          "Safe? In Web3? That's adorable. No. But we're tired, not malicious.",
        "Should I ape?":
          "Should you? Should anyone? I literally cannot recommend anything. DYOR or DYON (Do Your Own Nap).",
        "Wen moon?":
          "Moon? Bro we're too tired to leave the couch. Best case: low earth orbit.",
        "Is the dev doxxed?":
          "The dev is a silhouette leaning on a fence. That's as doxxed as we get.",
        "What's the utility?":
          "Utility: collective exhaustion as a bonding mechanism. Also an AI that roasts rugs.",
      };
      addMessage(
        roasts[prompt] || "I don't know. I'm an AI and I'm tired too.",
        true,
      );
    }, 1500);
  };

  return (
    <section id="agent" className="relative px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <GlitchText
            as="h2"
            className="font-mono text-4xl font-bold text-neon-purple sm:text-5xl"
          >
            THE TIRED AGENT
          </GlitchText>
          <p className="mt-2 max-w-xl mx-auto text-foreground/60">
            An on-chain AI that roasts bad projects and auto-generates memes —
            no treasury, no exploits, just exhaustion.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="flex flex-col items-center justify-center lg:col-span-2">
            <Mascot size="xl" pose="typing" showSpeech quote="Even my AI is tired..." />
            <div className="mt-6 space-y-3 text-center">
              {[
                "🔥 Auto-roasts rugs in real-time",
                "🎨 Generates memes from CT drama",
                "🚫 No treasury — nothing to exploit",
                "🤖 On-chain, trustless, exhausted",
              ].map((feature) => (
                <motion.p
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="font-mono text-sm text-foreground/70"
                >
                  {feature}
                </motion.p>
              ))}
            </div>
          </div>

          <div className="neon-border flex flex-col rounded-2xl bg-background/60 lg:col-span-3">
            <div className="flex items-center gap-2 border-b border-neon-purple/20 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-neon-green" />
              <span className="ml-2 font-mono text-xs text-foreground/50">
                tired-agent.exe — running on fumes
              </span>
            </div>

            <div
              ref={chatRef}
              className="flex-1 space-y-3 overflow-y-auto p-4"
              style={{ maxHeight: "350px", minHeight: "350px" }}
            >
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.isAgent ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 font-mono text-sm ${
                        msg.isAgent
                          ? "bg-neon-purple/20 text-foreground/90"
                          : "bg-neon-green/20 text-foreground/90"
                      }`}
                    >
                      <p>{msg.text}</p>
                      <p className="mt-1 text-[10px] text-foreground/30">
                        {msg.timestamp}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1 px-3"
                >
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neon-purple" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neon-purple [animation-delay:0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neon-purple [animation-delay:0.2s]" />
                </motion.div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-neon-purple/20 p-3">
              {userPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleUserPrompt(prompt)}
                  className="rounded-full border border-neon-purple/30 px-3 py-1 font-mono text-xs text-foreground/60 transition-colors hover:border-neon-pink/50 hover:text-neon-pink"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
