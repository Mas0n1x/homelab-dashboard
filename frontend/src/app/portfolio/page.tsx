'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, FileText, CreditCard, TrendingUp, Calendar, ExternalLink, ArrowUpRight, Clock } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { StatusBadge } from '@/components/ui/StatusBadge';
import * as api from '@/lib/api';
import { formatCurrency, formatTimeAgo } from '@/lib/formatters';
import type { PortfolioData, PortfolioRequest } from '@/lib/types';

export default function PortfolioPage() {
  const queryClient = useQueryClient();

  const portfolioWs = queryClient.getQueryData<PortfolioData>(['portfolio']);

  const { data: portfolio } = useQuery({
    queryKey: ['portfolioDashboard'],
    queryFn: () => api.getPortfolioDashboard() as Promise<PortfolioData>,
    refetchInterval: 30000,
  });

  const { data: requests } = useQuery({
    queryKey: ['portfolioRequests'],
    queryFn: () => api.getPortfolioRequests() as Promise<PortfolioRequest[]>,
    refetchInterval: 30000,
  });

  const { data: appointments } = useQuery({
    queryKey: ['portfolioAppointments'],
    queryFn: () => api.getPortfolioAppointments(),
    refetchInterval: 60000,
  });

  const stats = portfolioWs?.stats || portfolio?.stats;
  const activities = portfolioWs?.activities || portfolio?.activities || [];

  const statusColors: Record<string, string> = {
    new: 'text-blue-400',
    in_progress: 'text-amber-400',
    completed: 'text-emerald-400',
    cancelled: 'text-red-400',
  };

  const statusLabels: Record<string, string> = {
    new: 'Neu',
    in_progress: 'In Bearbeitung',
    completed: 'Abgeschlossen',
    cancelled: 'Abgebrochen',
    pending: 'Ausstehend',
    confirmed: 'Bestätigt',
  };

  // Revenue chart data
  const revenueData = [
    { name: 'Bezahlt', value: stats?.paidRevenue || 0, fill: 'rgba(16,185,129,0.6)' },
    { name: 'Offen', value: stats?.openRevenue || 0, fill: 'rgba(99,102,241,0.6)' },
    { name: 'Überfällig', value: stats?.overdueRevenue || 0, fill: 'rgba(239,68,68,0.6)' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Portfolio</h1>
          <p className="text-sm text-white/40 mt-0.5">mas0n1x.online Admin Panel</p>
        </div>
        <a
          href="https://mas0n1x.online/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Admin Panel öffnen
        </a>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard delay={0.05} glow="indigo" hover>
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Projekte</span>
            <FileText className="w-4 h-4 text-accent-light/50" />
          </div>
          <span className="stat-value text-accent-light">
            <AnimatedNumber value={stats?.projects || 0} />
          </span>
        </GlassCard>

        <GlassCard delay={0.1} glow="cyan" hover>
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Kunden</span>
            <Users className="w-4 h-4 text-cyan-400/50" />
          </div>
          <span className="stat-value text-cyan-400">
            <AnimatedNumber value={stats?.customers || 0} />
          </span>
        </GlassCard>

        <GlassCard delay={0.15} hover>
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Offene Anfragen</span>
            <ArrowUpRight className="w-4 h-4 text-amber-400/50" />
          </div>
          <span className="stat-value text-amber-400">
            <AnimatedNumber value={stats?.openRequests || 0} />
          </span>
        </GlassCard>

        <GlassCard delay={0.2} glow="emerald" hover>
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Umsatz</span>
            <CreditCard className="w-4 h-4 text-emerald-400/50" />
          </div>
          <span className="text-2xl font-bold text-emerald-400">
            {formatCurrency(stats?.totalRevenue || 0)}
          </span>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <GlassCard delay={0.25}>
          <h3 className="text-sm font-semibold mb-4">Umsatz-Übersicht</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15,15,35,0.9)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(v: number) => [formatCurrency(v), 'Betrag']}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Recent Requests */}
        <GlassCard delay={0.3}>
          <h3 className="text-sm font-semibold mb-4">Aktuelle Anfragen</h3>
          <div className="space-y-3 max-h-[240px] overflow-y-auto">
            {(requests || []).slice(0, 6).map((req) => (
              <div key={req.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{req.name}</p>
                  <p className="text-xs text-white/30">{req.project_type} | {req.budget}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <span className={`text-xs font-medium ${statusColors[req.status] || 'text-white/40'}`}>
                    {statusLabels[req.status] || req.status}
                  </span>
                  <p className="text-[10px] text-white/20">{formatTimeAgo(req.created_at)}</p>
                </div>
              </div>
            ))}
            {(!requests || requests.length === 0) && (
              <p className="text-sm text-white/30 text-center py-4">Keine Anfragen vorhanden</p>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Feed */}
        <GlassCard delay={0.35}>
          <h3 className="text-sm font-semibold mb-4">Letzte Aktivitäten</h3>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {activities.slice(0, 8).map((act, i) => (
              <div key={act.id || i} className="flex items-start gap-3 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-light mt-1.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white/70">{act.description}</p>
                  <p className="text-[10px] text-white/25">{formatTimeAgo(act.created_at)}</p>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <p className="text-sm text-white/30 text-center py-4">Keine Aktivitäten</p>
            )}
          </div>
        </GlassCard>

        {/* Appointments */}
        <GlassCard delay={0.4}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Nächste Termine</h3>
            <Calendar className="w-4 h-4 text-white/30" />
          </div>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {(appointments as any[] || []).slice(0, 6).map((apt: any) => (
              <div key={apt.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                <Clock className="w-4 h-4 text-accent-light/50 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{apt.name || apt.customer_name}</p>
                  <p className="text-xs text-white/30">{apt.date} {apt.time}</p>
                </div>
                <span className={`text-xs flex-shrink-0 ${statusColors[apt.status] || 'text-white/40'}`}>
                  {statusLabels[apt.status] || apt.status}
                </span>
              </div>
            ))}
            {(!appointments || (appointments as any[]).length === 0) && (
              <p className="text-sm text-white/30 text-center py-4">Keine Termine</p>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
