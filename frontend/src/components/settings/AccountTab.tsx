/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Shield, Lock } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuthStore } from '@/stores/authStore';
import { beendeSitzung } from '@/lib/session';
import * as api from '@/lib/api';
import { SectionHeader } from './ui';
import { SessionsCard } from './SessionsCard';

export function AccountTab() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async () => {
    setPwError('');
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('Passwörter stimmen nicht überein');
      return;
    }
    if (pwForm.newPassword.length < 12) {
      setPwError('Passwort muss mindestens 12 Zeichen lang sein');
      return;
    }
    setPwLoading(true);
    try {
      await api.changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwSuccess(true);
      setTimeout(async () => {
        await beendeSitzung();
        logout();
        router.replace('/login');
      }, 1500);
    } catch (err: any) {
      setPwError(err.message?.includes('401') ? 'Aktuelles Passwort ist falsch' : 'Fehler beim Ändern des Passworts');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <>
      <GlassCard>
        <div className="relative z-10">
          <SectionHeader icon={Shield} tint="bg-indigo-500/10 border-indigo-500/20 text-indigo-400" title="Passwort ändern" desc="Nach der Änderung wirst du neu angemeldet" />
          <div className="space-y-4 max-w-xl">
            <div>
              <label className="text-xs text-white/55 block mb-1.5">Aktuelles Passwort</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <input type="password" className="glass-input w-full pl-10" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} placeholder="Aktuelles Passwort" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/55 block mb-1.5">Neues Passwort</label>
                <input type="password" className="glass-input w-full" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} placeholder="Min. 12 Zeichen" />
              </div>
              <div>
                <label className="text-xs text-white/55 block mb-1.5">Passwort bestätigen</label>
                <input type="password" className="glass-input w-full" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Passwort wiederholen" />
              </div>
            </div>
            {pwError && <p className="text-xs text-red-400">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-emerald-400">Passwort geändert! Du wirst abgemeldet...</p>}
            <button onClick={handleChangePassword} disabled={!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword || pwLoading} className="btn-primary disabled:opacity-40 flex items-center gap-2 text-xs">
              {pwLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
              {pwLoading ? 'Wird geändert...' : 'Passwort ändern'}
            </button>
          </div>
        </div>
      </GlassCard>
      <SessionsCard />
    </>
  );
}
