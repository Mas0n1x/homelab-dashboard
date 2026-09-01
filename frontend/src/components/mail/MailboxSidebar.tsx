/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';
import {
  Inbox, Send, FileEdit, Trash2, ShieldAlert, Folder, PenLine,
  ChevronDown, Layers, Plus, AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useMailStore } from '@/stores/mailStore';
import type { MailOverview, MailOverviewAccount, MailOverviewFolder } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';

const ROLE_CONFIG: Record<string, { label: string; icon: LucideIcon; order: number }> = {
  inbox: { label: 'Posteingang', icon: Inbox, order: 0 },
  sent: { label: 'Gesendet', icon: Send, order: 1 },
  drafts: { label: 'Entwürfe', icon: FileEdit, order: 2 },
  trash: { label: 'Papierkorb', icon: Trash2, order: 3 },
  junk: { label: 'Spam', icon: ShieldAlert, order: 4 },
};

/** Farbmarke je Konto — im Sammel-Eingang die schnellste Zuordnung. */
export const ACCOUNT_COLORS = [
  { dot: 'bg-cyan-400', text: 'text-cyan-300', soft: 'bg-cyan-500/12 border-cyan-400/25' },
  { dot: 'bg-violet-400', text: 'text-violet-300', soft: 'bg-violet-500/12 border-violet-400/25' },
  { dot: 'bg-amber-400', text: 'text-amber-300', soft: 'bg-amber-500/12 border-amber-400/25' },
  { dot: 'bg-emerald-400', text: 'text-emerald-300', soft: 'bg-emerald-500/12 border-emerald-400/25' },
  { dot: 'bg-rose-400', text: 'text-rose-300', soft: 'bg-rose-500/12 border-rose-400/25' },
  { dot: 'bg-sky-400', text: 'text-sky-300', soft: 'bg-sky-500/12 border-sky-400/25' },
];

export function accountColor(accounts: { email: string }[], email: string) {
  const idx = accounts.findIndex(a => a.email === email);
  return ACCOUNT_COLORS[(idx < 0 ? 0 : idx) % ACCOUNT_COLORS.length];
}

function sortFolders(folders: MailOverviewFolder[]) {
  return [...folders].sort((a, b) => {
    const oa = a.role ? (ROLE_CONFIG[a.role]?.order ?? 10) : 20;
    const ob = b.role ? (ROLE_CONFIG[b.role]?.order ?? 10) : 20;
    return oa !== ob ? oa - ob : a.name.localeCompare(b.name, 'de');
  });
}

function Zaehler({ value, active }: { value: number; active: boolean }) {
  if (!value) return null;
  return (
    <span className={clsx(
      'ml-auto flex-shrink-0 min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-semibold',
      'flex items-center justify-center tabular-nums',
      active ? 'bg-accent/25 text-accent-light' : 'bg-white/[0.08] text-white/55',
    )}>
      {value > 999 ? '999+' : value}
    </span>
  );
}

interface Props {
  overview: MailOverview | undefined;
  onAddAccount: () => void;
  /** `bar` = waagerechte Leiste für schmale Bildschirme. */
  layout?: 'sidebar' | 'bar';
}

