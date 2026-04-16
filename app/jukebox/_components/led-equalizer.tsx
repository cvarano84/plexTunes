"use client";

import React, { useRef, useEffect, useCallback } from 'react';

export default function LEDEqualizer({ analyserNode, isPlaying, bandCount = 32, colorScheme = 'classic', height }: {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
  bandCount?: number;
  colorScheme?: string;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const fallbackBarsRef = useRef<number[]>([]);

  const getBarColor = useCallback((normalizedHeight: number) => {
    if (colorScheme === 'purple') {
      if (normalizedHeight > 0.85) return '#ff3366';
      if (normalizedHeight > 0.65) return '#cc44ff';
      return '#7c3aed';
    }
    if (colorScheme === 'cyan') {
      if (normalizedHeight > 0.85) return '#ff3366';
      if (normalizedHeight > 0.65) return '#06b6d4';
      return '#0ea5e9';
    }
    if (normalizedHeight > 0.85) return '#ef4444';
    if (normalizedHeight > 0.65) return '#eab308';
    return '#22c55e';
  }, [colorScheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (fallbackBarsRef.current.length !== bandCount) {
      fallbackBarsRef.current = Array(bandCount).fill(0);
    }

    const draw = () => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;

      const bars = bandCount;
      const dpr = window.devicePixelRatio || 1;
      const gap = Math.round(2 * dpr);
      const barW = Math.max(Math.round(2 * dpr), Math.floor((w - gap * (bars - 1)) / bars));
      const ledH = Math.round(4 * dpr);
      const ledGap = Math.round(2 * dpr);
      const maxLeds = Math.floor(h / (ledH + ledGap));

      let dataArray: Uint8Array | null = null;
      if (analyserNode) {
        dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(dataArray);
      }

      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      for (let i = 0; i < bars; i++) {
        let value: number;
        if (dataArray && analyserNode) {
          const idx = Math.floor((i / bars) * dataArray.length);
          value = (dataArray[idx] ?? 0) / 255;
        } else if (isPlaying) {
          const target = 0.2 + Math.random() * 0.6;
          fallbackBarsRef.current[i] = (fallbackBarsRef.current[i] ?? 0) * 0.7 + target * 0.3;
          value = fallbackBarsRef.current[i];
        } else {
          fallbackBarsRef.current[i] = (fallbackBarsRef.current[i] ?? 0) * 0.9;
          value = fallbackBarsRef.current[i];
        }

        const activeLeds = Math.max(0, Math.round(value * maxLeds));
        const x = Math.round(i * (barW + gap));

        for (let led = 0; led < maxLeds; led++) {
          const y = Math.round(h - (led + 1) * (ledH + ledGap));
          const normalizedH = led / maxLeds;
          if (led < activeLeds) {
            ctx.fillStyle = getBarColor(normalizedH);
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
          }
          ctx.fillRect(x, y, barW, ledH);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [analyserNode, isPlaying, bandCount, getBarColor]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg"
      style={{ imageRendering: 'pixelated', height: height ? `${height}px` : 'clamp(3rem,5vh,5rem)' }}
    />
  );
}
