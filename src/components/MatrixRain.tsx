// ============================================================
// MatrixRain.tsx — Animated matrix digital rain background
// Uses canvas for performance; runs as a fixed background layer
// ============================================================
import { useEffect, useRef } from 'react';

const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ01アイウエオ1010ABCDEF$#@!%&';

export default function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let animId: number;
    const fontSize = 13;
    let cols: number[] = [];

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      const count   = Math.floor(canvas.width / fontSize);
      cols = Array.from({ length: count }, () => Math.random() * -canvas.height);
    };

    const draw = () => {
      ctx.fillStyle = 'rgba(3,10,3,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px 'Share Tech Mono', monospace`;

      cols.forEach((y, i) => {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x    = i * fontSize;

        // Leading char is brighter
        ctx.fillStyle = y < fontSize ? '#ffffff' : '#00ff41';
        ctx.fillText(char, x, y);

        // Reset when off screen
        if (y > canvas.height && Math.random() > 0.975) {
          cols[i] = 0;
        } else {
          cols[i] = y + fontSize;
        }
      });

      animId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="matrix-canvas"
      style={{ position: 'fixed', top: 0, left: 0, zIndex: 0, opacity: 0.04, pointerEvents: 'none' }}
    />
  );
}