export function MailboxSidebar({ overview, onAddAccount, layout = 'sidebar' }: Props) {
  const {
    viewMode, activeFolderId, activeAccountEmail,
    showUnified, selectFolder, setComposeOpen, setComposeMode, setReplyToEmail,
  } = useMailStore();

  const accounts = overview?.accounts ?? [];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Beim ersten Laden das Konto aufklappen, in dem gerade etwas liegt — sonst
  // steht man vor lauter zugeklappten Postfächern.
  useEffect(() => {
    if (accounts.length === 0) return;
    setExpanded(prev => {
      if (Object.keys(prev).length > 0) return prev;
      const mitUngelesen = accounts.filter(a => a.unread > 0).map(a => a.email);
      const auszuklappen = mitUngelesen.length > 0 ? mitUngelesen : accounts.slice(0, 1).map(a => a.email);
      return Object.fromEntries(auszuklappen.map(e => [e, true]));
    });
  }, [accounts]);

  const handleCompose = () => {
    setComposeMode('new');
    setReplyToEmail(null);
    setComposeOpen(true);
  };

  const toggle = (email: string) => setExpanded(p => ({ ...p, [email]: !p[email] }));

  const totalUnread = overview?.totalUnread ?? 0;

  // ─── Schmale Bildschirme: Konto-Chips statt eines Baums ───
  if (layout === 'bar') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCompose}
            className="btn-primary py-2 px-3 flex items-center gap-1.5 text-sm flex-shrink-0"
          >
            <PenLine className="w-4 h-4" />
            Neu
          </button>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide min-w-0">
            <button
              onClick={showUnified}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] border transition-colors flex-shrink-0',
                viewMode === 'unified'
                  ? 'bg-white/[0.08] border-white/[0.12] text-white'
                  : 'bg-white/[0.02] border-white/[0.06] text-white/50',
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              Alle
              {totalUnread > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-accent/20 text-accent-light tabular-nums">
                  {totalUnread}
                </span>
              )}
            </button>
            {accounts.map(acc => {
              const farbe = accountColor(accounts, acc.email);
              const inbox = acc.folders.find(f => f.role === 'inbox');
              const active = viewMode === 'folder' && activeAccountEmail === acc.email;
              return (
                <button
                  key={acc.email}
                  onClick={() => inbox && selectFolder(acc.email, inbox.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] border transition-colors flex-shrink-0',
                    active
                      ? 'bg-white/[0.08] border-white/[0.12] text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-white/50',
                  )}
                >
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', farbe.dot)} />
                  {acc.displayName}
                  {acc.unread > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-white/[0.08] text-white/60 tabular-nums">
                      {acc.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ordner des gewählten Kontos — nur im Einzelpostfach-Modus nötig */}
        {viewMode === 'folder' && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {sortFolders(accounts.find(a => a.email === activeAccountEmail)?.folders ?? []).map(f => {
              const config = f.role ? ROLE_CONFIG[f.role] : null;
              const Icon = config?.icon || Folder;
              const active = activeFolderId === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => activeAccountEmail && selectFolder(activeAccountEmail, f.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border transition-colors flex-shrink-0',
                    active
                      ? 'bg-white/[0.07] border-white/[0.1] text-white'
                      : 'bg-transparent border-white/[0.05] text-white/45',
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {config?.label || f.name}
                  {f.unread > 0 && <span className="text-[10px] text-white/45 tabular-nums">{f.unread}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Breite Bildschirme: alle Konten untereinander ───
  return (
    <div className="space-y-2">
      <button
        onClick={handleCompose}
        className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm"
      >
        <PenLine className="w-4 h-4" />
        Neue E-Mail
      </button>

      {/* Sammel-Eingang */}
      <button
        onClick={showUnified}
        className={clsx(
          'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all text-left border',
          viewMode === 'unified'
            ? 'bg-white/[0.08] border-white/[0.12] text-white'
            : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white/85 hover:bg-white/[0.04]',
        )}
      >
        <Layers className="w-4 h-4 shrink-0" />
        <span className="flex-1 truncate font-medium">Alle Postfächer</span>
        <Zaehler value={totalUnread} active={viewMode === 'unified'} />
      </button>

      {/* Je Konto ein aufklappbarer Block */}
      <div className="space-y-1.5">
        {accounts.map(acc => (
          <AccountBlock
            key={acc.email}
            account={acc}
            accounts={accounts}
            open={!!expanded[acc.email]}
            onToggle={() => toggle(acc.email)}
            activeFolderId={viewMode === 'folder' && activeAccountEmail === acc.email ? activeFolderId : null}
            onSelectFolder={(folderId) => selectFolder(acc.email, folderId)}
          />
        ))}
      </div>

      <button
        onClick={onAddAccount}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-white/35 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Konto hinzufügen
      </button>
    </div>
  );
}

function AccountBlock({
  account, accounts, open, onToggle, activeFolderId, onSelectFolder,
}: {
  account: MailOverviewAccount;
  accounts: MailOverviewAccount[];
  open: boolean;
  onToggle: () => void;
  activeFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
}) {
  const farbe = accountColor(accounts, account.email);

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', farbe.dot)} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium truncate">{account.displayName}</p>
          <p className="text-[10px] text-white/30 truncate">{account.email}</p>
        </div>
        {account.error ? (
          <AlertCircle className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0" />
        ) : (
          <Zaehler value={account.unread} active={false} />
        )}
        <ChevronDown className={clsx('w-3.5 h-3.5 text-white/25 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        account.error ? (
          <p className="px-3 pb-3 text-[11px] text-amber-300/80">{account.error}</p>
        ) : (
          <div className="px-1.5 pb-1.5 space-y-0.5">
            {sortFolders(account.folders).map(f => {
              const config = f.role ? ROLE_CONFIG[f.role] : null;
              const Icon = config?.icon || Folder;
              const active = activeFolderId === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => onSelectFolder(f.id)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12.5px] transition-all text-left',
                    active ? 'bg-white/[0.08] text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]',
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 truncate">{config?.label || f.name}</span>
                  <Zaehler value={f.unread} active={active} />
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
