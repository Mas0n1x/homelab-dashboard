'use client';

import { useState, useRef } from 'react';
import { X, Send, Paperclip, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { jmapCall, uploadMailAttachment } from '@/lib/api';
import { useMailStore } from '@/stores/mailStore';

interface UploadedFile {
  blobId: string;
  name: string;
  type: string;
  size: number;
}

export function ComposeModal() {
  const {
    email: mailEmail, accountId,
    composeOpen, setComposeOpen, composeMode, replyToEmail,
  } = useMailStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill based on mode
  const getInitialTo = () => {
    if (!replyToEmail) return '';
    if (composeMode === 'reply' || composeMode === 'replyAll') {
      return replyToEmail.from?.map(a => a.email).join(', ') || '';
    }
    return '';
  };

  const getInitialCc = () => {
    if (!replyToEmail || composeMode !== 'replyAll') return '';
    const allCc = [...(replyToEmail.to || []), ...(replyToEmail.cc || [])]
      .filter(a => a.email !== mailEmail)
      .map(a => a.email);
    return allCc.join(', ');
  };

  const getInitialSubject = () => {
    if (!replyToEmail) return '';
    const subj = replyToEmail.subject || '';
    if (composeMode === 'forward') return subj.startsWith('Fwd:') ? subj : `Fwd: ${subj}`;
    if (composeMode === 'reply' || composeMode === 'replyAll') return subj.startsWith('Re:') ? subj : `Re: ${subj}`;
    return '';
  };

  const getInitialBody = () => {
    if (!replyToEmail) return '';
    const from = replyToEmail.from?.[0];
    const date = new Date(replyToEmail.receivedAt).toLocaleString('de-DE');
    const header = `\n\n--- ${from?.name || from?.email || ''} am ${date} ---\n`;
    return header + (replyToEmail.preview || '');
  };

  const [to, setTo] = useState(getInitialTo());
  const [cc, setCc] = useState(getInitialCc());
  const [subject, setSubject] = useState(getInitialSubject());
  const [body, setBody] = useState(getInitialBody());
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!mailEmail || !accountId) throw new Error('Nicht verbunden');

      const toAddresses = to.split(',').map(e => e.trim()).filter(Boolean).map(e => ({ email: e }));
      const ccAddresses = cc ? cc.split(',').map(e => e.trim()).filter(Boolean).map(e => ({ email: e })) : [];

      if (toAddresses.length === 0) throw new Error('Empfänger erforderlich');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const draft: Record<string, any> = {
        from: [{ email: mailEmail }],
        to: toAddresses,
        subject: subject || '(Kein Betreff)',
        textBody: [{ value: body, type: 'text/plain' }],
        'keywords/$draft': true,
        mailboxIds: {},
      };

      if (ccAddresses.length > 0) draft.cc = ccAddresses;

      if (replyToEmail && (composeMode === 'reply' || composeMode === 'replyAll')) {
        draft.inReplyTo = replyToEmail.id;
        draft.references = replyToEmail.id;
      }

      if (attachments.length > 0) {
        draft.attachments = attachments.map(a => ({
          blobId: a.blobId,
          name: a.name,
          type: a.type,
        }));
      }

      // Get identities first
      const identityResult = await jmapCall(mailEmail, [
        ['Identity/get', { accountId }, 'i'],
      ]);
      const identityResponse = identityResult.methodResponses?.[0]?.[1] as { list?: { id: string }[] } | undefined;
      const identities = identityResponse?.list || [];
      const identityId = identities[0]?.id;
      if (!identityId) throw new Error('Keine Identität gefunden');

      // Create email and submit
      await jmapCall(mailEmail, [
        ['Email/set', {
          accountId,
          create: { draft },
        }, 'c'],
        ['EmailSubmission/set', {
          accountId,
          create: {
            sub: {
              identityId,
              emailId: '#draft',
            },
          },
        }, 's'],
      ]);
    },
    onSuccess: () => {
      setComposeOpen(false);
      queryClient.invalidateQueries({ queryKey: ['mail-emails'] });
      queryClient.invalidateQueries({ queryKey: ['mail-folders'] });
    },
  });

  const handleFileUpload = async (files: FileList) => {
    if (!mailEmail || !accountId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadMailAttachment(mailEmail, accountId, file);
        if (result.blobId) {
          setAttachments(prev => [...prev, {
            blobId: result.blobId,
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
          }]);
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
  };

  if (!composeOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setComposeOpen(false)} />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[640px] z-50 glass-card flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold">
            {composeMode === 'new' && 'Neue E-Mail'}
            {composeMode === 'reply' && 'Antworten'}
            {composeMode === 'replyAll' && 'Allen antworten'}
            {composeMode === 'forward' && 'Weiterleiten'}
          </h3>
          <button onClick={() => setComposeOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="text-[10px] text-white/40 mb-1 block">An</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="empfaenger@example.com"
              className="glass-input w-full text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 mb-1 block">CC</label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="Optional"
              className="glass-input w-full text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 mb-1 block">Betreff</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff"
              className="glass-input w-full text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-white/40 mb-1 block">Nachricht</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="glass-input w-full text-sm min-h-[200px] resize-y"
              placeholder="Nachricht schreiben..."
            />
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-1.5">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm">
                  <Paperclip className="w-3.5 h-3.5 text-white/40 shrink-0" />
                  <span className="flex-1 truncate text-white/60">{att.name}</span>
                  <span className="text-[10px] text-white/30">{Math.round(att.size / 1024)} KB</span>
                  <button
                    onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                    className="p-0.5 rounded hover:bg-white/10"
                  >
                    <Trash2 className="w-3 h-3 text-white/30" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.06]">
          <button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !to.trim()}
            className="btn-primary py-2 px-4 text-sm flex items-center gap-2 disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
            {sendMutation.isPending ? 'Sende...' : 'Senden'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-glass py-2 px-3 text-sm flex items-center gap-1.5"
          >
            <Paperclip className="w-4 h-4" />
            {uploading ? 'Lade...' : 'Anhang'}
          </button>

          {sendMutation.isError && (
            <span className="text-xs text-red-400 ml-2">{(sendMutation.error as Error).message}</span>
          )}
        </div>
      </motion.div>
    </>
  );
}
