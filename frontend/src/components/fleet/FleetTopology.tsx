/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { LayoutGrid, Rows3, List } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useFleetStore } from '@/stores/fleetStore';
import { useAlertOverview } from '@/hooks/useAttention';
import { ServerNodeCard } from './ServerNodeCard';
import { ServerCompactCard } from './ServerCompactCard';
import { ServerListRow, ServerListHeader } from './ServerListRow';
import { berechneMetriken } from './useServerMetrics';

type View = 'kompakt' | 'detail' | 'liste';
type Sort = 'problem' | 'name' | 'standard';

const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'kompakt', label: 'Kompakt', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { id: 'detail', label: 'Detail', icon: <Rows3 className="w-3.5 h-3.5" /> },
  { id: 'liste', label: 'Liste', icon: <List className="w-3.5 h-3.5" /> },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: 'problem', label: 'Probleme zuerst' },
  { id: 'name', label: 'Name' },
  { id: 'standard', label: 'Reihenfolge' },
];

const EMPTY = { system: null, containers: [], docker: null, lastUpdated: 0 };

function useStored<T extends string>(key: string, def: T, erlaubt: readonly T[]): [T, (v: T) => void] {
  const [wert, setWert] = useState<T>(def);
  useEffect(() => {
    const v = localStorage.getItem(key) as T | null;
    if (v && erlaubt.includes(v)) setWert(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [wert, (v: T) => { setWert(v); localStorage.setItem(key, v); }];
}

export function FleetTopology() {
  const { servers } = useServerStore();
  const { serverData } = useFleetStore();
  const { data: overview } = useAlertOverview();
  const [view, setView] = useStored<View>('fleet-view', 'kompakt', ['kompakt', 'detail', 'liste']);
  const [sort, setSort] = useStored<Sort>('fleet-sort', 'problem', ['problem', 'name', 'standard']);

  const sortiert = useMemo(() => {
    if (sort === 'standard') return servers;
    const kopie = [...servers];
    if (sort === 'name') return kopie.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    // Probleme zuerst: offline > Alarme > Warnstufe; bei Gleichstand bleibt die Reihenfolge stabil.
    const rang = (id: string) => {
      const s = servers.find(x => x.id === id)!;
      return berechneMetriken(s, serverData[id] || EMPTY, overview?.servers?.[id]).urgency;
    };
    return kopie.sort((a, b) => rang(b.id) - rang(a.id));
  }, [servers, sort, serverData, overview]);

  // Spalten je Anzahl. Flex mit zentrierter letzter Reihe statt Grid: bei fünf Servern in vier
  // Spalten stünde sonst eine einzelne Karte linksbündig allein in der zweiten Reihe.
  const count = servers.length;
  const spalten = view === 'kompakt'
    ? (count <= 2 ? 2 : count === 3 ? 3 : count === 5 || count === 6 ? 3 : 4)
    : (count <= 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : count === 5 || count === 6 ? 3 : 4);
  const breite = ({
    1: 'xl:w-full',
    2: 'xl:w-[calc(50%-0.5rem)]',
    3: 'xl:w-[calc(33.333%-0.667rem)]',
    4: 'xl:w-[calc(25%-0.75rem)]',
  } as Record<number, string>)[spalten];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/[0.03] border border-white/[0.06]" role="group" aria-label="Ansicht der Server">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              aria-pressed={view === v.id}
              className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] transition-colors',
                view === v.id ? 'bg-accent/20 text-accent-light' : 'text-white/55 hover:text-white/80')}
            >
              {v.icon}{v.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[12px] text-white/55">
          Sortierung
          <select
            value={sort}
            onChange={e => setSort(e.target.value as Sort)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-[12px] text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {SORTS.map(o => <option key={o.id} value={o.id} className="bg-[#0f0f23]">{o.label}</option>)}
          </select>
        </label>
      </div>

      {view === 'liste' ? (
        <div className="glass-card">
          <div className="relative z-10">
            <ServerListHeader />
            {sortiert.map(server => (
              <ServerListRow key={server.id} server={server} data={serverData[server.id] || EMPTY} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-4">
          {sortiert.map((server, index) => {
            const data = serverData[server.id] || EMPTY;
            return (
              <div key={server.id} className={clsx('w-full sm:w-[calc(50%-0.5rem)] flex', breite)}>
                <div className="w-full">
                  {view === 'detail'
                    ? <ServerNodeCard server={server} data={data} index={index} />
                    : <ServerCompactCard server={server} data={data} index={index} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
