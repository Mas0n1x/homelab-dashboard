'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cpu, ArrowUpDown, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { Process } from '@/lib/types';

interface ProcessManagerProps {
  serverId: string;
}

type SortField = 'cpuPercent' | 'memPercent' | 'pid' | 'name';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function ProcessManager({ serverId }: ProcessManagerProps) {
  const [sortBy, setSortBy] = useState<SortField>('cpuPercent');
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState('');

  const { data: processes, isLoading, error } = useQuery<Process[]>({
    queryKey: ['processes', serverId],
    queryFn: () => api.getProcesses(serverId),
    refetchInterval: 5000,
  });

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortAsc(!sortAsc);
    else { setSortBy(field); setSortAsc(false); }
  };

  const filtered = (processes || [])
    .filter(p => !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.cmdline.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      const mul = sortAsc ? 1 : -1;
      if (sortBy === 'name') return mul * a.name.localeCompare(b.name);
      return mul * ((a[sortBy] as number) - (b[sortBy] as number));
    });

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Prozesse</h3>
            <p className="text-[10px] text-white/30">{filtered.length} Prozesse</p>
          </div>
        </div>
        <div className="relative w-40">
          <Search className="w-3.5 h-3.5 text-white/20 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter..."
            className="glass-input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-white/20 text-xs">Lade Prozesse...</div>
      ) : error ? (
        <div className="py-8 text-center text-red-400/60 text-xs">Fehler: {(error as Error).message}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 border-b border-white/[0.04]">
                <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-white/50" onClick={() => handleSort('pid')}>
                  PID <SortIcon field="pid" current={sortBy} asc={sortAsc} />
                </th>
                <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-white/50" onClick={() => handleSort('name')}>
                  Name <SortIcon field="name" current={sortBy} asc={sortAsc} />
                </th>
                <th className="text-left py-2 px-2 font-medium">User</th>
                <th className="text-right py-2 px-2 font-medium cursor-pointer hover:text-white/50" onClick={() => handleSort('cpuPercent')}>
                  CPU% <SortIcon field="cpuPercent" current={sortBy} asc={sortAsc} />
                </th>
                <th className="text-right py-2 px-2 font-medium cursor-pointer hover:text-white/50" onClick={() => handleSort('memPercent')}>
                  MEM% <SortIcon field="memPercent" current={sortBy} asc={sortAsc} />
                </th>
                <th className="text-right py-2 px-2 font-medium hidden lg:table-cell">RSS</th>
                <th className="text-right py-2 px-2 font-medium hidden lg:table-cell">Threads</th>
                <th className="text-left py-2 px-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.pid} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group">
                  <td className="py-1.5 px-2 tabular-nums text-white/40">{p.pid}</td>
                  <td className="py-1.5 px-2 font-medium text-white/70 max-w-[200px] truncate" title={p.cmdline}>{p.name}</td>
                  <td className="py-1.5 px-2 text-white/30">{p.username}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">
                    <span className={clsx(
                      p.cpuPercent > 50 ? 'text-red-400' : p.cpuPercent > 20 ? 'text-amber-400' : 'text-white/50'
                    )}>
                      {p.cpuPercent.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums">
                    <span className={clsx(
                      p.memPercent > 50 ? 'text-red-400' : p.memPercent > 20 ? 'text-purple-400' : 'text-white/50'
                    )}>
                      {p.memPercent.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-right text-white/30 tabular-nums hidden lg:table-cell">{formatBytes(p.memRss)}</td>
                  <td className="py-1.5 px-2 text-right text-white/30 tabular-nums hidden lg:table-cell">{p.numThreads}</td>
                  <td className="py-1.5 px-2">
                    <span className={clsx(
                      'text-[10px] px-1.5 py-0.5 rounded-full',
                      p.status === 'running' ? 'bg-emerald-500/10 text-emerald-400' :
                      p.status === 'sleeping' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-white/[0.04] text-white/30'
                    )}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}

function SortIcon({ field, current, asc }: { field: string; current: string; asc: boolean }) {
  if (field !== current) return null;
  return <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-50" style={{ transform: asc ? 'scaleY(-1)' : undefined }} />;
}
