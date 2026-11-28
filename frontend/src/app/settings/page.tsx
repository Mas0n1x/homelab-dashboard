/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { Bell, Settings, Shield, AlertTriangle, Archive, Server, ChevronRight, Boxes, Palette, PlugZap } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';
import { GlassCard } from '@/components/ui/GlassCard';
import { EtsyConnection } from '@/components/settings/EtsyConnection';
import { useAuthStore } from '@/stores/authStore';
import { FleetTab } from '@/components/settings/FleetTab';
import { HostKeysCard } from '@/components/settings/HostKeysCard';
import { ServicesTab } from '@/components/settings/ServicesTab';
import { AppearanceTab } from '@/components/settings/AppearanceTab';
import { AlertsTab } from '@/components/settings/AlertsTab';
import { BackupTab } from '@/components/settings/BackupTab';
import { BackupCenterCard } from '@/components/settings/BackupCenterCard';
import { AuditLogCard } from '@/components/settings/AuditLogCard';
import { AccountTab } from '@/components/settings/AccountTab';

const SETTINGS_TABS = [
  { id: 'fleet', label: 'Fleet', desc: 'Server & Verbindungen', icon: Server },
  { id: 'services', label: 'Dienste', desc: 'Überwachte Services', icon: Boxes },
  { id: 'appearance', label: 'Darstellung', desc: 'Aussehen & Effekte', icon: Palette },
  { id: 'alerts', label: 'Alerts', desc: 'Benachrichtigungen', icon: Bell },
  { id: 'backup', label: 'Backup', desc: 'Sicherung & Wiederherstellung', icon: Archive },
  { id: 'anbindungen', label: 'Anbindungen', desc: 'Externe Dienste', icon: PlugZap },
  { id: 'account', label: 'Account', desc: 'Sicherheit & Zugang', icon: Shield },
] as const;

type SettingsTab = typeof SETTINGS_TABS[number]['id'];

export default function SettingsPage() {
  const { setupCompleted } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('fleet');

  const activeMeta = SETTINGS_TABS.find(t => t.id === activeTab)!;

  return (
    <PageTransition>
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5 text-white/65" />
          Einstellungen
        </h1>
        <p className="text-sm text-white/55 mt-0.5">Fleet, Alerts, Backups & Account</p>
      </div>

      {/* Default Password Warning */}
      {!setupCompleted && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Standard-Passwort aktiv</p>
            <p className="text-xs text-amber-400/60 mt-0.5">Bitte ändere das Standard-Passwort (admin/admin) bevor du das Dashboard öffentlich erreichbar machst.</p>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Navigations-Leiste */}
        {/* Mobil als Raster: in der Scroll-Leiste waren nur drei der sechs
            Bereiche sichtbar und der Rest praktisch unauffindbar. */}
        <nav className="lg:w-60 flex-shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-1.5">
          {SETTINGS_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all whitespace-nowrap lg:whitespace-normal border',
                  isActive
                    ? 'bg-accent/[0.12] border-accent/25 text-white'
                    : 'border-transparent text-white/60 hover:text-white/80 hover:bg-white/[0.03]'
                )}
              >
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors', isActive ? 'bg-accent/20 text-accent-light' : 'bg-white/[0.04] text-white/55 group-hover:text-white/70')}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 hidden lg:block">
                  <p className="text-sm font-medium leading-tight">{tab.label}</p>
                  <p className="text-[12px] text-white/50 mt-0.5 truncate">{tab.desc}</p>
                </div>
                <span className="text-sm font-medium lg:hidden">{tab.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 text-accent-light/60 ml-auto hidden lg:block" />}
              </button>
            );
          })}
        </nav>

        {/* Inhalt */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="lg:hidden lg:[&+*]:!mt-0">
            <h2 className="text-base font-semibold">{activeMeta.label}</h2>
            <p className="text-xs text-white/50">{activeMeta.desc}</p>
          </div>

          {activeTab === 'fleet' && (
            <>
              <FleetTab />
              <HostKeysCard />
            </>
          )}
          {activeTab === 'services' && <ServicesTab />}
          {activeTab === 'appearance' && <AppearanceTab />}
          {activeTab === 'alerts' && <AlertsTab />}
          {activeTab === 'backup' && (
            <>
              <BackupCenterCard />
              <BackupTab />
              <AuditLogCard />
            </>
          )}
          {activeTab === 'anbindungen' && (
            <GlassCard>
              <EtsyConnection />
            </GlassCard>
          )}
          {activeTab === 'account' && <AccountTab />}
        </div>
      </div>
    </div>
    </PageTransition>
  );
}
