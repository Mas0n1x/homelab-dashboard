/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip, RefreshCw, Inbox } from 'lucide-react';
import { clsx } from 'clsx';
import * as api from '@/lib/api';
import { useMailStore } from '@/stores/mailStore';
import { accountColor } from './MailboxSidebar';
import type { MailOverview, UnifiedEmail } from '@/lib/types';

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  const imJahr = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('de-DE', imJahr
    ? { day: '2-digit', month: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatSender(from: UnifiedEmail['from']) {
  if (!from || from.length === 0) return 'Unbekannt';
  return from[0].name || from[0].email;
}

/**
 * Posteingänge aller Konten in einer Liste. Jede Zeile trägt die Farbmarke
 * ihres Postfachs — ohne die wüsste man beim Antworten nicht, von welcher
 * Adresse die Mail eigentlich kam.
 */
export function UnifiedInbox({ overview }: { overview: MailOverview | undefined }) {
  const { openEmail } = useMailStore();
  const queryClient = useQueryClient();
  const accounts = overview?.accounts ?? [];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['mail-unified'],
    queryFn: () => api.getUnifiedInbox(50),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const markRead = useMutation({
    mutationFn: async (mail: UnifiedEmail) => {
      await api.jmapCall(mail.accountEmail, [
        ['Email/set', {
          accountId: mail.accountId,
          update: { [mail.id]: { 'keywords/$seen': true } },
        }, '0'],
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-unified'] });
      queryClient.invalidateQueries({ queryKey: ['mail-overview'] });
      queryClient.invalidateQueries({ queryKey: ['mail-unread'] });
    },
  });

  const handleClick = (mail: UnifiedEmail) => {
    openEmail(mail.id, mail.accountEmail);
    if (!mail.keywords?.['$seen']) markRead.mutate(mail);
  };

  const emails = data?.emails ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[68px] rounded-xl bg-white/[0.02] border border-white/[0.05] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Inbox className="w-3.5 h-3.5" />
          {emails.length} {emails.length === 1 ? 'E-Mail' : 'E-Mails'} aus {accounts.length}{' '}
          {accounts.length === 1 ? 'Postfach' : 'Postfächern'}
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['mail-unified'] });
            queryClient.invalidateQueries({ queryKey: ['mail-overview'] });
          }}
          className="btn-glass p-1.5 text-white/60 hover:text-white transition-all"
          title="Aktualisieren"
        >
          <RefreshCw className={clsx('w-4 h-4', isFetching && 'animate-spin')} />
        </button>
      </div>

      {emails.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Inbox className="w-8 h-8 text-white/15 mx-auto mb-3" />
          <p className="text-white/35 text-sm">Alle Postfächer sind leer.</p>
        </div>
      ) : (
        <div className="glass-card divide-y divide-white/[0.06] overflow-hidden">
          {emails.map(mail => {
            const isRead = !!mail.keywords?.['$seen'];
            const farbe = accountColor(accounts, mail.accountEmail);

            return (
              <div
                key={`${mail.accountEmail}-${mail.id}`}
                onClick={() => handleClick(mail)}
                className={clsx(
                  'flex items-center gap-3 px-3 sm:px-4 py-3 cursor-pointer transition-all hover:bg-white/[0.04]',
                  !isRead && 'bg-white/[0.02]',
                )}
              >
                {/* Kontofarbe als senkrechter Strich — verrät das Postfach,
                    ohne eine eigene Spalte zu kosten. */}
                <span className={clsx('w-1 self-stretch rounded-full flex-shrink-0', farbe.dot, isRead && 'opacity-40')} />

                <div className="w-2 shrink-0">
                  {!isRead && <div className="w-2 h-2 rounded-full bg-accent-light" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={clsx('text-sm truncate', !isRead ? 'font-semibold' : 'text-white/70')}>
                      {formatSender(mail.from)}
                    </span>
                    <span className="text-[10px] text-white/30 shrink-0 ml-auto tabular-nums">
                      {formatDate(mail.receivedAt)}
                    </span>
                  </div>
                  <p className={clsx('text-sm truncate', !isRead ? 'text-white/90' : 'text-white/60')}>
                    {mail.subject || '(Kein Betreff)'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={clsx('text-[10px] font-medium flex-shrink-0', farbe.text)}>
                      {mail.accountDisplayName}
                    </span>
                    <p className="text-xs text-white/30 truncate">{mail.preview}</p>
                  </div>
                </div>

                {mail.hasAttachment && <Paperclip className="w-3.5 h-3.5 text-white/30 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
