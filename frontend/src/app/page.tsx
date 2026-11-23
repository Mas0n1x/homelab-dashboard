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
import { PageTransition } from '@/components/ui/PageTransition';

const UEBERSCHRIFT = 'text-xs uppercase tracking-widest text-white/50 font-medium';

export default function FleetOverviewPage() {
  useFleetWebSocket();
  const router = useRouter();

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Kopf: das Wetter wohnt jetzt in der Kopfleiste — hier gehört die Bühne der Flotte. */}
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-2xl font-bold"
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
