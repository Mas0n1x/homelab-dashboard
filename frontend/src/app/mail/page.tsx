'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useMailStore } from '@/stores/mailStore';
import { getMailCredentials, jmapCall } from '@/lib/api';
import { Tabs } from '@/components/ui/Tabs';
import { MailSetup } from '@/components/mail/MailSetup';
import { FolderSidebar } from '@/components/mail/FolderSidebar';
import { EmailList } from '@/components/mail/EmailList';
import { EmailReader } from '@/components/mail/EmailReader';
import { ComposeModal } from '@/components/mail/ComposeModal';
import { MailSearch } from '@/components/mail/MailSearch';
import { MailAdmin } from '@/components/mail/MailAdmin';
import type { MailFolder, MailCredentials } from '@/lib/types';
import { LogOut } from 'lucide-react';
import { deleteMailCredentials } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

const TABS = [
  { id: 'posteingang', label: 'Posteingang' },
  { id: 'verwaltung', label: 'Verwaltung' },
];

export default function MailPage() {
  const {
    email, password, accountId,
    setCredentials, activeTab, setActiveTab,
    activeFolderId, setActiveFolderId, selectedEmailId,
  } = useMailStore();
  const queryClient = useQueryClient();

  // Load saved credentials from backend
  const { data: savedCreds } = useQuery<MailCredentials>({
    queryKey: ['mail-credentials'],
    queryFn: getMailCredentials,
  });

  useEffect(() => {
    if (savedCreds?.email && savedCreds?.password && !email) {
      setCredentials(savedCreds.email, savedCreds.password, savedCreds.accountId);
    }
  }, [savedCreds, email, setCredentials]);

  // Fetch JMAP session to get accountId (if credentials exist but no accountId)
  const { data: session } = useQuery({
    queryKey: ['mail-session', email],
    queryFn: async () => {
      if (!email || !password) return null;
      const { getMailSession } = await import('@/lib/api');
      return getMailSession(email, password);
    },
    enabled: !!email && !!password && !accountId,
    retry: 1,
  });

  useEffect(() => {
    if (session?.primaryAccounts) {
      const mailAccountId = session.primaryAccounts['urn:ietf:params:jmap:mail'];
      if (mailAccountId) {
        setCredentials(email, password, mailAccountId);
      }
    }
  }, [session, email, password, setCredentials]);

  // Fetch folders
  const { data: foldersResponse } = useQuery({
    queryKey: ['mail-folders', accountId],
    queryFn: async () => {
      if (!email || !password || !accountId) return null;
      return jmapCall(email, password, [
        ['Mailbox/get', { accountId, ids: null }, '0'],
      ]);
    },
    enabled: !!email && !!password && !!accountId,
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

  // Show setup if no credentials
  if (!email || !password) {
    return <MailSetup />;
  }

  const totalUnread = folders.reduce((sum, f) => sum + (f.unreadEmails || 0), 0);

  const handleLogout = async () => {
    await deleteMailCredentials();
    setCredentials(null, null, null);
    queryClient.invalidateQueries({ queryKey: ['mail-credentials'] });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Mail</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">{email}</span>
            <button onClick={handleLogout} className="btn-glass p-1.5" title="Abmelden">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
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
            {/* Mobile folder sidebar */}
            <div className="md:hidden mt-4">
              <FolderSidebar folders={folders} />
            </div>
          </>
        )}

        {activeTab === 'verwaltung' && <MailAdmin />}
      </motion.div>

      <ComposeModal />
    </div>
  );
}
