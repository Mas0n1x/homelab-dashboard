'use client';

import { useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Cpu, MemoryStick, Network, HardDrive, Clock } from 'lucide-react';
import { UptimeTimeline } from './UptimeTimeline';
import { useServerStore } from '@/stores/serverStore';
import type { Service, ContainerStats } from '@/lib/types';

// Sparkline chart component
function Sparkline({ data, color, max = 100, width = 120, height = 32 }: {
  data: number[]; color: string; max?: number; width?: number; height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

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
  }, [data, color, max, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="opacity-90" />;
}

// Circular gauge component
function Gauge({ value, color, label, detail }: {
  value: number; color: string; label: string; detail: string;
}) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value, 100) / 100;
  const offset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
          <circle
            cx="32" cy="32" r={radius} fill="none"
            stroke={color} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-mono font-bold" style={{ color }}>{value.toFixed(1)}%</span>
        </div>
      </div>
      <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
      <span className="text-[10px] text-white/30 font-mono">{detail}</span>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

// History storage per service
const cpuHistory = new Map<string, number[]>();
const memHistory = new Map<string, number[]>();
const MAX_POINTS = 40;

export function ServiceDetail({ service }: { service: Service }) {
  const { activeServerId } = useServerStore();
  const isDocker = service.source === 'docker';

  const { data: allStats } = useQuery<ContainerStats[]>({
    queryKey: ['containerStats', activeServerId],
    enabled: false,
  });

  // Extract short container ID: service.containerId (full) or from service.id (format: "docker-<shortId>")
  const shortContainerId = isDocker
    ? (service.containerId ? service.containerId.substring(0, 12) : service.id.replace('docker-', ''))
    : null;

  // Match against container stats
  const stat = shortContainerId ? allStats?.find(s => s.id === shortContainerId) : null;

  // Update history
  if (stat && shortContainerId) {
    if (!cpuHistory.has(shortContainerId)) cpuHistory.set(shortContainerId, []);
    if (!memHistory.has(shortContainerId)) memHistory.set(shortContainerId, []);
    const cpuH = cpuHistory.get(shortContainerId)!;
    const memH = memHistory.get(shortContainerId)!;
    cpuH.push(stat.cpu);
    memH.push(stat.memPercent);
    if (cpuH.length > MAX_POINTS) cpuH.shift();
    if (memH.length > MAX_POINTS) memH.shift();
  }

  const cpuH = shortContainerId ? (cpuHistory.get(shortContainerId) || []) : [];
  const memH = shortContainerId ? (memHistory.get(shortContainerId) || []) : [];

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="pt-3 space-y-3">
        {/* Resource Stats (Docker only) */}
        {isDocker && stat && (
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive className="w-3.5 h-3.5 text-white/30" />
              <span className="text-xs font-medium text-white/50">Ressourcen-Verbrauch</span>
              <span className="text-[10px] text-white/20 font-mono ml-auto">{service.image}</span>
            </div>

            {/* Gauges */}
            <div className="flex items-start justify-around mb-4">
              <Gauge
                value={stat.cpu}
                color="#818cf8"
                label="CPU"
                detail={`${stat.cpu.toFixed(2)}%`}
              />
              <Gauge
                value={stat.memPercent}
                color="#34d399"
                label="RAM"
                detail={`${formatBytes(stat.memUsage)} / ${formatBytes(stat.memLimit)}`}
              />
            </div>

            {/* Sparkline Charts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 rounded-lg bg-white/[0.02]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Cpu className="w-3 h-3 text-indigo-400/60" />
                  <span className="text-[10px] text-white/40">CPU Verlauf</span>
                  <span className="text-[10px] font-mono text-indigo-400 ml-auto">{stat.cpu.toFixed(1)}%</span>
                </div>
                {cpuH.length >= 2 ? (
                  <Sparkline data={cpuH} color="#818cf8" />
                ) : (
                  <div className="h-8 flex items-center justify-center text-[10px] text-white/20">Sammle Daten...</div>
                )}
              </div>
              <div className="p-2 rounded-lg bg-white/[0.02]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MemoryStick className="w-3 h-3 text-emerald-400/60" />
                  <span className="text-[10px] text-white/40">RAM Verlauf</span>
                  <span className="text-[10px] font-mono text-emerald-400 ml-auto">{formatBytes(stat.memUsage)}</span>
                </div>
                {memH.length >= 2 ? (
                  <Sparkline data={memH} color="#34d399" />
                ) : (
                  <div className="h-8 flex items-center justify-center text-[10px] text-white/20">Sammle Daten...</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Docker service without stats (not running) */}
        {isDocker && !stat && (
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center gap-2 text-white/30">
              <HardDrive className="w-3.5 h-3.5" />
              <span className="text-xs">Keine Ressourcen-Daten — Container läuft nicht</span>
            </div>
          </div>
        )}

        {/* Uptime Timeline (all services) */}
        <UptimeTimeline serviceId={service.id} serviceName={service.name} />
      </div>
    </motion.div>
  );
}
