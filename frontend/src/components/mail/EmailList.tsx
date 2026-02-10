'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Star, ChevronLeft, ChevronRight, Trash2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { jmapCall } from '@/lib/api';
import { useMailStore } from '@/stores/mailStore';
import type { MailEmail, MailFolder } from '@/lib/types';

interface EmailListProps {
  folders: MailFolder[];
}

export function EmailList({ folders }: EmailListProps) {
  const { email, accountId, activeFolderId, setSelectedEmailId, searchQuery, searchActive } = useMailStore();
  const [position, setPosition] = useState(0);
  const queryClient = useQueryClient();
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['mail-emails', accountId, activeFolderId, position, searchActive ? searchQuery : ''],
    queryFn: async () => {
      if (!email || !accountId) return null;

      const filter = searchActive && searchQuery
        ? { text: searchQuery }
        : { inMailbox: activeFolderId };

      const result = await jmapCall(email, [
        ['Email/query', {
          accountId,
          filter,
          sort: [{ property: 'receivedAt', isAscending: false }],
          position,
          limit,
        }, 'q'],
        ['Email/get', {
          accountId,
          '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
          properties: ['id', 'threadId', 'mailboxIds', 'from', 'to', 'subject', 'receivedAt', 'preview', 'keywords', 'hasAttachment', 'size'],
        }, 'g'],
      ]);

      const queryResult = (result.methodResponses?.[0]?.[1] || {}) as { total?: number; position?: number };
      const getResult = (result.methodResponses?.[1]?.[1] || {}) as { list?: MailEmail[] };
      return {
        emails: getResult.list || [],
        total: queryResult.total || 0,
        position: queryResult.position || 0,
      };
    },
    enabled: !!email && !!accountId && (!!activeFolderId || searchActive),
    refetchInterval: 30000,
  });

  // Mark as read
  const markReadMutation = useMutation({
    mutationFn: async (emailId: string) => {
      if (!email || !accountId) return;
      await jmapCall(email, [
        ['Email/set', {
          accountId,
          update: { [emailId]: { 'keywords/$seen': true } },
        }, '0'],
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-emails'] });
      queryClient.invalidateQueries({ queryKey: ['mail-folders'] });
    },
  });

  // Toggle flag
  const toggleFlagMutation = useMutation({
    mutationFn: async ({ emailId, flagged }: { emailId: string; flagged: boolean }) => {
      if (!email || !accountId) return;
      await jmapCall(email, [
        ['Email/set', {
          accountId,
          update: { [emailId]: { 'keywords/$flagged': flagged ? null : true } },
        }, '0'],
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-emails'] });
    },
  });

  // Delete (move to trash)
  const deleteMutation = useMutation({
    mutationFn: async (emailId: string) => {
      if (!email || !accountId) return;
      const trashFolder = folders.find(f => f.role === 'trash');
      if (!trashFolder) return;
      const currentMailboxIds: Record<string, boolean | null> = {};
      const emailObj = data?.emails.find(e => e.id === emailId);
      if (emailObj) {
        for (const mbId of Object.keys(emailObj.mailboxIds)) {
          currentMailboxIds[mbId] = null;
        }
      }
      currentMailboxIds[trashFolder.id] = true;
      await jmapCall(email, [
        ['Email/set', {
          accountId,
          update: { [emailId]: { mailboxIds: currentMailboxIds } },
        }, '0'],
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-emails'] });
      queryClient.invalidateQueries({ queryKey: ['mail-folders'] });
    },
  });

  const handleClick = (emailItem: MailEmail) => {
    setSelectedEmailId(emailItem.id);
    if (!emailItem.keywords?.['$seen']) {
      markReadMutation.mutate(emailItem.id);
    }
  };

  const emails = data?.emails || [];
  const total = data?.total || 0;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['mail-emails'] });
    queryClient.invalidateQueries({ queryKey: ['mail-folders'] });
  };

  if (isLoading) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="animate-pulse text-white/30 text-sm">Lade E-Mails...</div>
      </div>
    );
  }

  if (!activeFolderId && !searchActive) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-white/30 text-sm">Ordner auswählen</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-white/30 text-sm">
          {searchActive ? 'Keine Ergebnisse' : 'Keine E-Mails in diesem Ordner'}
        </p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  const formatSender = (from: MailEmail['from']) => {
    if (!from || from.length === 0) return 'Unbekannt';
    return from[0].name || from[0].email;
  };

  return (
    <div>
      {/* Header mit Refresh-Button */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-white/40">
          {total} {total === 1 ? 'E-Mail' : 'E-Mails'}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="btn-glass p-1.5 text-white/60 hover:text-white disabled:opacity-30 transition-all group"
          title="Aktualisieren"
        >
          <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      <div className="glass-card divide-y divide-white/[0.06] overflow-hidden">
        {emails.map((item) => {
          const isRead = !!item.keywords?.['$seen'];
          const isFlagged = !!item.keywords?.['$flagged'];

          return (
            <div
              key={item.id}
              onClick={() => handleClick(item)}
              className={clsx(
                'flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-white/[0.04]',
                !isRead && 'bg-white/[0.02]'
              )}
            >
              {/* Unread indicator */}
              <div className="w-2 shrink-0">
                {!isRead && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={clsx('text-sm truncate', !isRead ? 'font-semibold' : 'text-white/70')}>
                    {formatSender(item.from)}
                  </span>
                  <span className="text-[10px] text-white/30 shrink-0">{formatDate(item.receivedAt)}</span>
                </div>
                <p className={clsx('text-sm truncate', !isRead ? 'text-white/90' : 'text-white/60')}>
                  {item.subject || '(Kein Betreff)'}
                </p>
                <p className="text-xs text-white/30 truncate mt-0.5">{item.preview}</p>
              </div>

              {/* Icons */}
              <div className="flex items-center gap-1 shrink-0">
                {item.hasAttachment && <Paperclip className="w-3.5 h-3.5 text-white/30" />}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFlagMutation.mutate({ emailId: item.id, flagged: isFlagged }); }}
                  className="p-1 rounded hover:bg-white/10"
                >
                  <Star className={clsx('w-3.5 h-3.5', isFlagged ? 'text-yellow-400 fill-yellow-400' : 'text-white/20')} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(item.id); }}
                  className="p-1 rounded hover:bg-white/10 text-white/20 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between mt-3 text-xs text-white/40">
          <span>{position + 1}–{Math.min(position + limit, total)} von {total}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPosition(Math.max(0, position - limit))}
              disabled={position === 0}
              className="btn-glass p-1.5 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPosition(position + limit)}
              disabled={position + limit >= total}
              className="btn-glass p-1.5 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
