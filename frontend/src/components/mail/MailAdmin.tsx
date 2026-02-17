'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Shield, Copy, Check } from 'lucide-react';
import { getMailAccounts, createMailAccount, deleteMailAccount, getMailDkim, getMailDomains } from '@/lib/api';
import type { MailAccount } from '@/lib/types';

export function MailAdmin() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('mas0n1x.online');
  const [dkimDomain, setDkimDomain] = useState('mas0n1x.online');
  const [copiedDkim, setCopiedDkim] = useState(false);

  // Fixed password for all mail accounts (user only accesses via dashboard)
  const FIXED_PASSWORD = 'dashboardaccess';

  const { data: accounts = [] } = useQuery<MailAccount[]>({
    queryKey: ['mail-admin-accounts'],
    queryFn: getMailAccounts as () => Promise<MailAccount[]>,
  });

  const { data: domains = [] } = useQuery<string[]>({
    queryKey: ['mail-admin-domains'],
    queryFn: getMailDomains as () => Promise<string[]>,
  });

  const { data: dnsRecords } = useQuery<{ data?: { type: string; name: string; content: string }[] } | null>({
    queryKey: ['mail-admin-dns', dkimDomain],
    queryFn: () => getMailDkim(dkimDomain) as Promise<{ data?: { type: string; name: string; content: string }[] } | null>,
  });

  const createMutation = useMutation({
    mutationFn: () => createMailAccount({
      username: newUsername,
      password: FIXED_PASSWORD,
      displayName: newDisplayName,
      domain: selectedDomain
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-admin-accounts'] });
      setShowCreate(false);
      setNewUsername('');
      setNewDisplayName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (username: string) => deleteMailAccount(username),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail-admin-accounts'] }),
  });

  const handleCopyDkim = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDkim(true);
    setTimeout(() => setCopiedDkim(false), 2000);
  };

  const dnsRecordsList = (dnsRecords?.data || []) as { type: string; name: string; content: string }[];

  return (
    <div className="space-y-6">
      {/* Accounts */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Mail-Konten</h3>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" /> Neues Konto
          </button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-2">
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Benutzername (z.B. max)"
              className="glass-input w-full text-sm"
            />
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="glass-input w-full text-sm"
            >
              {domains.length > 0 ? (
                domains.map((d: string) => (
                  <option key={d} value={d}>{d}</option>
                ))
              ) : (
                <>
                  <option value="mas0n1x.online">mas0n1x.online</option>
                  <option value="lawnet.sale">lawnet.sale</option>
                </>
              )}
            </select>
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Anzeigename (z.B. Max Mustermann)"
              className="glass-input w-full text-sm"
            />
            <p className="text-[10px] text-white/30">
              E-Mail wird: {newUsername || '...'}@{selectedDomain}
              <br />
              <span className="text-white/20">Kein Passwort erforderlich - nur Zugriff über Dashboard</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newUsername.trim() || createMutation.isPending}
                className="btn-primary py-1.5 px-3 text-xs disabled:opacity-40"
              >
                {createMutation.isPending ? 'Erstelle...' : 'Erstellen'}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-glass py-1.5 px-3 text-xs">
                Abbrechen
              </button>
            </div>
            {createMutation.isError && (
              <p className="text-xs text-red-400">{(createMutation.error as Error).message}</p>
            )}
          </div>
        )}

        {/* Account List */}
        <div className="space-y-2">
          {Array.isArray(accounts) && accounts.length > 0 ? (
            accounts
              .filter((a: MailAccount) => a.type === 'individual')
              .map((account: MailAccount) => (
                <div
                  key={account.name}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{account.description || account.name}</p>
                    <p className="text-[10px] text-white/40">
                      {account.emails?.join(', ') || account.name}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Konto "${account.name}" wirklich löschen?`)) {
                        deleteMutation.mutate(account.name);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="btn-glass p-1.5 hover:text-red-400"
                    title="Löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
          ) : (
            <p className="text-xs text-white/30 text-center py-4">
              {Array.isArray(accounts) ? 'Keine Konten vorhanden' : 'Konten werden geladen...'}
            </p>
          )}
        </div>
      </div>

      {/* DNS Info */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold">DNS-Konfiguration</h3>
          <select
            value={dkimDomain}
            onChange={(e) => setDkimDomain(e.target.value)}
            className="glass-input text-xs py-1 px-2 ml-auto"
          >
            {domains.length > 0 ? (
              domains.map((d: string) => (
                <option key={d} value={d}>{d}</option>
              ))
            ) : (
              <>
                <option value="mas0n1x.online">mas0n1x.online</option>
                <option value="lawnet.sale">lawnet.sale</option>
              </>
            )}
          </select>
          {dnsRecordsList.length > 0 && (
            <button
              onClick={() => handleCopyDkim(dnsRecordsList.map(r => `${r.name} ${r.type} ${r.content}`).join('\n'))}
              className="p-0.5 rounded hover:bg-white/10"
              title="Alle kopieren"
            >
              {copiedDkim ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-white/30" />}
            </button>
          )}
        </div>

        <div className="space-y-2 text-xs">
          {dnsRecordsList.length > 0 ? (
            dnsRecordsList.map((record, i) => (
              <div key={i} className="p-2 rounded bg-white/[0.04]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/[0.08]">{record.type}</span>
                  <span className="text-white/50 text-[11px] truncate">{record.name}</span>
                </div>
                <code className="text-white/70 font-mono text-[11px] break-all">{record.content}</code>
              </div>
            ))
          ) : (
            <p className="text-white/30 text-center py-4">DNS-Records werden geladen...</p>
          )}
        </div>
      </div>
    </div>
  );
}
