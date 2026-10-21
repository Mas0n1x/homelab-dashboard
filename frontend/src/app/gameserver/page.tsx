/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Circle, Cpu, MemoryStick } from 'lucide-react';
import { useGameservers } from '@/hooks/useGameservers';
import { PageTransition } from '@/components/ui/PageTransition';
import { gameIcon, fmtSize, fmtUptime, stateStyle } from '@/components/gameserver/shared';

export default function GameServerOverviewPage() {
  const { data, isLoading } = useGameservers();
  const servers = data?.servers || [];
  const online = servers.filter(s => s.state.running).length;

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold">Game<span className="text-gradient">server</span></motion.h1>
          <p className="text-sm text-white/40 mt-1">
            {isLoading ? 'Lade…' : `${servers.length} Server · ${online} laufen`} — neue Server aus Pelican erscheinen hier automatisch.
          </p>
        </div>

        {data && !data.configured && <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-3 text-sm text-amber-200">Pelican ist noch nicht verbunden: <code className="font-mono">PELICAN_CLIENT_KEY</code> fehlt in der .env des Dashboards.</div>}
        {data?.error && <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-3 text-sm text-red-300">{data.error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 [&>*]:h-full">
          {servers.map(s => {
            const st = stateStyle(s.state);
            const Icon = gameIcon(s.game);
            const href = s.game === 'minecraft' ? `/minecraft?server=${encodeURIComponent(`pelican:${s.id}`)}` : `/gameserver/${s.id}`;
            const memLimit = s.state.memoryLimit || s.limits.memory * 1024 * 1024;
            return (
              <Link key={s.id} href={href} className="glass-card rounded-2xl p-5 flex flex-col gap-4 hover:border-orange-400/30 transition group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5 text-orange-300/90" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white/90 truncate group-hover:text-white transition">{s.name}</p>
                    <p className="text-[12px] text-white/35 truncate">{s.gameLabel}{s.host ? ` · ${s.host}` : ''}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-[12px] flex-shrink-0" style={{ color: st.color }}><Circle className="w-2.5 h-2.5" style={{ fill: st.color }} />{st.text}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[12px] mt-auto">
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2"><p className="text-white/30 flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</p><p className="text-white/70 tabular-nums">{s.state.running ? `${s.state.cpu ?? 0} %` : '—'}</p></div>
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2"><p className="text-white/30 flex items-center gap-1"><MemoryStick className="w-3 h-3" /> RAM</p><p className="text-white/70 tabular-nums">{s.state.running ? fmtSize(s.state.memory || 0) : '—'}</p></div>
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2"><p className="text-white/30">Laufzeit</p><p className="text-white/70 tabular-nums">{s.state.running ? fmtUptime(s.state.uptime) : '—'}</p></div>
                </div>
                {s.state.running && memLimit > 0 && (
                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden -mt-1"><div className="h-full rounded-full bg-violet-400/70" style={{ width: `${Math.min(100, ((s.state.memory || 0) / memLimit) * 100)}%` }} /></div>
                )}
              </Link>
            );
          })}
        </div>
        {!isLoading && data?.configured && servers.length === 0 && !data.error && <p className="text-sm text-white/30 text-center py-10">Noch keine Server in Pelican angelegt.</p>}
      </div>
    </PageTransition>
  );
}
