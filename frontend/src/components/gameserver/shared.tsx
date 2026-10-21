/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, Sword, Radio, Wheat, Server as ServerIcon, Trees } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { zahl } from '@/lib/formatters';

/** Ruft einen Endpunkt eines Servers auf und gibt das JSON zurück — Fehler stehen in `error`. */
export type Api = (endpoint: string, options?: RequestInit) => Promise<any>;

export interface GameServer {
  id: string;
  name: string;
  description: string;
  game: string;
  gameLabel: string;
  host: string;
  port: number | null;
  allocations: { id: number; ip: string; alias: string | null; port: number; notes: string | null; default: boolean }[];
  limits: { memory: number; disk: number; cpu: number };
  backupLimit: number;
  installing: boolean;
  suspended: boolean;
  state: {
    state: string; running: boolean; health: string; label: string; error?: string;
    cpu?: number; memory?: number; memoryLimit?: number; disk?: number; uptime?: number;
  };
}

export function authFetch(url: string, options?: RequestInit) {
  const { accessToken } = useAuthStore.getState();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...((options?.headers as Record<string, string>) || {}),
    },
  }).then(r => r.json().catch(() => ({})));
}

export const makeGsApi = (id: string): Api => (endpoint, options) =>
  authFetch(`/api/gameservers/${encodeURIComponent(id)}${endpoint}`, options);

export const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '');

export function fmtSize(b: number): string {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
  return `${zahl(b / Math.pow(1024, i), i === 0 ? 0 : 1)} ${u[i]}`;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '–';
  try { return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return String(iso); }
}

export function fmtUptime(ms?: number): string {
  if (!ms) return '–';
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m % 60} min` : `${m} min`;
}

export const GAME_ICONS: Record<string, any> = {
  minecraft: Trees, fivem: Radio, rimworld: Wheat, valheim: Sword, generic: Gamepad2,
};
export const gameIcon = (kind: string) => GAME_ICONS[kind] || ServerIcon;

/** Statusfarbe + Text für Header, Sidebar und Karten. */
export function stateStyle(s?: GameServer['state']) {
  if (!s || s.error) return { color: '#6b7280', text: s?.label || 'Unbekannt' };
  if (s.state === 'running') return { color: '#10b981', text: s.label };
  if (s.state === 'starting' || s.state === 'stopping') return { color: '#f59e0b', text: s.label };
  return { color: '#ef4444', text: s.label };
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${checked ? 'bg-emerald-500/60' : 'bg-white/[0.12]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 pointer-events-none ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

export function CodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = value.split('\n').length;
  return (
    <div className="flex h-[46vh] overflow-hidden bg-black/30 rounded-b-2xl">
      <div ref={gutterRef} className="overflow-hidden py-4 pl-3 pr-2.5 text-right text-white/20 font-mono text-[12px] leading-[1.6] select-none border-r border-white/[0.05] bg-white/[0.015]">
        {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)} spellCheck={false}
        onScroll={e => { if (gutterRef.current) gutterRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop; }}
        className="flex-1 resize-none bg-transparent py-4 px-3 font-mono text-[12px] leading-[1.6] text-white/75 outline-none" />
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, percent, color }: { icon: any; label: string; value: string; sub?: string; percent?: number; color: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3"><Icon className="w-4 h-4" style={{ color }} /><span className="text-xs font-medium text-white/50">{label}</span></div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</span>
        {sub && <span className="text-[11px] text-white/30 mb-1">{sub}</span>}
      </div>
      {percent !== undefined && (
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mt-3">
          <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${color}80, ${color})`, boxShadow: `0 0 8px ${color}40` }} initial={{ width: 0 }} animate={{ width: `${Math.min(percent, 100)}%` }} transition={{ duration: 0.8 }} />
        </div>
      )}
    </div>
  );
}

export const btnPrimary = 'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] bg-orange-500/15 border border-orange-500/25 text-orange-300 hover:bg-orange-500/25 disabled:opacity-40 transition';
export const inputCls = 'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-orange-400/40';
