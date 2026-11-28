/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { Mail, LogIn } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
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
  const [provider, setProvider] = useState<'jmap' | 'gmail'>('jmap');
  const [appPassword, setAppPassword] = useState('');
  const [error, setError] = useState('');
  const { setAccounts, setActiveAccount } = useMailStore();
  const queryClient = useQueryClient();

  // Mail-Account-Passwort wird serverseitig gesetzt (MAIL_ACCOUNT_PASSWORD) — nicht mehr im Client

  const loginMutation = useMutation({
    mutationFn: async () => {
      setError('');
      // Add account (includes JMAP session test)
      const result = await addUserMailAccount({
        email: email.trim(),
        displayName: displayName.trim() || undefined,
        ...(provider === 'gmail' ? { provider, password: appPassword } : {}),
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
      setAppPassword('');

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
    if (!email.trim() || (provider === 'gmail' && !appPassword.trim())) return;
    loginMutation.mutate();
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {([['jmap', 'Eigener Server'], ['gmail', 'Gmail']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setProvider(id)}
            className={`py-2 rounded-lg text-sm border transition-colors ${
              provider === id
                ? 'bg-indigo-500/20 border-indigo-400/40 text-white'
                : 'border-white/10 text-white/60 hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div>
        <label className="text-xs text-white/65 mb-1 block">E-Mail-Adresse</label>
        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={provider === 'gmail' ? 'name@gmail.com' : 'user@domain.tld'}
          className="glass-input w-full"
          name="mailbox-address"
          autoComplete="off"
        />
      </div>
      <div>
        <label className="text-xs text-white/65 mb-1 block">Anzeigename (optional)</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="z.B. Privat, Arbeit, etc."
          className="glass-input w-full"
        />
      </div>
      {provider === 'gmail' ? (
        <div>
          <label className="text-xs text-white/65 mb-1 block">Google-App-Passwort</label>
          <input
            type="password"
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
            placeholder="xxxx xxxx xxxx xxxx"
            className="glass-input w-full"
            name="mailbox-app-password"
            // "new-password" hindert den Browser, gespeicherte Zugänge einzusetzen.
            autoComplete="new-password"
          />
          <p className="text-[11px] text-white/50 mt-1">
            Erstellen unter myaccount.google.com/apppasswords (2-Faktor muss aktiv sein). Dein normales Passwort funktioniert nicht.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-white/50">
          Kein Passwort erforderlich - nur Zugriff über Dashboard
        </p>
      )}

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
      <Modal isOpen onClose={() => onClose?.()} title="Mail-Konto hinzufügen" size="sm">
        <p className="text-xs text-white/55 mb-4">Eigener Server oder Gmail verbinden</p>
        {formContent}
      </Modal>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mail</h1>
      <div className="max-w-md mx-auto">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-indigo-500/15">
              <Mail className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Mail-Konto verbinden</h2>
              <p className="text-xs text-white/55">Eigener Server oder Gmail verbinden</p>
            </div>
          </div>
          {formContent}
        </div>
      </div>
    </div>
  );
}
