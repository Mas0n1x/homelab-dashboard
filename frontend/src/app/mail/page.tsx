/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail as MailIcon } from 'lucide-react';
import { useMailStore } from '@/stores/mailStore';
import { PageTransition } from '@/components/ui/PageTransition';
import * as api from '@/lib/api';
import { Tabs } from '@/components/ui/Tabs';
import { MailSetup } from '@/components/mail/MailSetup';
import { MailboxSidebar } from '@/components/mail/MailboxSidebar';
import { UnifiedInbox } from '@/components/mail/UnifiedInbox';
import { EmailList } from '@/components/mail/EmailList';
import { EmailReader } from '@/components/mail/EmailReader';
import { ComposeModal } from '@/components/mail/ComposeModal';
import { MailSearch } from '@/components/mail/MailSearch';
import { MailAdmin } from '@/components/mail/MailAdmin';
import type { MailFolder, MailOverview } from '@/lib/types';

const TABS = [
  { id: 'posteingang', label: 'Posteingang' },
  { id: 'verwaltung', label: 'Verwaltung' },
];

export default function MailPage() {
  const {
    accounts, activeAccountEmail, viewMode, selectedEmailId,
    setAccounts, activeTab, setActiveTab, selectFolder, searchActive,
  } = useMailStore();
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);

  // EIN Aufruf liefert alle Konten samt Ordnern und Ungelesen-Zählern.
  // Vorher lud die Seite die Kontoliste und danach die Ordner nur des einen
  // „aktiven" Kontos — der Rest war unsichtbar.
  const { data: overview, isLoading } = useQuery<MailOverview>({
    queryKey: ['mail-overview'],
    queryFn: api.getMailOverview,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Store mit der Kontoliste versorgen (Compose und Reader lesen daraus).
  useEffect(() => {
    if (!overview?.accounts?.length) return;
    setAccounts(overview.accounts.map((a, i) => ({
      id: a.id,
      email: a.email,
      accountId: a.accountId,
      displayName: a.displayName,
      sortOrder: a.sortOrder,
      isActive: i === 0,
    })));
  }, [overview, setAccounts]);

  // Ordner des gerade gewählten Kontos — die Unterkomponenten erwarten die
  // JMAP-Form, die Übersicht liefert eine schlankere.
  const folders: MailFolder[] = useMemo(() => {
    const acc = overview?.accounts.find(a => a.email === activeAccountEmail);
    return (acc?.folders ?? []).map(f => ({
      id: f.id,
      name: f.name,
      role: f.role,
      parentId: null,
      totalEmails: f.total,
      unreadEmails: f.unread,
      sortOrder: 0,
    }));
  }, [overview, activeAccountEmail]);

  // Die Suche greift immer auf ein konkretes Postfach zu — ohne gewähltes
  // Konto liefe sie ins Leere.
  useEffect(() => {
    if (!searchActive || activeAccountEmail || !overview?.accounts?.length) return;
    const erstes = overview.accounts[0];
    const inbox = erstes.folders.find(f => f.role === 'inbox');
    if (inbox) selectFolder(erstes.email, inbox.id);
  }, [searchActive, activeAccountEmail, overview, selectFolder]);

  if (!isLoading && (overview?.accounts.length ?? 0) === 0 && accounts.length === 0) {
    return <MailSetup />;
  }

  const totalUnread = overview?.totalUnread ?? 0;
  const einzelAnsicht = viewMode === 'folder' || searchActive;

  return (
    <div className="max-w-7xl mx-auto">
      <PageTransition>
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center flex-shrink-0">
              <MailIcon className="w-4.5 h-4.5 text-accent-light" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold leading-none">Mail</h1>
              <p className="text-xs text-white/40 mt-1 truncate">
                {overview?.accounts.length ?? 0} Postfächer
                {totalUnread > 0 && ` · ${totalUnread} ungelesen`}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-5">
          <Tabs
            tabs={TABS.map(t => (t.id === 'posteingang' && totalUnread > 0 ? { ...t, count: totalUnread } : t))}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {activeTab === 'posteingang' && (
          <>
            <MailSearch />

            {/* Schmale Bildschirme: Konten und Ordner als Chip-Leisten */}
            <div className="md:hidden mt-4">
              <MailboxSidebar overview={overview} onAddAccount={() => setShowAddAccountModal(true)} layout="bar" />
            </div>

            <div className="flex gap-4 items-start mt-4">
              <div className="w-64 shrink-0 hidden md:block">
                <MailboxSidebar overview={overview} onAddAccount={() => setShowAddAccountModal(true)} />
              </div>
              <div className="flex-1 min-w-0">
                {selectedEmailId ? (
                  <EmailReader folders={folders} />
                ) : einzelAnsicht ? (
                  <EmailList folders={folders} />
                ) : (
                  <UnifiedInbox overview={overview} />
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'verwaltung' && <MailAdmin />}
      </PageTransition>

      <ComposeModal />
      {showAddAccountModal && <MailSetup isModal onClose={() => setShowAddAccountModal(false)} />}
    </div>
  );
}
