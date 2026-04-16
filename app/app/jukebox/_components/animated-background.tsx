"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import { usePlayer } from '@/lib/player-context';

export type BgStyle = 'none' | 'aurora' | 'particles' | 'waves' | 'nebula' | 'gradient-flow';

interface AnimatedBackgroundProps {
  style: BgStyle;
  musicReactive?: boolean;
}

export default function AnimatedBackground({ style, musicReactive = true }: AnimatedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const { analyserNode, isPlaying } = usePlayer();

  const getEnergy = useCallback(() => {
    if (!musicReactive || !analyserNode || !isPlaying) return 0.3;
    const buf = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i];
    return Math.min(1, (sum / buf.length / 255) * 2.5);
  }, [musicReactive, analyserNode, isPlaying]);

  useEffect(() => {
    if (style === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0;
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Particle systems
    interface Particle {
      x: number; y: number; vx: number; vy: number;
      size: number; alpha: number; hue: number; life: number;
    }
    const particles: Particle[] = [];
    const initParticles = (count: number) => {
      particles.length = 0;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 3 + 1, alpha: Math.random() * 0.3 + 0.1,
          hue: Math.random() * 60 + 220, life: Math.random() * 1000,
        });
      }
    };

    // Aurora: horizontal flowing curtains
    const drawAurora = (t: number, energy: number) => {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, w, h);
      const layers = 4;
      for (let l = 0; l < layers; l++) {
        const baseY = h * (0.2 + l * 0.15);
        const amp = 30 + energy * 40;
        const speed = 0.0003 + l * 0.0001;
        const hue = (200 + l * 30 + t * 0.01) % 360;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 4) {
          const y = baseY + Math.sin(x * 0.003 + t * speed) * amp
            + Math.sin(x * 0.007 + t * speed * 1.3) * amp * 0.5;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, baseY - amp, 0, baseY + amp * 2);
        grad.addColorStop(0, `hsla(${hue}, 70%, 50%, ${0.03 + energy * 0.06})`);
        grad.addColorStop(0.5, `hsla(${hue + 20}, 60%, 40%, ${0.02 + energy * 0.04})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fill();
      }
    };

    // Particles: floating motes
    const drawParticles = (t: number, energy: number) => {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + energy * 0.02})`;
      ctx.fillRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx + Math.sin(t * 0.0005 + p.life) * 0.2 * (1 + energy);
        p.y += p.vy + Math.cos(t * 0.0003 + p.life) * 0.15 * (1 + energy);
        p.life += 0.01;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
        const sz = p.size * (1 + energy * 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 60%, 60%, ${p.alpha * (0.5 + energy * 0.5)})`;
        ctx.fill();
      }
    };

    // Waves: horizontal sine waves
    const drawWaves = (t: number, energy: number) => {
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const baseY = h * (0.3 + i * 0.1);
        const hue = (260 + i * 25 + t * 0.008) % 360;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const y = baseY
            + Math.sin(x * 0.005 + t * 0.0004 + i) * (20 + energy * 30)
            + Math.sin(x * 0.01 + t * 0.0007 + i * 2) * (10 + energy * 15);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${hue}, 50%, 50%, ${0.08 + energy * 0.12})`;
        ctx.lineWidth = 1.5 + energy * 1.5;
        ctx.stroke();
      }
    };

    // Nebula: soft glowing blobs
    const drawNebula = (t: number, energy: number) => {
      ctx.fillStyle = 'rgba(0,0,0,0.02)';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3; i++) {
        const cx = w * (0.3 + 0.2 * Math.sin(t * 0.0002 + i * 2));
        const cy = h * (0.3 + 0.2 * Math.cos(t * 0.00015 + i * 1.5));
        const r = 150 + energy * 100;
        const hue = (220 + i * 40 + t * 0.005) % 360;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `hsla(${hue}, 60%, 50%, ${0.04 + energy * 0.06})`);
        grad.addColorStop(0.5, `hsla(${hue + 30}, 50%, 40%, ${0.02 + energy * 0.03})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    };

    // Gradient flow: slowly shifting color gradient
    const drawGradientFlow = (t: number, energy: number) => {
      const hue1 = (t * 0.01) % 360;
      const hue2 = (hue1 + 60 + energy * 30) % 360;
      const hue3 = (hue1 + 180) % 360;
      const x1 = w * (0.5 + 0.3 * Math.sin(t * 0.0002));
      const y1 = h * (0.5 + 0.3 * Math.cos(t * 0.00015));
      const grad = ctx.createRadialGradient(x1, y1, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      grad.addColorStop(0, `hsla(${hue1}, 50%, 15%, ${0.8 + energy * 0.2})`);
      grad.addColorStop(0.5, `hsla(${hue2}, 40%, 10%, 0.9)`);
      grad.addColorStop(1, `hsla(${hue3}, 30%, 5%, 1)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    };

    if (style === 'particles' || style === 'aurora') {
      initParticles(style === 'particles' ? 80 : 0);
    }

    let running = true;
    const loop = () => {
      if (!running) return;
      const t = performance.now();
      const energy = getEnergy();

      switch (style) {
        case 'aurora': drawAurora(t, energy); break;
        case 'particles': drawParticles(t, energy); break;
        case 'waves': drawWaves(t, energy); break;
        case 'nebula': drawNebula(t, energy); break;
        case 'gradient-flow': drawGradientFlow(t, energy); break;
      }

      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [style, getEnergy]);

  if (style === 'none') return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ opacity: 0.35 }}
      />
      {/* Dark scrim so text stays readable */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-black/50" />
    </>
  );
}
