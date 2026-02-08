'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, FileText, CreditCard, ExternalLink, ArrowUpRight, Receipt, Mail, Phone, Building } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import * as api from '@/lib/api';
import { formatCurrency, formatTimeAgo } from '@/lib/formatters';
import type { PortfolioData, PortfolioRequest, PortfolioInvoice, PortfolioCustomer } from '@/lib/types';

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

  const { data: invoices } = useQuery({
    queryKey: ['portfolioInvoices'],
    queryFn: () => api.getPortfolioInvoices() as Promise<PortfolioInvoice[]>,
    refetchInterval: 60000,
  });

  const { data: customers } = useQuery({
    queryKey: ['portfolioCustomers'],
    queryFn: () => api.getPortfolioCustomers() as Promise<PortfolioCustomer[]>,
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

  const invoiceStatusColors: Record<string, string> = {
    paid: 'text-emerald-400',
    open: 'text-amber-400',
    overdue: 'text-red-400',
    cancelled: 'text-white/30',
  };

  const invoiceStatusLabels: Record<string, string> = {
    paid: 'Bezahlt',
    open: 'Offen',
    overdue: 'Überfällig',
    cancelled: 'Storniert',
  };

  // Revenue chart data
  const revenueData = [
    { name: 'Bezahlt', value: stats?.paidRevenue || 0, color: '#10b981' },
    { name: 'Offen', value: stats?.openRevenue || 0, color: '#6366f1' },
    { name: 'Überfällig', value: stats?.overdueRevenue || 0, color: '#ef4444' },
  ];
  const maxRevenue = Math.max(...revenueData.map(d => d.value), 1);

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
          <div className="space-y-4">
            {revenueData.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-white/50">{item.name}</span>
                  <span className="text-white/70 font-medium">{formatCurrency(item.value)}</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${maxRevenue > 0 ? (item.value / maxRevenue * 100) : 0}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
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

      {/* Activity Feed + Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        <GlassCard delay={0.4}>
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-4 h-4 text-white/40" />
            <h3 className="text-sm font-semibold">Rechnungen</h3>
          </div>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {(invoices || []).slice(0, 10).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{inv.invoice_number || `#${inv.id}`}</p>
                  <p className="text-xs text-white/30">{inv.customer_name}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-medium">{formatCurrency(inv.amount)}</p>
                  <span className={`text-[10px] font-medium ${invoiceStatusColors[inv.status] || 'text-white/40'}`}>
                    {invoiceStatusLabels[inv.status] || inv.status}
                  </span>
                </div>
              </div>
            ))}
            {(!invoices || invoices.length === 0) && (
              <p className="text-sm text-white/30 text-center py-4">Keine Rechnungen vorhanden</p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Customers */}
      <GlassCard delay={0.45}>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-white/40" />
          <h3 className="text-sm font-semibold">Kunden</h3>
          <span className="text-xs text-white/30 ml-auto">{(customers || []).length} gesamt</span>
        </div>
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {(customers || []).map((cust) => (
            <div key={cust.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{cust.name}</p>
                {cust.company && (
                  <p className="text-xs text-white/40 flex items-center gap-1">
                    <Building className="w-3 h-3" />
                    {cust.company}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                {cust.email && (
                  <span className="text-xs text-white/30 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {cust.email}
                  </span>
                )}
                {cust.phone && (
                  <span className="text-xs text-white/30 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {cust.phone}
                  </span>
                )}
              </div>
            </div>
          ))}
          {(!customers || customers.length === 0) && (
            <p className="text-sm text-white/30 text-center py-4">Keine Kunden vorhanden</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
