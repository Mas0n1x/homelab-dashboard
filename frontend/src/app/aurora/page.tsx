/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { Cloud, ExternalLink, Users, FileText, HardDrive, Share2, Trash2, History } from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import * as api from '@/lib/api';

function fmtBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function AuroraStats() {
  const { data } = useQuery({
    queryKey: ['aurora-metrics'],
    queryFn: () => api.getAuroraMetrics(),
    refetchInterval: 60000,
    retry: false,
  });
  if (!data) return null;

  const items = [
    { icon: Users, label: 'Nutzer', value: String(data.users), tint: 'text-sky-400' },
    { icon: FileText, label: 'Dateien', value: `${data.files} · ${data.folders} Ordner`, tint: 'text-cyan-400' },
    { icon: HardDrive, label: 'Speicher', value: fmtBytes(data.storageBytes), tint: 'text-violet-400' },
    { icon: Share2, label: 'Freigaben', value: String(data.shares), tint: 'text-emerald-400' },
    { icon: History, label: 'Versionen', value: `${data.versions} · ${fmtBytes(data.versionBytes)}`, tint: 'text-amber-400' },
    { icon: Trash2, label: 'Papierkorb', value: `${data.trashItems} · ${fmtBytes(data.trashBytes)}`, tint: 'text-white/50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {items.map(it => {
        const Icon = it.icon;
        return (
          <div key={it.label} className="glass-card-elevated p-3 flex items-center gap-2.5">
            <Icon className={`w-4 h-4 flex-shrink-0 ${it.tint}`} />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-white/30">{it.label}</p>
              <p className="text-[13px] font-medium tabular-nums truncate">{it.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Aurora läuft als eigener Dienst auf dem Pi und wird same-origin unter
// /aurora-app/ eingebettet (nginx-Proxy). So sind alle Funktionen 1:1 verfügbar
// und das Login-Cookie funktioniert (gleiche Herkunft wie das Dashboard).
export default function AuroraPage() {
  return (
    <PageTransition>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-accent-light" />
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-none">Aurora</h1>
              <p className="text-sm text-white/40 mt-1">Deine Self-Hosted Cloud</p>
            </div>
          </div>
          <a
            href="/aurora-app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all duration-200"
            title="In neuem Tab öffnen"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Neuer Tab</span>
          </a>
        </div>

        <AuroraStats />

        <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-black/20 h-[calc(100dvh-17rem)] sm:h-[calc(100dvh-15rem)] min-h-[420px]">
          <iframe
            src="/aurora-app/"
            title="Aurora"
            className="w-full h-full border-0"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        </div>
      </div>
    </PageTransition>
  );
}
