'use client';

import { Inbox, Send, FileEdit, Trash2, ShieldAlert, Folder, PenLine } from 'lucide-react';
import { clsx } from 'clsx';
import { useMailStore } from '@/stores/mailStore';
import type { MailFolder } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';

const ROLE_CONFIG: Record<string, { label: string; icon: LucideIcon; order: number }> = {
  inbox: { label: 'Posteingang', icon: Inbox, order: 0 },
  sent: { label: 'Gesendet', icon: Send, order: 1 },
  drafts: { label: 'Entwürfe', icon: FileEdit, order: 2 },
  trash: { label: 'Papierkorb', icon: Trash2, order: 3 },
  junk: { label: 'Spam', icon: ShieldAlert, order: 4 },
};

interface FolderSidebarProps {
  folders: MailFolder[];
}

export function FolderSidebar({ folders }: FolderSidebarProps) {
  const { activeFolderId, setActiveFolderId, setComposeOpen, setComposeMode, setReplyToEmail } = useMailStore();

  const sorted = [...folders].sort((a, b) => {
    const orderA = a.role ? (ROLE_CONFIG[a.role]?.order ?? 10) : 20;
    const orderB = b.role ? (ROLE_CONFIG[b.role]?.order ?? 10) : 20;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  const handleCompose = () => {
    setComposeMode('new');
    setReplyToEmail(null);
    setComposeOpen(true);
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleCompose}
        className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm"
      >
        <PenLine className="w-4 h-4" />
        Neue E-Mail
      </button>

      <div className="space-y-0.5">
        {sorted.map((folder) => {
          const config = folder.role ? ROLE_CONFIG[folder.role] : null;
          const Icon = config?.icon || Folder;
          const label = config?.label || folder.name;
          const isActive = activeFolderId === folder.id;

          return (
            <button
              key={folder.id}
              onClick={() => setActiveFolderId(folder.id)}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left',
                isActive
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/60 hover:text-white/80 hover:bg-white/[0.04]'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {folder.unreadEmails > 0 && (
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                  isActive ? 'bg-accent/20 text-accent-light' : 'bg-white/[0.08] text-white/50'
                )}>
                  {folder.unreadEmails}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
