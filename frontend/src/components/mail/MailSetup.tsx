'use client';

import { useState } from 'react';
import { Mail, LogIn, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addUserMailAccount } from '@/lib/api';
import { useMailStore } from '@/stores/mailStore';

interface MailSetupProps {
  isModal?: boolean;
  onClose?: () => void;
}

export function MailSetup({ isModal = false, onClose }: MailSetupProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const { setAccounts, setActiveAccount } = useMailStore();
  const queryClient = useQueryClient();

  // Fixed password for all mail accounts (same as in MailAdmin)
  const FIXED_PASSWORD = 'dashboardaccess';

  const loginMutation = useMutation({
    mutationFn: async () => {
      setError('');
      // Add account (includes JMAP session test)
      const result = await addUserMailAccount({
        email: email.trim(),
        password: FIXED_PASSWORD,
        displayName: displayName.trim() || undefined,
      });
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mail-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['mail-folders'] });
      setActiveAccount(data.email);

      // Reset form
      setEmail('');
      setDisplayName('');

      if (onClose) {
        onClose();
      }
    },
    onError: (err: Error) => {
      setError(err.message || 'Verbindung fehlgeschlagen');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    loginMutation.mutate();
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-white/50 mb-1 block">E-Mail-Adresse</label>
        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@domain.tld"
          className="glass-input w-full"
          autoComplete="email"
        />
      </div>
      <div>
        <label className="text-xs text-white/50 mb-1 block">Anzeigename (optional)</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="z.B. Privat, Arbeit, etc."
          className="glass-input w-full"
        />
      </div>
      <p className="text-[10px] text-white/30">
        Kein Passwort erforderlich - nur Zugriff über Dashboard
      </p>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!email.trim() || loginMutation.isPending}
        className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-40"
      >
        <LogIn className="w-4 h-4" />
        {loginMutation.isPending ? 'Verbinde...' : isModal ? 'Konto hinzufügen' : 'Verbinden'}
      </button>
    </form>
  );

  if (isModal) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/50 z-50"
          onClick={onClose}
        />
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="glass-card p-6 max-w-md w-full mx-4 pointer-events-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-indigo-500/15">
                  <Mail className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Mail-Konto hinzufügen</h2>
                  <p className="text-xs text-white/40">Stalwart JMAP-Zugangsdaten eingeben</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {formContent}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mail</h1>
      <div className="max-w-md mx-auto">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-indigo-500/15">
              <Mail className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Mail-Konto verbinden</h2>
              <p className="text-xs text-white/40">Stalwart JMAP-Zugangsdaten eingeben</p>
            </div>
          </div>
          {formContent}
        </div>
      </div>
    </div>
  );
}
