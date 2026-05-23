// ============================================================
// ThreatRadar.tsx — Animated radar sweep threat visualiser
// ============================================================
import { useEffect, useRef } from 'react';
import type { ThreatLevel } from '../types';

interface Props {
  level: ThreatLevel;
  alertCount: number;
  canariesTriggered: number;
}

const LEVEL_COLOR: Record<ThreatLevel, string> = {
  LOW:      '#00ff41',
  MEDIUM:   '#ffaa00',
  HIGH:     '#ff4400',
  CRITICAL: '#ff0040',
};

export default function ThreatRadar({ level, alertCount, canariesTriggered }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;
    let angle = 0;
    const blips: Array<{ x: number; y: number; age: number; intensity: number }> = [];

    // Seed blips based on alert count
    const addRandomBlip = () => {
      const r = (0.2 + Math.random() * 0.7) * (canvas.width / 2 - 20);
      const a = Math.random() * Math.PI * 2;
      blips.push({
        x: canvas.width / 2 + r * Math.cos(a),
        y: canvas.height / 2 + r * Math.sin(a),
        age: 0,
        intensity: 0.6 + Math.random() * 0.4,
      });
    };

    // Seed initial blips
    for (let i = 0; i < alertCount + canariesTriggered; i++) addRandomBlip();

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const R  = Math.min(W, H) / 2 - 10;

      ctx.clearRect(0, 0, W, H);

      const color = LEVEL_COLOR[level];

      // Background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      // Grid rings
      [0.25, 0.5, 0.75, 1].forEach(ratio => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * ratio, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}20`;
        ctx.lineWidth   = 0.5;
        ctx.stroke();
      });

      // Cross-hairs
      ctx.strokeStyle = `${color}15`;
      ctx.lineWidth   = 0.5;
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();

      // Outer circle
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = `${color}60`;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Sweep gradient
      const sweepLen = Math.PI / 1.5;

      // Draw sweep as a filled arc
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R - 1, angle - sweepLen, angle);
      ctx.closePath();
      const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      radGrad.addColorStop(0,   `${color}00`);
      radGrad.addColorStop(0.5, `${color}08`);
      radGrad.addColorStop(1,   `${color}18`);
      ctx.fillStyle = radGrad;
      ctx.fill();
      ctx.restore();

      // Sweep leading line
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle));
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 8;
      ctx.stroke();
      ctx.restore();

      // Blips
      blips.forEach((b, i) => {
        const alpha = Math.max(0, 1 - b.age / 80) * b.intensity;
        if (alpha <= 0) { blips.splice(i, 1); return; }

        // Detect if sweep just passed over blip
        const bAngle = Math.atan2(b.y - cy, b.x - cx);
        const diff   = ((angle - bAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (diff < 0.15) b.age = 0;

        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fillStyle   = color;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = color;
        ctx.shadowBlur  = 10;
        ctx.fill();
        ctx.restore();

        b.age++;
      });

      // Randomly add blip if triggered
      if (level !== 'LOW' && Math.random() < 0.01) addRandomBlip();

      // Centre dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle   = color;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 12;
      ctx.fill();
      ctx.shadowBlur  = 0;

      angle = (angle + 0.025) % (Math.PI * 2);
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [level, alertCount, canariesTriggered]);

  const color = LEVEL_COLOR[level];

  return (
    <div className="flex flex-col items-center h-full">
      <div className="flex items-center justify-between w-full mb-2">
        <h3
          className="font-['Orbitron'] text-sm font-bold tracking-widest"
          style={{ color, textShadow: `0 0 8px ${color}80` }}
        >
          ◈ THREAT RADAR
        </h3>
        <span
          className="text-[10px] font-['Orbitron'] font-bold px-2 py-0.5 rounded"
          style={{
            background: `${color}15`,
            border: `1px solid ${color}40`,
            color,
            textShadow: `0 0 6px ${color}`,
          }}
        >
          {level}
        </span>
      </div>
      <div
        className="flex-1 w-full rounded overflow-hidden"
        style={{ border: `1px solid ${color}20`, background: '#000' }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          width={200}
          height={200}
        />
      </div>
    </div>
  );
}
