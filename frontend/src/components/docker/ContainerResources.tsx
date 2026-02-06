'use client';

import { useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cpu, MemoryStick } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import type { ContainerStats } from '@/lib/types';

function Sparkline({ data, color, max = 100 }: { data: number[]; color: string; max?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Fill gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '40');
    grad.addColorStop(1, color + '00');

    ctx.beginPath();
    ctx.moveTo(0, h);
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (Math.min(v, max) / max) * h;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (Math.min(v, max) / max) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [data, color, max]);

  return <canvas ref={canvasRef} width={80} height={24} className="opacity-80" />;
}

// Store history per container
const cpuHistory = new Map<string, number[]>();
const memHistory = new Map<string, number[]>();
const MAX_POINTS = 30;

export function ContainerResourcesInline({ containerId }: { containerId: string }) {
  const { activeServerId } = useServerStore();

  const { data: allStats } = useQuery<ContainerStats[]>({
    queryKey: ['containerStats', activeServerId],
    enabled: false,
  });

  const stat = allStats?.find(s => s.id === containerId.substring(0, 12));

  if (stat) {
    // Update history
    if (!cpuHistory.has(stat.id)) cpuHistory.set(stat.id, []);
    if (!memHistory.has(stat.id)) memHistory.set(stat.id, []);
    const cpuH = cpuHistory.get(stat.id)!;
    const memH = memHistory.get(stat.id)!;
    cpuH.push(stat.cpu);
    memH.push(stat.memPercent);
    if (cpuH.length > MAX_POINTS) cpuH.shift();
    if (memH.length > MAX_POINTS) memH.shift();
  }

  const cpuH = cpuHistory.get(containerId.substring(0, 12)) || [];
  const memH = memHistory.get(containerId.substring(0, 12)) || [];

  if (!stat) return null;

  return (
    <div className="flex items-center gap-3 mr-2">
      <div className="flex items-center gap-1.5">
        <Cpu className="w-3 h-3 text-white/20" />
        <Sparkline data={cpuH} color="#818cf8" />
        <span className="text-xs font-mono text-white/40 w-12 text-right">{stat.cpu.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-1.5">
        <MemoryStick className="w-3 h-3 text-white/20" />
        <Sparkline data={memH} color="#34d399" />
        <span className="text-xs font-mono text-white/40 w-14 text-right">{formatBytes(stat.memUsage)}</span>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'K';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(0) + 'M';
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + 'G';
}
