'use client';

import { Server, Wifi, WifiOff, Clock, Cpu, MemoryStick, HardDrive, Thermometer } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { Server as ServerType } from '@/lib/types';
import type { ServerData } from '@/stores/fleetStore';

interface ServerHeaderProps {
  server: ServerType;
  data: ServerData;
}

export function ServerHeader({ server, data }: ServerHeaderProps) {
  const { system } = data;
  const isOnline = server.status === 'connected';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col sm:flex-row sm:items-center gap-4"
    >
      {/* Server identity */}
      <div className="flex items-center gap-3 flex-1">
        <div className={clsx(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          isOnline ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'
        )}>
          <Server className={clsx('w-6 h-6', isOnline ? 'text-emerald-400' : 'text-red-400')} />
        </div>
        <div>
          <h1 className="text-xl font-bold">{server.name}</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-white/40">{server.host}</span>
            <span className={clsx(
              'flex items-center gap-1 text-xs font-medium',
              isOnline ? 'text-emerald-400' : 'text-red-400'
            )}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      {system && (
        <div className="flex items-center gap-4 sm:gap-6">
          <QuickStat icon={<Cpu className="w-3.5 h-3.5" />} label="CPU" value={`${system.cpu.total.toFixed(1)}%`}
            color={system.cpu.total > 80 ? 'text-red-400' : system.cpu.total > 50 ? 'text-amber-400' : 'text-emerald-400'} />
          <QuickStat icon={<MemoryStick className="w-3.5 h-3.5" />} label="RAM" value={`${system.memory.percent.toFixed(1)}%`}
            color={system.memory.percent > 80 ? 'text-red-400' : 'text-purple-400'} />
          {system.temperature?.[0] && (
            <QuickStat icon={<Thermometer className="w-3.5 h-3.5" />} label="Temp" value={`${system.temperature[0].value.toFixed(0)}°C`}
              color={system.temperature[0].value > 75 ? 'text-red-400' : system.temperature[0].value > 60 ? 'text-amber-400' : 'text-emerald-400'} />
          )}
          {system.uptime && (
            <QuickStat icon={<Clock className="w-3.5 h-3.5" />} label="Uptime" value={system.uptime} color="text-white/60" />
          )}
        </div>
      )}
    </motion.div>
  );
}

function QuickStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/30">{icon}</span>
      <div>
        <p className="text-[10px] text-white/25 uppercase tracking-wider">{label}</p>
        <p className={clsx('text-sm font-semibold tabular-nums', color)}>{value}</p>
      </div>
    </div>
  );
}
