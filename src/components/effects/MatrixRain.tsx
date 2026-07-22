"use client";

import { useEffect, useRef } from "react";

const CHARS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789$TIRED";

export default function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let columns: number[] = [];
    let running = true;
    const fontSize = 14;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = Math.ceil(canvas.width / fontSize);
      columns = Array.from({ length: count }, () => Math.random() * -50);
    };

    const draw = () => {
      if (!running) return;

      // Fade trail — slightly stronger so the loop stays visible
      ctx.fillStyle = "rgba(5, 5, 8, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns.length; i++) {
        const y = columns[i];
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x = i * fontSize;

        ctx.fillStyle = `rgba(57, 255, 20, ${0.35 + Math.random() * 0.65})`;
        ctx.fillText(char, x, y * fontSize);

        // Reset drops that leave the screen so rain loops forever
        if (y * fontSize > canvas.height && Math.random() > 0.975) {
          columns[i] = 0;
        } else if (y * fontSize > canvas.height * 1.5) {
          // Hard reset if a column drifts too far off-screen
          columns[i] = Math.random() * -30;
        } else {
          columns[i] = y + 1;
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      running = false;
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="matrix-canvas"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-20"
    />
  );
}
