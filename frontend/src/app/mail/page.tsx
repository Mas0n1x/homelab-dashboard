'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useMailStore } from '@/stores/mailStore';
import { getUserMailAccounts, jmapCall } from '@/lib/api';
import { Tabs } from '@/components/ui/Tabs';
import { MailSetup } from '@/components/mail/MailSetup';
import { AccountSwitcher } from '@/components/mail/AccountSwitcher';
import { FolderSidebar } from '@/components/mail/FolderSidebar';
import { EmailList } from '@/components/mail/EmailList';
import { EmailReader } from '@/components/mail/EmailReader';
import { ComposeModal } from '@/components/mail/ComposeModal';
import { MailSearch } from '@/components/mail/MailSearch';
import { MailAdmin } from '@/components/mail/MailAdmin';
import type { MailFolder } from '@/lib/types';
import type { MailAccount } from '@/lib/api';

const TABS = [
  { id: 'posteingang', label: 'Posteingang' },
  { id: 'verwaltung', label: 'Verwaltung' },
];

export default function MailPage() {
  const {
    email, accountId,
    setAccounts, activeTab, setActiveTab,
    activeFolderId, setActiveFolderId, selectedEmailId,
  } = useMailStore();
  const queryClient = useQueryClient();
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);

  // Load user's mail accounts
  const { data: accounts = [] } = useQuery<MailAccount[]>({
    queryKey: ['mail-accounts'],
    queryFn: getUserMailAccounts,
  });

  useEffect(() => {
    if (accounts.length > 0) {
      setAccounts(accounts);
    }
  }, [accounts, setAccounts]);

  // Fetch folders
  const { data: foldersResponse } = useQuery({
    queryKey: ['mail-folders', accountId],
    queryFn: async () => {
      if (!email || !accountId) return null;
      return jmapCall(email, [
        ['Mailbox/get', { accountId, ids: null }, '0'],
      ]);
    },
    enabled: !!email && !!accountId,
    refetchInterval: 30000,
  });

  const folders: MailFolder[] = (foldersResponse?.methodResponses?.[0]?.[1] as { list?: MailFolder[] })?.list || [];

  // Auto-select inbox on first load
  useEffect(() => {
    if (folders.length > 0 && !activeFolderId) {
      const inbox = folders.find(f => f.role === 'inbox');
      if (inbox) setActiveFolderId(inbox.id);
    }
  }, [folders, activeFolderId, setActiveFolderId]);

  // Show setup if no accounts
  if (accounts.length === 0) {
    return <MailSetup />;
  }

  const totalUnread = folders.reduce((sum, f) => sum + (f.unreadEmails || 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Mail</h1>
          <AccountSwitcher onAddAccount={() => setShowAddAccountModal(true)} />
        </div>

        <div className="mb-6">
          <Tabs
            tabs={TABS.map(t => t.id === 'posteingang' && totalUnread > 0 ? { ...t, count: totalUnread } : t)}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {activeTab === 'posteingang' && (
          <>
            <MailSearch />
            {/* Mobile folder sidebar - shown above email list */}
            <div className="md:hidden mt-4 overflow-x-auto">
              <FolderSidebar folders={folders} />
            </div>
            <div className="flex gap-4 items-start mt-4">
              <div className="w-56 shrink-0 hidden md:block">
                <FolderSidebar folders={folders} />
              </div>
              <div className="flex-1 min-w-0">
                {selectedEmailId ? (
                  <EmailReader folders={folders} />
                ) : (
                  <EmailList folders={folders} />
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'verwaltung' && <MailAdmin />}
      </motion.div>

      <ComposeModal />
      {showAddAccountModal && (
        <MailSetup isModal onClose={() => setShowAddAccountModal(false)} />
      )}
    </div>
  );
}
