/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Play, Plus, Trash2 } from 'lucide-react';
import { type Api, Toggle, btnPrimary, fmtDate, inputCls } from './shared';

interface Task { id: number; action: string; payload: string; offset: number }
interface Schedule {
  id: number; name: string; active: boolean; processing: boolean; onlyWhenOnline: boolean;
  cron: { minute: string; hour: string; day_of_month: string; month: string; day_of_week: string };
  lastRun: string | null; nextRun: string | null; tasks: Task[];
}

const AKTION: Record<string, string> = { command: 'Befehl', power: 'Power', backup: 'Backup' };
const POWER: Record<string, string> = { start: 'Start', stop: 'Stopp', restart: 'Neustart', kill: 'Abbruch' };
const TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// Cron lesbar machen — die häufigen Fälle ausformuliert, der Rest bleibt als Ausdruck stehen.
function cronText(c: Schedule['cron']): string {
  const pad = (v: string) => v.padStart(2, '0');
  if (/^\d+$/.test(c.minute) && /^\d+$/.test(c.hour) && c.day_of_month === '*' && c.month === '*') {
    const zeit = `${pad(c.hour)}:${pad(c.minute)} Uhr`;
    if (c.day_of_week === '*') return `täglich um ${zeit}`;
    if (/^[0-6](,[0-6])*$/.test(c.day_of_week)) return `${c.day_of_week.split(',').map(d => TAGE[+d]).join(', ')} um ${zeit}`;
  }
  const m = /^\*\/(\d+)$/.exec(c.minute);
  if (m && c.hour === '*' && c.day_of_month === '*' && c.month === '*' && c.day_of_week === '*') return `alle ${m[1]} Minuten`;
  const h = /^\*\/(\d+)$/.exec(c.hour);
  if (h && /^\d+$/.test(c.minute) && c.day_of_month === '*' && c.month === '*' && c.day_of_week === '*') return `alle ${h[1]} Stunden (Minute ${c.minute})`;
  return `${c.minute} ${c.hour} ${c.day_of_month} ${c.month} ${c.day_of_week}`;
}

function taskText(t: Task) {
  if (t.action === 'command') return `Befehl: ${t.payload}`;
  if (t.action === 'power') return `Power: ${POWER[t.payload] || t.payload}`;
  return `Backup${t.payload ? ` (ignoriert: ${t.payload})` : ''}`;
}

export function SchedulesPanel({ api, flash }: { api: Api; flash: (m: string) => void }) {
  const [list, setList] = useState<Schedule[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<'daily' | 'interval'>('daily');
  const [time, setTime] = useState('04:00');
  const [minutes, setMinutes] = useState(60);
  const [action, setAction] = useState<'command' | 'power' | 'backup'>('command');
  const [payload, setPayload] = useState('');
  const [signal, setSignal] = useState('restart');

  const load = useCallback(async () => {
    const r = await api('/schedules');
    setLoaded(true);
    if (r.error) { flash(r.error); return; }
    setList(r.schedules || []);
  }, [api, flash]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) { flash('Bitte einen Namen vergeben'); return; }
    if (action === 'command' && !payload.trim()) { flash('Bitte einen Befehl eingeben'); return; }
    let cron;
    if (type === 'daily') {
      const [h, m] = time.split(':').map(n => String(parseInt(n, 10) || 0));
      cron = { minute: m, hour: h, day_of_month: '*', month: '*', day_of_week: '*' };
    } else {
      const n = Math.min(Math.max(minutes, 1), 59 * 24);
      cron = n < 60
        ? { minute: `*/${n}`, hour: '*', day_of_month: '*', month: '*', day_of_week: '*' }
        : { minute: '0', hour: `*/${Math.max(1, Math.round(n / 60))}`, day_of_month: '*', month: '*', day_of_week: '*' };
    }
    const task = { action, payload: action === 'command' ? payload.trim() : action === 'power' ? signal : '' };
    setBusy(true);
    const r = await api('/schedules', { method: 'POST', body: JSON.stringify({ name: name.trim(), cron, task }) });
    setBusy(false);
    if (r.ok) { flash('Zeitplan angelegt'); setName(''); setPayload(''); load(); } else flash(r.error || 'Fehler');
  };

  const toggle = async (s: Schedule) => {
    setList(l => l.map(x => x.id === s.id ? { ...x, active: !s.active } : x));
    const r = await api(`/schedules/${s.id}`, { method: 'PUT', body: JSON.stringify({ active: !s.active }) });
    if (r.error) { flash(r.error); load(); }
  };
  const run = async (s: Schedule) => {
    const r = await api(`/schedules/${s.id}/run`, { method: 'POST' });
    flash(r.ok ? `„${s.name}“ wird ausgeführt` : r.error || 'Fehler');
    setTimeout(load, 1500);
  };
  const remove = async (s: Schedule) => {
    if (!confirm(`Zeitplan „${s.name}“ löschen?`)) return;
    const r = await api(`/schedules/${s.id}`, { method: 'DELETE' });
    if (r.error) flash(r.error); else load();
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2"><Plus className="w-4 h-4 text-orange-400/80" /><h3 className="text-sm font-medium text-white/70">Neuer Zeitplan</h3></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (z. B. Nächtlicher Neustart)" className={inputCls} />
          <div className="flex items-center gap-2">
            <select value={type} onChange={e => setType(e.target.value as any)} className={`${inputCls} flex-1`}>
              <option value="daily">täglich um</option>
              <option value="interval">alle … Minuten</option>
            </select>
            {type === 'daily'
              ? <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} />
              : <input type="number" min={1} value={minutes} onChange={e => setMinutes(parseInt(e.target.value, 10) || 1)} className={`${inputCls} w-24`} />}
          </div>
          <select value={action} onChange={e => setAction(e.target.value as any)} className={inputCls}>
            <option value="command">Befehl senden</option>
            <option value="power">Power-Aktion</option>
            <option value="backup">Backup erstellen</option>
          </select>
          {action === 'command' && <input value={payload} onChange={e => setPayload(e.target.value)} placeholder="Befehl, z. B. say Neustart in 5 Minuten" className={`${inputCls} font-mono`} />}
          {action === 'power' && (
            <select value={signal} onChange={e => setSignal(e.target.value)} className={inputCls}>
              {Object.entries(POWER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
        </div>
        <div className="flex justify-end"><button disabled={busy} onClick={create} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Anlegen</button></div>
      </div>

      <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
        {loaded && list.length === 0 && <p className="text-sm text-white/30 p-5 text-center">Noch keine Zeitpläne.</p>}
        {list.map(s => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3">
            <CalendarClock className={`w-4 h-4 flex-shrink-0 ${s.active ? 'text-orange-400/80' : 'text-white/25'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${s.active ? 'text-white/80' : 'text-white/40'}`}>{s.name}</p>
              <p className="text-[11px] text-white/30 truncate">{cronText(s.cron)}{s.tasks.length ? ` · ${s.tasks.map(taskText).join(' → ')}` : ' · keine Aufgabe'}</p>
              <p className="text-[11px] text-white/20">{s.active && s.nextRun ? `nächster Lauf ${fmtDate(s.nextRun)}` : 'pausiert'}{s.lastRun ? ` · zuletzt ${fmtDate(s.lastRun)}` : ''}</p>
            </div>
            <button onClick={() => run(s)} disabled={s.processing} title="Jetzt ausführen" className="p-2 rounded-lg text-white/30 hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-30 transition"><Play className="w-4 h-4" /></button>
            <Toggle checked={s.active} onChange={() => toggle(s)} />
            <button onClick={() => remove(s)} title="Löschen" className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
