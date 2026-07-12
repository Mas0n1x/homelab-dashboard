/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Activity, Database, Users, ShieldAlert, Zap, ExternalLink, RotateCw, AlertTriangle } from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { authedFetch } from '@/lib/api';

type Range = '24h' | '7d' | '30d';
const RANGES: [Range, string][] = [['24h', '24 Stunden'], ['7d', '7 Tage'], ['30d', '30 Tage']];

function fmtNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' Mrd.';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' Mio.';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n ?? 0);
}
function fmtBytes(n: number): string {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function BarChart({ series, color }: { series: { t: string; requests: number }[]; color: string }) {
  if (!series?.length) return <div className="h-16" />;
  const max = Math.max(...series.map(s => s.requests), 1);
  return (
    <div className="flex items-end gap-[2px] h-16 mt-2">
      {series.map((s, i) => (
        <div key={i} className="flex-1 rounded-t-sm min-w-0" title={`${s.t}: ${fmtNum(s.requests)} Requests`}
          style={{ height: `${Math.max(3, (s.requests / max) * 100)}%`, background: color, opacity: 0.35 + 0.65 * (s.requests / max) }} />
      ))}
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="text-white/40">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-white/40 leading-none">{label}</p>
        <p className="text-sm font-semibold text-white/85 tabular-nums leading-tight mt-0.5">{value}{sub && <span className="text-[11px] font-normal text-white/30 ml-1">{sub}</span>}</p>
      </div>
    </div>
  );
}

const COLORS = ['#06b6d4', '#f59e0b', '#8b5cf6'];

export default function TrafficPage() {
  const [range, setRange] = useState<Range>('7d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<any>(null);

  const load = useCallback(async (r: Range) => {
    setLoading(true); setErr(null);
    try {
      const res = await authedFetch(`/traffic?range=${r}`);
      const j = await res.json();
      if (!res.ok) { setErr(j); setData(null); } else { setData(j); }
    } catch (e: any) { setErr({ message: e.message }); }
    setLoading(false);
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const domains = data?.domains ?? [];
  const totals = domains.reduce((a: any, d: any) => ({
    requests: a.requests + d.requests, bytes: a.bytes + d.bytes, uniques: a.uniques + d.uniques, threats: a.threats + d.threats,
  }), { requests: 0, bytes: 0, uniques: 0, threats: 0 });

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5"><Globe className="w-6 h-6 text-cyan-400" /> Traffic</h1>
            <p className="text-sm text-white/40 mt-1">Cloudflare-Analytics deiner Domains</p>
          </div>
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1">
            {RANGES.map(([r, label]) => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg text-[13px] transition ${range === r ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'}`}>{label}</button>
            ))}
          </div>
        </div>

        {loading && <div className="glass-card rounded-2xl p-12 flex items-center justify-center text-white/40"><RotateCw className="w-5 h-5 animate-spin mr-2" /> Lade Analytics…</div>}

        {!loading && err && (
          <div className="glass-card rounded-2xl p-6 border border-amber-500/15">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-white/85">Analytics noch nicht verfügbar</h3>
                {err.error === 'ANALYTICS_PERMISSION' ? (
                  <p className="text-[13px] text-white/50 mt-1.5 leading-relaxed">Dem Cloudflare-Token fehlt die Berechtigung <span className="font-mono text-white/70">Zone · Analytics · Read</span>. Ergänze sie im Cloudflare-Dashboard (My Profile → API Tokens → Token bearbeiten), dann lädt diese Seite automatisch.</p>
                ) : (
                  <p className="text-[13px] text-white/50 mt-1.5">{err.message || err.error || 'Unbekannter Fehler'}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && !err && (
          <>
            {/* Gesamt */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card rounded-2xl p-5"><Stat icon={<Activity className="w-5 h-5" />} label="Requests gesamt" value={fmtNum(totals.requests)} /></div>
              <div className="glass-card rounded-2xl p-5"><Stat icon={<Database className="w-5 h-5" />} label="Bandbreite" value={fmtBytes(totals.bytes)} /></div>
              <div className="glass-card rounded-2xl p-5"><Stat icon={<Users className="w-5 h-5" />} label="Besucher" value={fmtNum(totals.uniques)} /></div>
              <div className="glass-card rounded-2xl p-5"><Stat icon={<ShieldAlert className="w-5 h-5" />} label="Bedrohungen" value={fmtNum(totals.threats)} /></div>
            </div>

            {/* Pro Domain */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {domains.map((d: any, i: number) => (
                <motion.div key={d.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="glass-card rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <h3 className="text-sm font-semibold text-white/85 flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{d.name}</h3>
                    <a href={`https://${d.name}`} target="_blank" rel="noreferrer" className="text-white/25 hover:text-cyan-400 transition"><ExternalLink className="w-3.5 h-3.5" /></a>
                  </div>
                  <BarChart series={d.series} color={COLORS[i % COLORS.length]} />
                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 mt-4 pt-4 border-t border-white/[0.05]">
                    <Stat icon={<Activity className="w-4 h-4" />} label="Requests" value={fmtNum(d.requests)} />
                    <Stat icon={<Database className="w-4 h-4" />} label="Traffic" value={fmtBytes(d.bytes)} />
                    <Stat icon={<Users className="w-4 h-4" />} label="Besucher" value={fmtNum(d.uniques)} />
                    <Stat icon={<Zap className="w-4 h-4" />} label="Cache" value={`${d.cacheRate}%`} />
                  </div>
                  {d.threats > 0 && <p className="text-[11px] text-red-400/70 mt-3 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> {fmtNum(d.threats)} Bedrohungen abgewehrt</p>}
                </motion.div>
              ))}
            </div>
            <p className="text-[11px] text-white/25">Quelle: Cloudflare GraphQL Analytics · Besucher = Summe eindeutiger Besucher pro Intervall (Näherung).</p>
          </>
        )}
      </div>
    </PageTransition>
  );
}
