/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { Bell } from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActivePanel } from '@/components/alerts/ActivePanel';
import { MaintenancePanel } from '@/components/alerts/MaintenancePanel';
import { OverridesPanel } from '@/components/alerts/OverridesPanel';
import { PushPanel } from '@/components/alerts/PushPanel';
import { HistoryPanel } from '@/components/alerts/HistoryPanel';

export default function AlertsPage() {
  return (
    <PageTransition>
      <PageHeader
        title="Alarme"
        subtitle="Aktuelles, Wartungsfenster, Schwellen je Server und Push aufs Handy"
        icon={<Bell className="w-5 h-5" />}
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <ActivePanel />
          <MaintenancePanel />
          <PushPanel />
        </div>
        <div className="space-y-4">
          <OverridesPanel />
          <HistoryPanel />
        </div>
      </div>
    </PageTransition>
  );
}
