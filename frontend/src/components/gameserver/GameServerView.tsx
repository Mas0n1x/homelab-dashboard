/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Activity, Archive, CalendarClock, Circle, Folder, Network, Play, RotateCw, Skull, Square, TerminalSquare, SlidersHorizontal, ChevronLeft } from 'lucide-react';
import { useGameservers } from '@/hooks/useGameservers';
import { PageTransition } from '@/components/ui/PageTransition';
import { type GameServer, gameIcon, makeGsApi, stateStyle } from './shared';
import { ConsolePanel } from './ConsolePanel';
import { PerformancePanel } from './PerformancePanel';
import { FilesPanel } from './FilesPanel';
import { BackupsPanel } from './BackupsPanel';
import { SchedulesPanel } from './SchedulesPanel';
import { StartupPanel } from './StartupPanel';

type Tab = 'console' | 'performance' | 'files' | 'backups' | 'schedules' | 'startup' | 'network';

const TABS: [Tab, string, any][] = [
  ['console', 'Konsole', TerminalSquare], ['performance', 'Leistung', Activity], ['files', 'Dateien', Folder],
  ['backups', 'Backups', Archive], ['schedules', 'Zeitpläne', CalendarClock], ['startup', 'Start-Optionen', SlidersHorizontal],
  ['network', 'Netzwerk', Network],
];

export function GameServerView({ id }: { id: string }) {
  const { data, isLoading, refetch } = useGameservers();
  const qc = useQueryClient();
  const server: GameServer | undefined = data?.servers.find(s => s.id === id);
  const api = useMemo(() => makeGsApi(id), [id]);
  const [tab, setTab] = useState<Tab>('console');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const flash = useMemo(() => (m: string) => { setToast(m); setTimeout(() => setToast(''), 3200); }, []);

  if (isLoading) return <PageTransition><p className="text-sm text-white/40">Lade…</p></PageTransition>;
  if (!server) {
    return (
      <PageTransition>
        <div className="space-y-3">
          <Link href="/gameserver" className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition"><ChevronLeft className="w-4 h-4" /> Alle Gameserver</Link>
          <p className="text-white/60">{data?.error ? `Pelican nicht erreichbar: ${data.error}` : 'Dieser Server existiert nicht (mehr).'}</p>
        </div>
      </PageTransition>
    );
  }

  const st = stateStyle(server.state);
  const running = !!server.state.running;
  const Icon = gameIcon(server.game);

  const power = async (action: 'start' | 'restart' | 'stop' | 'kill') => {
    if (action === 'kill' && !confirm('Server hart beenden? Nicht gespeicherte Daten gehen verloren.')) return;
    setBusy(true);
    const r = await api('/power', { method: 'POST', body: JSON.stringify({ action }) });
    if (r.error) flash(r.error);
    // Der Zustand wechselt über starting/stopping — kurz hintereinander nachladen, damit das Abzeichen mitläuft.
    [800, 2500, 6000].forEach(ms => setTimeout(() => qc.invalidateQueries({ queryKey: ['gameservers'] }), ms));
    await refetch();
    setBusy(false);
  };

  const transitioning = server.state.state === 'starting' || server.state.state === 'stopping';

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold flex items-center gap-3">
              <Icon className="w-6 h-6 text-orange-400/80" /> <span>{server.name}</span>
            </motion.h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-white/40 flex-wrap">
              <Circle className="w-2.5 h-2.5" style={{ fill: st.color, color: st.color }} /><span style={{ color: st.color }}>{st.text}</span>
              <span className="text-white/20">·</span><span>{server.gameLabel}</span>
              {server.host && <><span className="text-white/20">·</span><span className="font-mono">{server.host}</span></>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={busy || running || transitioning} onClick={() => power('start')} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30 transition"><Play className="w-4 h-4" /> Start</button>
            <button disabled={busy || !running || transitioning} onClick={() => power('restart')} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 disabled:opacity-30 transition"><RotateCw className="w-4 h-4" /> Neustart</button>
            {server.state.state === 'stopping'
              ? <button disabled={busy} onClick={() => power('kill')} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition"><Skull className="w-4 h-4" /> Abbrechen</button>
              : <button disabled={busy || !running || transitioning} onClick={() => power('stop')} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition"><Square className="w-4 h-4" /> Stopp</button>}
          </div>
        </div>

        {toast && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-orange-500/10 border border-orange-500/25 px-4 py-2.5 text-sm text-orange-200">{toast}</motion.div>}
        {server.state.error && <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-2.5 text-sm text-red-300">{server.state.error}</div>}
        {server.installing && <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-2.5 text-sm text-amber-200">Der Server wird gerade installiert — die Konsole zeigt den Fortschritt.</div>}

        <div className="flex items-center gap-1 border-b border-white/[0.06] overflow-x-auto">
          {TABS.map(([tid, label, TabIcon]) => (
            <button key={tid} onClick={() => setTab(tid)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 -mb-px whitespace-nowrap transition ${tab === tid ? 'border-orange-400 text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}><TabIcon className="w-4 h-4" /> {label}</button>
          ))}
        </div>

        {tab === 'console' && <ConsolePanel serverId={server.id} api={api} running={running} />}
        {tab === 'performance' && <PerformancePanel api={api} server={server} />}
        {tab === 'files' && <FilesPanel api={api} flash={flash} />}
        {tab === 'backups' && <BackupsPanel api={api} flash={flash} />}
        {tab === 'schedules' && <SchedulesPanel api={api} flash={flash} />}
        {tab === 'startup' && <StartupPanel api={api} flash={flash} />}
        {tab === 'network' && (
          <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
            {server.allocations.length === 0 && <p className="text-sm text-white/30 p-5 text-center">Keine Ports zugewiesen.</p>}
            {server.allocations.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                <Network className="w-4 h-4 text-white/30" />
                <span className="font-mono text-sm text-white/80">{a.alias || a.ip}:{a.port}</span>
                {a.default && <span className="text-[10px] uppercase tracking-wider text-orange-300/80 bg-orange-500/10 rounded px-1.5 py-0.5">Haupt-Port</span>}
                {a.notes && <span className="text-[12px] text-white/35 ml-auto">{a.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
