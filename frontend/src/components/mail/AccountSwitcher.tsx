'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus, Mail, Check, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { getUserMailAccounts, activateUserMailAccount, deleteUserMailAccount } from '@/lib/api';
import { useMailStore } from '@/stores/mailStore';
import type { MailAccount } from '@/lib/api';

interface AccountSwitcherProps {
  onAddAccount: () => void;
}

export function AccountSwitcher({ onAddAccount }: AccountSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { email: activeEmail, setActiveAccount } = useMailStore();
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery<MailAccount[]>({
    queryKey: ['mail-accounts'],
    queryFn: getUserMailAccounts,
    refetchInterval: 60000, // Refresh every minute for unread counts
  });

  const activateMutation = useMutation<{ ok: boolean; email: string }, Error, number>({
    mutationFn: activateUserMailAccount,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mail-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['mail-folders'] });
      queryClient.invalidateQueries({ queryKey: ['mail-emails'] });
      setActiveAccount(data.email);
      setIsOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUserMailAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['mail-folders'] });
      queryClient.invalidateQueries({ queryKey: ['mail-emails'] });
    },
  });

  const activeAccount = accounts.find(acc => acc.email === activeEmail);

  const handleSwitchAccount = (account: MailAccount) => {
    if (account.email !== activeEmail) {
      activateMutation.mutate(account.id);
    } else {
      setIsOpen(false);
    }
  };

  const handleDeleteAccount = (e: React.MouseEvent, accountId: number) => {
    e.stopPropagation();
    if (confirm('Möchten Sie dieses Mail-Konto wirklich entfernen?')) {
      deleteMutation.mutate(accountId);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
          'bg-white/5 hover:bg-white/10 border border-white/10'
        )}
      >
        <Mail className="w-4 h-4 text-blue-400" />
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">
            {activeAccount?.displayName || activeAccount?.email || 'Kein Account'}
          </span>
          {activeAccount?.displayName && (
            <span className="text-xs text-gray-400">{activeAccount.email}</span>
          )}
        </div>
        <ChevronDown className={clsx(
          'w-4 h-4 text-gray-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
            <div className="py-2">
              {accounts.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400 text-center">
                  Keine Mail-Konten konfiguriert
                </div>
              ) : (
                accounts.map((account) => (
                  <div
                    key={account.id}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors group',
                      account.email === activeEmail
                        ? 'bg-blue-500/10 hover:bg-blue-500/20'
                        : 'hover:bg-white/5'
                    )}
                    onClick={() => handleSwitchAccount(account)}
                  >
                    <div className="flex-shrink-0">
                      {account.email === activeEmail ? (
                        <Check className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Mail className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {account.displayName || account.email}
                        </span>
                        {account.unreadCount !== undefined && account.unreadCount > 0 && (
                          <span className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold bg-blue-500 text-white rounded-full">
                            {account.unreadCount}
                          </span>
                        )}
                      </div>
                      {account.displayName && (
                        <div className="text-xs text-gray-400 truncate">
                          {account.email}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDeleteAccount(e, account.id)}
                      className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                      title="Konto entfernen"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-gray-700">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onAddAccount();
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-blue-400 hover:bg-white/5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Account hinzufügen
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
