'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string | null;
  color: string;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const COLORS = ['indigo', 'emerald', 'amber', 'red', 'cyan', 'pink', 'purple'];
const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500',
  red: 'bg-red-500', cyan: 'bg-cyan-500', pink: 'bg-pink-500', purple: 'bg-purple-500',
};
const COLOR_TEXT: Record<string, string> = {
  indigo: 'text-indigo-400', emerald: 'text-emerald-400', amber: 'text-amber-400',
  red: 'text-red-400', cyan: 'text-cyan-400', pink: 'text-pink-400', purple: 'text-purple-400',
};

export function CalendarWidget() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [form, setForm] = useState({ title: '', time: '', color: 'indigo', description: '' });

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar', year, month],
    queryFn: () => api.getCalendarEvents(month, year) as Promise<CalendarEvent[]>,
    staleTime: 30000,
  });

  const addMutation = useMutation({
    mutationFn: () => api.addCalendarEvent({ ...form, date: selectedDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setShowAdd(false);
      setForm({ title: '', time: '', color: 'indigo', description: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCalendarEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });

  // Calendar grid
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Monday = 0
  const totalDays = lastDay.getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const eventMap = new Map<string, CalendarEvent[]>();
  events.forEach(e => {
    if (!eventMap.has(e.date)) eventMap.set(e.date, []);
    eventMap.get(e.date)!.push(e);
  });

  const prev = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Upcoming events (next 7 days)
  const upcomingEvents = events
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
    .slice(0, 5);

  return (
    <GlassCard delay={0.3} hover>
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={prev} className="p-1 rounded hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium w-36 text-center">{MONTHS[month - 1]} {year}</span>
            <button onClick={next} className="p-1 rounded hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => { setSelectedDate(todayStr); setShowAdd(true); }}
            className="p-1 rounded hover:bg-white/[0.06] text-white/40 hover:text-accent-light transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-[9px] text-white/30 text-center font-medium py-0.5">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {Array(startPad).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
          {Array.from({ length: totalDays }, (_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = eventMap.get(dateStr) || [];
            const isToday = dateStr === todayStr;

            return (
              <button
                key={day}
                onClick={() => { setSelectedDate(dateStr); if (dayEvents.length === 0) setShowAdd(true); }}
                className={`relative p-1 rounded-md text-center text-[11px] transition-all hover:bg-white/[0.06] ${
                  isToday ? 'bg-accent/20 text-accent-light font-bold ring-1 ring-accent/30' : 'text-white/60'
                }`}
              >
                {day}
                {dayEvents.length > 0 && (
                  <div className="flex justify-center gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((e, idx) => (
                      <span key={idx} className={`w-1 h-1 rounded-full ${COLOR_MAP[e.color] || 'bg-indigo-500'}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Nächste Termine</span>
            {upcomingEvents.map(e => (
              <div key={e.id} className="flex items-center gap-2 group">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${COLOR_MAP[e.color] || 'bg-indigo-500'}`} />
                <span className="text-[10px] font-mono text-white/30 w-10 flex-shrink-0">
                  {e.date === todayStr ? 'Heute' : new Date(e.date + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                </span>
                {e.time && <span className="text-[10px] text-white/20 font-mono w-10 flex-shrink-0">{e.time}</span>}
                <span className={`text-xs truncate flex-1 ${COLOR_TEXT[e.color] || 'text-white/60'}`}>{e.title}</span>
                <button
                  onClick={() => deleteMutation.mutate(e.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Event Form */}
        {showAdd && (
          <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">
                Neuer Termin - {new Date(selectedDate + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}
              </span>
              <button onClick={() => setShowAdd(false)} className="p-0.5 rounded hover:bg-white/[0.06] text-white/30">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              className="glass-input w-full text-xs"
              placeholder="Titel"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              autoFocus
            />
            <div className="flex gap-2">
              <input
                className="glass-input flex-1 text-xs"
                type="time"
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
              />
              <div className="flex gap-1 items-center">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-4 h-4 rounded-full ${COLOR_MAP[c]} transition-all ${form.color === c ? 'ring-2 ring-white/40 scale-110' : 'opacity-50 hover:opacity-80'}`}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={() => addMutation.mutate()}
              disabled={!form.title}
              className="btn-primary w-full text-xs py-1.5 disabled:opacity-30"
            >
              Hinzufügen
            </button>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
