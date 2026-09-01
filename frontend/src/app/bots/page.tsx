/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, Circle, Users, Activity, ChevronRight, RefreshCw, ExternalLink } from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { getBots, type BotOverviewEntry } from '@/lib/api';

function fmtUptime(ms?: number): string {
  if (!ms || ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function BotsOverviewPage() {
  const [bots, setBots] = useState<BotOverviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getBots();
      setBots(data.bots || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto md:py-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-accent-light" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold">Discord-Bots</h1>
              <p className="text-[11px] sm:text-sm text-white/40 truncate">Zentrale Steuerung aller Bots an einem Ort.</p>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors flex-shrink-0"
            title="Aktualisieren"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Aktualisieren</span>
          </button>
        </div>

        {error && (
          <div className="glass-card rounded-2xl p-4 mb-4 border border-red-500/20 text-red-300/80 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="glass-card rounded-2xl p-5 h-40 animate-pulse bg-white/[0.02]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((b, i) => (
              <BotCard key={b.id} bot={b} delay={i * 0.05} />
            ))}
            {bots.length === 0 && (
              <div className="col-span-full glass-card rounded-2xl p-8 text-center text-white/40 text-sm">
                Keine Bots gefunden. Ist die Bot-Runtime erreichbar (BOT_RUNTIME_URL / BOT_RUNTIME_TOKEN)?
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function BotCard({ bot, delay }: { bot: BotOverviewEntry; delay: number }) {
  const connected = !!bot.status?.connected;
  const hasPanel = bot.id === 'portfolio' || bot.id === 'salenet';

  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="glass-card rounded-2xl p-5 h-full flex flex-col transition-colors hover:bg-white/[0.03] group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {bot.status?.avatar ? (
            <img src={bot.status.avatar} alt="" className="w-10 h-10 rounded-xl" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
              <Bot className="w-5 h-5 text-white/40" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium text-[15px] truncate">{bot.name}</div>
            {bot.status?.username && <div className="text-[11px] text-white/35 truncate">{bot.status.username}</div>}
          </div>
        </div>
        <span
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium flex-shrink-0 ${
            connected ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300/80'
          }`}
        >
          <Circle className={`w-2 h-2 ${connected ? 'fill-emerald-400 text-emerald-400' : 'fill-red-400 text-red-400'}`} />
          {connected ? 'Online' : 'Offline'}
        </span>
      </div>

      <p className="text-[12px] text-white/40 leading-relaxed flex-1 mb-4">{bot.description}</p>

      <div className="flex items-center gap-4 text-[11px] text-white/45 mb-4">
        {connected && (
          <>
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {bot.status?.memberCount ?? 0}</span>
            <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> {bot.status?.ping ?? 0} ms</span>
            <span className="flex items-center gap-1.5">↑ {fmtUptime(bot.status?.uptime)}</span>
          </>
        )}
        {!connected && bot.status?.error && <span className="text-red-300/60 truncate">{bot.status.error}</span>}
        {bot.external && <span className="ml-auto flex items-center gap-1 text-white/30"><ExternalLink className="w-3 h-3" /> extern</span>}
      </div>

      {hasPanel ? (
        <div className="flex items-center justify-between text-[13px] text-accent-light/80 group-hover:text-accent-light transition-colors">
          <span>Steuern</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      ) : (
        <div className="flex items-center justify-between text-[13px] text-white/30">
          <span>Kein Steuerpanel</span>
        </div>
      )}
    </motion.div>
  );

  if (hasPanel) {
    return <Link href={`/bots/${bot.id}`} className="block h-full">{inner}</Link>;
  }
  return inner;
}
