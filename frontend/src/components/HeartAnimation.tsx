"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export function PulsingHeart({ size = 200 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Glow rings - multiple layers */}
      <motion.div
        className="absolute inset-0 rounded-full bg-red-500/20"
        animate={{
          scale: [1, 1.6, 1],
          opacity: [0.4, 0, 0.4],
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 rounded-full bg-red-500/15"
        animate={{
          scale: [1, 2.2, 1],
          opacity: [0.3, 0, 0.3],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.15,
        }}
      />
      <motion.div
        className="absolute inset-0 rounded-full bg-red-500/10"
        animate={{
          scale: [1, 3, 1],
          opacity: [0.2, 0, 0.2],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.3,
        }}
      />
      {/* Heart */}
      <motion.div
        className="flex h-full w-full items-center justify-center"
        animate={{
          scale: [1, 1.18, 1, 1.12, 1],
        }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <span style={{ fontSize: size * 0.55 }}>🫀</span>
      </motion.div>
    </div>
  );
}

// ─── Onde de battement plein écran ───
export function HeartbeatWave() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* Onde 1 - rapide */}
      <motion.div
        className="absolute rounded-full border border-red-500/30"
        style={{ width: 100, height: 100 }}
        animate={{
          scale: [0.5, 25],
          opacity: [0.6, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeOut",
        }}
      />
      {/* Onde 2 - décalée */}
      <motion.div
        className="absolute rounded-full border border-red-500/20"
        style={{ width: 100, height: 100 }}
        animate={{
          scale: [0.5, 25],
          opacity: [0.5, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeOut",
          delay: 0.8,
        }}
      />
      {/* Onde 3 - lente */}
      <motion.div
        className="absolute rounded-full border border-red-400/15"
        style={{ width: 100, height: 100 }}
        animate={{
          scale: [0.5, 25],
          opacity: [0.4, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeOut",
          delay: 1.6,
        }}
      />
      {/* Flash subtil au centre */}
      <motion.div
        className="absolute h-32 w-32 rounded-full bg-red-500/10 blur-3xl"
        animate={{
          scale: [1, 2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

// ─── Particules flottantes en arrière-plan ───
export function FloatingParticles() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 10 + 10,
    delay: Math.random() * 5,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-red-500/20"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [-20, 20, -20],
            x: [-10, 10, -10],
            opacity: [0.1, 0.4, 0.1],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─── Ligne de scan animée ───
export function ScanLine() {
  return (
    <motion.div
      className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60"
      animate={{
        top: ["0%", "100%", "0%"],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  );
}
