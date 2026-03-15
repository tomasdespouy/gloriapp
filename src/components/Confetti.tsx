"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

interface ConfettiProps {
  trigger: boolean;
  variant?: "default" | "stars" | "fireworks";
}

export default function Confetti({ trigger, variant = "default" }: ConfettiProps) {
  const hasFired = useRef(false);

  useEffect(() => {
    if (!trigger || hasFired.current) return;
    hasFired.current = true;

    if (variant === "stars") {
      const end = Date.now() + 1500;
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ["#4A55A2", "#4DD0E1", "#FFD700"],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ["#4A55A2", "#4DD0E1", "#FFD700"],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    } else if (variant === "fireworks") {
      const duration = 2000;
      const end = Date.now() + duration;
      const interval = setInterval(() => {
        confetti({
          startVelocity: 30,
          spread: 360,
          ticks: 60,
          zIndex: 9999,
          particleCount: 50,
          origin: { x: Math.random(), y: Math.random() * 0.4 },
          colors: ["#4A55A2", "#7C3AED", "#4DD0E1", "#22c55e", "#FFD700"],
        });
        if (Date.now() > end) clearInterval(interval);
      }, 250);
    } else {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        zIndex: 9999,
        colors: ["#4A55A2", "#4DD0E1", "#FFD700", "#22c55e", "#7C3AED"],
      });
    }
  }, [trigger, variant]);

  return null;
}
