'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Reply, ReplyAll, Forward, Trash2, Paperclip, Download } from 'lucide-react';
import { jmapCall, getMailAttachmentUrl } from '@/lib/api';
import { useMailStore } from '@/stores/mailStore';
import type { MailEmail, MailFolder } from '@/lib/types';

interface EmailReaderProps {
  folders: MailFolder[];
}

export function EmailReader({ folders }: EmailReaderProps) {
  const {
    email, password, accountId, selectedEmailId, setSelectedEmailId,
    setComposeOpen, setComposeMode, setReplyToEmail,
  } = useMailStore();
  const queryClient = useQueryClient();

  const { data: emailData, isLoading } = useQuery({
    queryKey: ['mail-email', accountId, selectedEmailId],
    queryFn: async () => {
      if (!email || !password || !accountId || !selectedEmailId) return null;
      const result = await jmapCall(email, password, [
        ['Email/get', {
          accountId,
          ids: [selectedEmailId],
          properties: [
            'id', 'blobId', 'threadId', 'mailboxIds', 'from', 'to', 'cc', 'bcc',
            'replyTo', 'subject', 'receivedAt', 'sentAt', 'preview', 'keywords',
            'hasAttachment', 'htmlBody', 'textBody', 'attachments', 'bodyValues',
          ],
          fetchHTMLBodyValues: true,
          fetchTextBodyValues: true,
        }, '0'],
      ]);
      const response = result.methodResponses?.[0]?.[1] as { list?: MailEmail[] } | undefined;
      const list = response?.list || [];
      return list[0] || null;
    },
    enabled: !!email && !!password && !!accountId && !!selectedEmailId,
  });

  // Delete (move to trash)
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!email || !password || !accountId || !emailData) return;
      const trashFolder = folders.find(f => f.role === 'trash');
      if (!trashFolder) return;
      const newMailboxIds: Record<string, boolean | null> = {};
      for (const mbId of Object.keys(emailData.mailboxIds)) {
        newMailboxIds[mbId] = null;
      }
      newMailboxIds[trashFolder.id] = true;
      await jmapCall(email, password, [
        ['Email/set', {
          accountId,
          update: { [emailData.id]: { mailboxIds: newMailboxIds } },
        }, '0'],
      ]);
    },
    onSuccess: () => {
      setSelectedEmailId(null);
      queryClient.invalidateQueries({ queryKey: ['mail-emails'] });
      queryClient.invalidateQueries({ queryKey: ['mail-folders'] });
    },
  });

  const handleReply = (mode: 'reply' | 'replyAll' | 'forward') => {
    if (!emailData) return;
    setComposeMode(mode);
    setReplyToEmail(emailData);
    setComposeOpen(true);
  };

  if (isLoading) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="animate-pulse text-white/30 text-sm">Lade E-Mail...</div>
      </div>
    );
  }

  if (!emailData) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-white/30 text-sm">E-Mail nicht gefunden</p>
      </div>
    );
  }

  const formatAddress = (addr: { name: string | null; email: string }) =>
    addr.name ? `${addr.name} <${addr.email}>` : addr.email;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  // Get HTML or text body
  const htmlPart = emailData.htmlBody?.[0];
  const textPart = emailData.textBody?.[0];
  const htmlContent = htmlPart && emailData.bodyValues?.[htmlPart.partId]?.value;
  const textContent = textPart && emailData.bodyValues?.[textPart.partId]?.value;

  // Sanitize HTML: remove scripts, event handlers
  const sanitizeHtml = (html: string) => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+\s*=/gi, ' data-removed=');
  };

  return (
    <div className="space-y-3">
      {/* Back button + Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedEmailId(null)}
          className="btn-glass py-1.5 px-3 text-xs flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Zurück
        </button>
        <div className="flex-1" />
        <button onClick={() => handleReply('reply')} className="btn-glass py-1.5 px-3 text-xs flex items-center gap-1.5">
          <Reply className="w-3.5 h-3.5" /> Antworten
        </button>
        <button onClick={() => handleReply('replyAll')} className="btn-glass py-1.5 px-3 text-xs flex items-center gap-1.5">
          <ReplyAll className="w-3.5 h-3.5" /> Allen
        </button>
        <button onClick={() => handleReply('forward')} className="btn-glass py-1.5 px-3 text-xs flex items-center gap-1.5">
          <Forward className="w-3.5 h-3.5" /> Weiterleiten
        </button>
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="btn-glass py-1.5 px-3 text-xs flex items-center gap-1.5 hover:text-red-400"
        >
          <Trash2 className="w-3.5 h-3.5" /> Löschen
        </button>
      </div>

      {/* Header */}
      <div className="glass-card p-4">
        <h2 className="text-lg font-semibold mb-3">{emailData.subject || '(Kein Betreff)'}</h2>
        <div className="space-y-1 text-sm">
          <div className="flex gap-2">
            <span className="text-white/40 w-12 shrink-0">Von:</span>
            <span className="text-white/80">{emailData.from?.map(formatAddress).join(', ') || 'Unbekannt'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-white/40 w-12 shrink-0">An:</span>
            <span className="text-white/60">{emailData.to?.map(formatAddress).join(', ')}</span>
          </div>
          {emailData.cc?.length > 0 && (
            <div className="flex gap-2">
              <span className="text-white/40 w-12 shrink-0">CC:</span>
              <span className="text-white/60">{emailData.cc.map(formatAddress).join(', ')}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-white/40 w-12 shrink-0">Datum:</span>
            <span className="text-white/60">{formatDate(emailData.receivedAt)}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="glass-card p-4 overflow-hidden">
        {htmlContent ? (
          <iframe
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{color:#e0e0e0;background:transparent;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;margin:0;padding:0;}a{color:#818cf8;}img{max-width:100%;height:auto;}blockquote{border-left:3px solid #333;margin:8px 0;padding:0 12px;color:#999;}</style></head><body>${sanitizeHtml(htmlContent)}</body></html>`}
            sandbox="allow-same-origin"
            className="w-full border-0 min-h-[200px]"
            style={{ colorScheme: 'dark' }}
            onLoad={(e) => {
              const iframe = e.target as HTMLIFrameElement;
              if (iframe.contentDocument?.body) {
                iframe.style.height = iframe.contentDocument.body.scrollHeight + 20 + 'px';
              }
            }}
          />
        ) : textContent ? (
          <pre className="whitespace-pre-wrap text-sm text-white/70 font-sans">{textContent}</pre>
        ) : (
          <p className="text-white/30 text-sm">Kein Inhalt</p>
        )}
      </div>

      {/* Attachments */}
      {emailData.attachments?.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Paperclip className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/60">{emailData.attachments.length} Anhäng{emailData.attachments.length === 1 ? '' : 'e'}</span>
          </div>
          <div className="space-y-1.5">
            {emailData.attachments.map((att) => (
              <a
                key={att.partId}
                href={accountId ? getMailAttachmentUrl(accountId, att.blobId, att.name || 'download') : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all text-sm"
              >
                <Download className="w-4 h-4 text-white/40 shrink-0" />
                <span className="flex-1 truncate text-white/70">{att.name || 'Unbenannt'}</span>
                <span className="text-[10px] text-white/30 shrink-0">
                  {att.size > 1048576
                    ? `${(att.size / 1048576).toFixed(1)} MB`
                    : `${Math.round(att.size / 1024)} KB`}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
