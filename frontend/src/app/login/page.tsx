'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, User, Activity, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Background } from '@/components/layout/Background';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Login fehlgeschlagen');
        setLoading(false);
        return;
      }

      const data = await res.json();
      setAuth(data);
      router.replace('/');
    } catch {
      setError('Verbindung zum Server fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Background />
      <div className="flex items-center justify-center min-h-screen px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <div className="glass-card p-8">
            <div className="relative z-10">
              {/* Logo */}
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center">
                  <Activity className="w-7 h-7 text-accent-light" />
                </div>
              </div>
              <h1 className="text-xl font-semibold text-center mb-1">Homelab Dashboard</h1>
              <p className="text-sm text-white/40 text-center mb-8">Anmelden</p>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-sm text-red-400">{error}</span>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-white/40 block mb-1.5">Benutzername</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      className="glass-input w-full pl-10"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="admin"
                      autoFocus
                      autoComplete="username"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1.5">Passwort</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="password"
                      className="glass-input w-full pl-10"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="********"
                      autoComplete="current-password"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!username || !password || loading}
                  className="btn-primary w-full py-3 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  {loading ? 'Wird angemeldet...' : 'Anmelden'}
                </button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
