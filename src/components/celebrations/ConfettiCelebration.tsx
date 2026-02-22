"use client";

import { useEffect, useState } from "react";

interface Particle {
  id: number;
  color: string;
  left: number;
  delay: number;
}

const CONFETTI_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];
const PARTICLE_COUNT = 30;
const ANIMATION_DURATION_MS = 3000;

/**
 * CSS-only confetti animation. Renders colored squares that fall and rotate.
 * Respects prefers-reduced-motion via the CSS animation rule.
 */
export function ConfettiCelebration({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    setParticles(
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
      })),
    );

    const timer = setTimeout(() => setParticles([]), ANIMATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0 h-3 w-3 animate-confetti rounded-sm"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
