'use client';

import { useState } from 'react';
import { Mail, LogIn } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveMailCredentials, getMailSession } from '@/lib/api';
import { useMailStore } from '@/stores/mailStore';

export function MailSetup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setCredentials } = useMailStore();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: async () => {
      setError('');
      // Test connection by getting JMAP session
      const session = await getMailSession(email, password);
      const accountId = session?.primaryAccounts?.['urn:ietf:params:jmap:mail'] || null;
      // Save credentials
      await saveMailCredentials(email, password, accountId);
      return { email, password, accountId };
    },
    onSuccess: (data) => {
      setCredentials(data.email, data.password, data.accountId);
      queryClient.invalidateQueries({ queryKey: ['mail-credentials'] });
    },
    onError: (err: Error) => {
      setError(err.message || 'Verbindung fehlgeschlagen');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    loginMutation.mutate();
  };

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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-white/50 mb-1 block">E-Mail-Adresse</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@mas0n1x.online"
                className="glass-input w-full"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort"
                className="glass-input w-full"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!email.trim() || !password.trim() || loginMutation.isPending}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <LogIn className="w-4 h-4" />
              {loginMutation.isPending ? 'Verbinde...' : 'Anmelden'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
