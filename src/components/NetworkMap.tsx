// ============================================================
// NetworkMap.tsx — Animated network topology / attack flow map
// ============================================================
import { useEffect, useRef } from 'react';
import type { SimulatorState } from '../types';
import type { Phase } from '../types';

interface Props {
  sim: SimulatorState;
}

interface Node {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  r: number;
  color: string;
  icon: string;
}

interface Edge {
  from: string;
  to: string;
  phase: Phase;
  label: string;
  color: string;
}

const NODES: Node[] = [
  { id: 'attacker', label: 'ADVERSARY',    sublabel: '192.168.1.200',  x: 80,  y: 120, r: 28, color: '#ff0040', icon: '☠' },
  { id: 'c2',       label: 'C2 SERVER',    sublabel: '10.0.0.99:4444', x: 220, y: 60,  r: 22, color: '#9b59b6', icon: '🌐' },
  { id: 'victim',   label: 'FILE SERVER',  sublabel: '192.168.1.10',   x: 380, y: 120, r: 26, color: '#00d4ff', icon: '🖥' },
  { id: 'vault',    label: 'test_vault/',  sublabel: '/srv/files',     x: 380, y: 230, r: 20, color: '#ff4400', icon: '📁' },
  { id: 'defender', label: 'DEFENDER',     sublabel: 'canary_daemon',  x: 220, y: 230, r: 22, color: '#00ff41', icon: '🛡' },
  { id: 'soc',      label: 'SOC DASHBOARD',sublabel: 'localhost:5000', x: 80,  y: 230, r: 20, color: '#00ff41', icon: '📊' },
];

const EDGES: Edge[] = [
  { from: 'attacker', to: 'c2',       phase: 2, label: 'KEY EXCH', color: '#9b59b6' },
  { from: 'attacker', to: 'victim',   phase: 1, label: 'RECON',    color: '#ff4400' },
  { from: 'attacker', to: 'vault',    phase: 3, label: 'ENCRYPT',  color: '#ff0040' },
  { from: 'vault',    to: 'defender', phase: 4, label: 'TRIGGER',  color: '#ffaa00' },
  { from: 'defender', to: 'soc',      phase: 4, label: 'ALERT',    color: '#00ff41' },
];

export default function NetworkMap({ sim }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;
    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width;
      const H = canvas.height;

      // Scale factor
      const scaleX = W / 460;
      const scaleY = H / 300;
      const scale  = Math.min(scaleX, scaleY) * 0.9;

      ctx.save();
      ctx.translate((W - 460 * scale) / 2, (H - 300 * scale) / 2);
      ctx.scale(scale, scale);

      // Draw grid
      ctx.strokeStyle = 'rgba(0,255,65,0.05)';
      ctx.lineWidth   = 0.5;
      for (let x = 0; x < 460; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 300); ctx.stroke();
      }
      for (let y = 0; y < 300; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(460, y); ctx.stroke();
      }

      // Draw edges
      EDGES.forEach(edge => {
        const from = NODES.find(n => n.id === edge.from)!;
        const to   = NODES.find(n => n.id === edge.to)!;
        const isActive = sim.phase >= edge.phase;

        ctx.save();
        ctx.globalAlpha = isActive ? 0.9 : 0.15;
        ctx.strokeStyle = edge.color;
        ctx.lineWidth   = isActive ? 1.5 : 0.5;

        if (isActive) {
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -t * 2;
        }

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        // Packet dot animation
        if (isActive) {
          const progress = (Math.sin(t * 0.05 + edge.phase) + 1) / 2;
          const px = from.x + (to.x - from.x) * progress;
          const py = from.y + (to.y - from.y) * progress;
          ctx.setLineDash([]);
          ctx.fillStyle = edge.color;
          ctx.shadowColor = edge.color;
          ctx.shadowBlur  = 8;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Edge label
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        ctx.setLineDash([]);
        ctx.font         = `${isActive ? 'bold ' : ''}7px 'Share Tech Mono', monospace`;
        ctx.fillStyle    = edge.color;
        ctx.globalAlpha  = isActive ? 0.8 : 0.2;
        ctx.textAlign    = 'center';
        ctx.fillText(edge.label, mx, my - 4);

        ctx.restore();
      });

      // Draw nodes
      NODES.forEach(node => {
        const isAttacker = node.id === 'attacker';
        const isDefender = node.id === 'defender' || node.id === 'soc';
        const isVault    = node.id === 'vault';
        const isActive   = sim.isRunning && (isAttacker || (isVault && sim.phase >= 3));

        ctx.save();

        // Outer glow ring
        if (isActive) {
          const glowR = node.r + 4 + Math.sin(t * 0.1) * 3;
          const grad  = ctx.createRadialGradient(node.x, node.y, node.r, node.x, node.y, glowR + 6);
          grad.addColorStop(0, `${node.color}40`);
          grad.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(node.x, node.y, glowR + 6, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle   = `${node.color}12`;
        ctx.strokeStyle = node.color;
        ctx.lineWidth   = isActive ? 2 : 1;
        ctx.globalAlpha = isActive ? 1 : isDefender ? 0.9 : 0.5;
        ctx.fill();
        ctx.stroke();

        // Icon
        ctx.font      = `${Math.round(node.r * 0.7)}px Arial`;
        ctx.fillStyle = node.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.icon, node.x, node.y);

        // Label
        ctx.font      = 'bold 8px Rajdhani, sans-serif';
        ctx.fillStyle = node.color;
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, node.x, node.y + node.r + 4);

        // Sub-label
        ctx.font      = '7px Share Tech Mono, monospace';
        ctx.globalAlpha *= 0.6;
        ctx.fillText(node.sublabel, node.x, node.y + node.r + 14);

        ctx.restore();
      });

      t++;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [sim]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3
          className="font-['Orbitron'] text-sm font-bold tracking-widest text-[#9b59b6]"
          style={{ textShadow: '0 0 8px #9b59b680' }}
        >
          ◈ NETWORK TOPOLOGY
        </h3>
        <span className="text-[10px] font-['Share_Tech_Mono'] text-[#9b59b680]">
          LIVE ATTACK FLOW
        </span>
      </div>
      <div
        className="flex-1 rounded overflow-hidden"
        style={{ background: '#000', border: '1px solid #9b59b620' }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: 'block' }}
          width={460}
          height={300}
        />
      </div>
    </div>
  );
}
