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
import { RequestsWidget } from '@/components/dashboard/RequestsWidget';
import { TodayWidget } from '@/components/dashboard/TodayWidget';
import { ChangesWidget } from '@/components/dashboard/ChangesWidget';
import { ImageUpdatesWidget } from '@/components/dashboard/ImageUpdatesWidget';
import { DiskForecastWidget } from '@/components/dashboard/DiskForecastWidget';
import { ShopWidget } from '@/components/dashboard/ShopWidget';
import { WeatherWidget, type WeatherLocation } from '@/components/dashboard/WeatherWidget';
import { FleetActions } from '@/components/fleet/FleetActions';
import { useFleetWebSocket } from '@/hooks/useFleetWebSocket';
import { PageTransition } from '@/components/ui/PageTransition';

const WEATHER_LOCATIONS: WeatherLocation[] = [
  { latitude: 50.7539, longitude: 8.4869, city: 'Hartenrod' },
  { latitude: 51.3267, longitude: 6.9694, city: 'Heiligenhaus' },
];

export default function FleetOverviewPage() {
  useFleetWebSocket();
  const router = useRouter();

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-2xl font-bold"
            >
              Fleet <span className="text-gradient">Overview</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-sm text-white/40 mt-1"
            >
              Alle Server auf einen Blick
            </motion.p>
          </div>
          {/* Wetter (Desktop): zwei Standorte nebeneinander */}
          <div className="hidden md:grid grid-cols-2 gap-3 w-[500px] lg:w-[560px] shrink-0 [&>*]:h-full">
            {WEATHER_LOCATIONS.map(loc => <WeatherWidget key={loc.city} location={loc} />)}
          </div>
        </div>

        {/* Wetter (Mobil): eigene Zeile */}
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 md:hidden [&>*]:h-full">
          {WEATHER_LOCATIONS.map(loc => <WeatherWidget key={loc.city} location={loc} />)}
        </div>

        {/* Tagesblock: was HEUTE ansteht. Steht bewusst über der Flotte —
            die meldet sich von selbst, wenn etwas nicht läuft. */}
        <TodayWidget />

        {/* Summary Stats Bar */}
        <FleetSummaryBar />

        {/* Server Topology / Grid */}
        <div>
          {/* Mobil: Überschrift in eigener Zeile, Aktionen darunter als gleich
              breite Schaltflächen — nebeneinander franst es auf 390 px aus. */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-xs uppercase tracking-widest text-white/25 font-medium flex-shrink-0">Server</h2>
            <div className="flex items-center gap-1 flex-wrap justify-start sm:justify-end">
              <FleetActions />
              <button
                onClick={() => router.push('/settings')}
                className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/70 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04]"
              >
                <Plus className="w-3 h-3" /> Server hinzufügen
              </button>
            </div>
          </div>
          <FleetTopology />
        </div>

        {/* Business — Neue Anfragen (SaleNet + Portfolio) und der Etsy-Shop */}
        <div>
          <h2 className="text-xs uppercase tracking-widest text-white/25 font-medium mb-3">Business</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 [&>*]:h-full">
            <div className="lg:col-span-2">
              <RequestsWidget />
            </div>
            <ShopWidget />
          </div>
        </div>

        {/* Betrieb — Änderungen, veraltete Images, Platten-Prognose.
            Alle drei melden sich sonst nicht von selbst: ein abgeräumter Dienst,
            ein seit Monaten nicht aktualisiertes Image und eine volllaufende
            Platte fallen erst auf, wenn es weh tut. */}
        <div>
          <h2 className="text-xs uppercase tracking-widest text-white/25 font-medium mb-3">Betrieb</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 [&>*]:h-full">
            <ChangesWidget />
            <ImageUpdatesWidget />
            <DiskForecastWidget />
          </div>
        </div>

        {/* Bento Grid Widgets */}
        <div>
          <h2 className="text-xs uppercase tracking-widest text-white/25 font-medium mb-3">Dashboard</h2>
          <FleetBentoGrid />
        </div>
      </div>
    </PageTransition>
  );
}
