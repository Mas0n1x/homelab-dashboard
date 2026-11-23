/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { FleetTopology } from '@/components/fleet/FleetTopology';
import { FleetSummaryBar } from '@/components/fleet/FleetSummaryBar';
import { FleetBentoGrid } from '@/components/fleet/FleetBentoGrid';
import { AttentionCenter } from '@/components/dashboard/AttentionCenter';
import { RequestsWidget } from '@/components/dashboard/RequestsWidget';
import { TodayWidget } from '@/components/dashboard/TodayWidget';
import { ChangesWidget } from '@/components/dashboard/ChangesWidget';
import { ImageUpdatesWidget } from '@/components/dashboard/ImageUpdatesWidget';
import { DiskForecastWidget } from '@/components/dashboard/DiskForecastWidget';
import { ShopWidget } from '@/components/dashboard/ShopWidget';
import { ProxmoxFleetPanel } from '@/components/fleet/ProxmoxFleetPanel';
import { MemoryTrendWidget } from '@/components/dashboard/MemoryTrendWidget';
import { FleetActions } from '@/components/fleet/FleetActions';
import { useFleetWebSocket } from '@/hooks/useFleetWebSocket';
import { useServerStore } from '@/stores/serverStore';
import { istErreichbar } from '@/lib/formatters';
import { PageTransition } from '@/components/ui/PageTransition';

const UEBERSCHRIFT = 'section-title';

export default function FleetOverviewPage() {
  useFleetWebSocket();
  const router = useRouter();
  const { servers } = useServerStore();
  const offline = servers.filter(s => !istErreichbar(s.status)).length;
  const alleOk = servers.length > 0 && offline === 0;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Kopf: das Wetter wohnt jetzt in der Kopfleiste — hier gehört die Bühne der Flotte. */}
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 -left-10 w-72 h-40 rounded-full blur-3xl opacity-60"
            style={{ background: 'radial-gradient(closest-side, rgba(var(--accent-rgb),0.28), transparent)' }}
          />
          <div className="relative">
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-3xl font-bold tracking-tight"
            >
              Fleet <span className="text-gradient">Übersicht</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-sm text-white/55 mt-1"
            >
              Alle Server auf einen Blick
            </motion.p>
          </div>
          {servers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className={`live-pill relative ${alleOk ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-amber-500/10 border-amber-500/25 text-amber-300'}`}
            >
              <span className={`w-2 h-2 rounded-full ${alleOk ? 'bg-emerald-400 status-pulse-healthy' : 'bg-amber-400'}`} />
              {alleOk ? 'Alle Systeme laufen' : `${offline} von ${servers.length} Servern nicht erreichbar`}
            </motion.div>
          )}
        </div>

        {/* „Läuft alles?" — schmale grüne Zeile, oder gebündelt, was nicht stimmt. */}
        <AttentionCenter />

        {/* Tagesblock: was HEUTE ansteht. */}
        <TodayWidget />

        {/* Summary Stats Bar */}
        <FleetSummaryBar />

        {/* Server */}
        <div>
          {/* Mobil: Überschrift in eigener Zeile, Aktionen darunter — nebeneinander franst es auf 390 px aus. */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className={`${UEBERSCHRIFT} flex-shrink-0`}>Server</h2>
            <div className="flex items-center gap-1 flex-wrap justify-start sm:justify-end">
              <FleetActions />
              <button
                onClick={() => router.push('/settings')}
                className="flex items-center gap-1 text-[12px] text-white/55 hover:text-white/85 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04]"
              >
                <Plus className="w-3 h-3" /> Server hinzufügen
              </button>
            </div>
          </div>
          <FleetTopology />
        </div>

        {/* Proxmox: Host und Gäste mit Schnellaktionen */}
        <ProxmoxFleetPanel />

        {/* Business — Neue Anfragen (SaleNet + Portfolio) und der Etsy-Shop */}
        <div>
          <h2 className={`${UEBERSCHRIFT} mb-3`}>Business</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 [&>*]:h-full">
            <div className="lg:col-span-2">
              <RequestsWidget />
            </div>
            <ShopWidget />
          </div>
        </div>

        {/* Betrieb — Änderungen, veraltete Images, Platten-Prognose, RAM-Trend.
            Alle melden sich sonst nicht von selbst: ein abgeräumter Dienst,
            ein seit Monaten nicht aktualisiertes Image, eine volllaufende
            Platte und ein schleichendes Speicherleck fallen erst auf, wenn es weh tut. */}
        <div>
          <h2 className={`${UEBERSCHRIFT} mb-3`}>Betrieb</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 [&>*]:h-full">
            <ChangesWidget />
            <ImageUpdatesWidget />
            <DiskForecastWidget />
            <MemoryTrendWidget />
          </div>
        </div>

        {/* Bento Grid Widgets */}
        <div>
          <h2 className={`${UEBERSCHRIFT} mb-3`}>Dashboard</h2>
          <FleetBentoGrid />
        </div>
      </div>
    </PageTransition>
  );
}
