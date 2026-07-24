/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Activity, Box, Mail, Settings, ChevronLeft, ChevronRight,
  Server, Terminal, FileText, Wrench, LayoutDashboard, ChevronDown,
  Cpu,
  Gamepad2,
  Globe,
  Cloud,
  Bot,
  Menu, X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useServerStore } from '@/stores/serverStore';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface ServerSubNav {
  href: (id: string) => string;
  label: string;
  icon: React.ReactNode;
}

const SERVER_SUB_NAV: ServerSubNav[] = [
  { href: (id) => `/server/${id}`, label: 'Overview', icon: <Cpu className="w-4 h-4" /> },
  { href: (id) => `/server/${id}/docker`, label: 'Docker', icon: <Box className="w-4 h-4" /> },
  { href: (id) => `/server/${id}/logs`, label: 'Logs', icon: <FileText className="w-4 h-4" /> },
  { href: (id) => `/server/${id}/maintenance`, label: 'Wartung', icon: <Wrench className="w-4 h-4" /> },
];

const TOOL_NAV: NavItem[] = [
  { href: '/status', label: 'Status', icon: <Activity className="w-4 h-4" /> },
  { href: '/terminal', label: 'Terminal', icon: <Terminal className="w-4 h-4" /> },
  { href: '/mail', label: 'Mail', icon: <Mail className="w-4 h-4" /> },
  { href: '/minecraft', label: 'Minecraft', icon: <Gamepad2 className="w-4 h-4" /> },
  { href: '/bots', label: 'Discord-Bots', icon: <Bot className="w-4 h-4" /> },
  { href: '/traffic', label: 'Traffic', icon: <Globe className="w-4 h-4" /> },
  { href: '/aurora', label: 'Aurora', icon: <Cloud className="w-4 h-4" /> },
];

const SYSTEM_NAV: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const { servers } = useServerStore();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedServers, setExpandedServers] = useState<Record<string, boolean>>({});

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  const toggleServer = (id: string) => {
    setExpandedServers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isActive = (href: string) => pathname === href;
  const isServerActive = (serverId: string) => pathname.startsWith(`/server/${serverId}`);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          'hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-50 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          collapsed ? 'w-[68px]' : 'w-[260px]'
        )}
      >
        {/* Glass background */}
        <div className="absolute inset-0 sidebar-glass" />
        {/* Right border gradient */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-white/[0.08] via-white/[0.04] to-transparent" />

        <div className="relative z-10 flex flex-col h-full">
          {/* Logo Area */}
          <div className="flex items-center h-16 px-4 flex-shrink-0">
            <Link href="/" className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/25 flex items-center justify-center flex-shrink-0 sidebar-logo-glow">
                <Activity className="w-5 h-5 text-accent-light" />
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="text-base font-semibold whitespace-nowrap overflow-hidden"
                  >
                    Masons Control Center
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>

          {/* Separator */}
          <div className="mx-3 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          {/* Scrollable nav content */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1 scrollbar-hide">
            {/* Fleet Home */}
            <SidebarLink
              href="/"
              icon={<LayoutDashboard className="w-4 h-4" />}
              label="Fleet"
              active={pathname === '/'}
              collapsed={collapsed}
            />

            {/* Separator */}
            <div className="!my-3 mx-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            {/* Servers Section */}
            {!collapsed && (
              <div className="px-2 mb-1">
                <span className="text-[10px] uppercase tracking-widest text-white/25 font-medium">Server</span>
              </div>
            )}

            {servers.map(server => (
              <div key={server.id}>
                <button
                  onClick={() => collapsed ? undefined : toggleServer(server.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 group',
                    isServerActive(server.id)
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                  )}
                  title={collapsed ? server.name : undefined}
                >
                  {/* Status dot */}
                  <div className="relative flex-shrink-0">
                    <Server className="w-4 h-4" />
                    <span
                      className={clsx(
                        'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0a0a1a]',
                        server.status === 'connected'
                          ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                          : 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
                      )}
                    />
                  </div>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left truncate text-[13px]">{server.name}</span>
                      <ChevronDown
                        className={clsx(
                          'w-3 h-3 text-white/30 transition-transform duration-200',
                          expandedServers[server.id] && 'rotate-180'
                        )}
                      />
                    </>
                  )}
                </button>

                {/* Server sub-nav */}
                <AnimatePresence>
                  {!collapsed && expandedServers[server.id] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="ml-4 pl-3 border-l border-white/[0.06] mt-1 space-y-0.5">
                        {SERVER_SUB_NAV.map(sub => {
                          const href = sub.href(server.id);
                          return (
                            <Link
                              key={href}
                              href={href}
                              className={clsx(
                                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-all duration-200',
                                isActive(href)
                                  ? 'bg-white/[0.08] text-white'
                                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                              )}
                            >
                              {sub.icon}
                              <span>{sub.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {/* Separator */}
            <div className="!my-3 mx-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            {/* Tools Section */}
            {!collapsed && (
              <div className="px-2 mb-1">
                <span className="text-[10px] uppercase tracking-widest text-white/25 font-medium">Tools</span>
              </div>
            )}

            {TOOL_NAV.map(item => (
              <SidebarLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={pathname === item.href || pathname.startsWith(item.href + '/')}
                collapsed={collapsed}
              />
            ))}

            {/* Separator */}
            <div className="!my-3 mx-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            {/* System Section */}
            {!collapsed && (
              <div className="px-2 mb-1">
                <span className="text-[10px] uppercase tracking-widest text-white/25 font-medium">System</span>
              </div>
            )}

            {SYSTEM_NAV.map(item => (
              <SidebarLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={pathname === item.href}
                collapsed={collapsed}
              />
            ))}
          </nav>

          {/* Collapse toggle */}
          <div className="flex-shrink-0 p-2 border-t border-white/[0.04]">
            <button
              onClick={toggleCollapsed}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all duration-200 text-sm"
              title={collapsed ? 'Sidebar erweitern' : 'Sidebar einklappen'}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-xs">Einklappen</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav pathname={pathname} />
    </>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  active,
  collapsed,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200',
        active
          ? 'bg-white/[0.08] text-white'
          : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
      )}
      title={collapsed ? label : undefined}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent-light"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      <span className="flex-shrink-0">{icon}</span>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="whitespace-nowrap overflow-hidden text-[13px]"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  const { servers } = useServerStore();
  const [menuOpen, setMenuOpen] = useState(false);

  // Menü-Overlay bei Navigationswechsel schließen
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Body-Scroll sperren solange das Overlay offen ist
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [menuOpen]);

  const MOBILE_NAV = [
    { href: '/', label: 'Fleet', icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: '/status', label: 'Status', icon: <Activity className="w-5 h-5" /> },
    { href: '/terminal', label: 'Terminal', icon: <Terminal className="w-5 h-5" /> },
    { href: '/mail', label: 'Mail', icon: <Mail className="w-5 h-5" /> },
  ];

  const linkCls = (active: boolean) => clsx(
    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
    active ? 'bg-white/[0.08] text-white' : 'text-white/60 active:bg-white/[0.04]'
  );

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.06]">
        <div className="absolute inset-0 sidebar-glass" />
        <div className="relative z-10 grid grid-cols-5 items-center h-16 pb-[env(safe-area-inset-bottom)]">
          {MOBILE_NAV.map(item => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'relative flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors duration-200',
                  active ? 'text-accent-light' : 'text-white/35 active:text-white/60'
                )}
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="mobile-nav-active"
                    className="absolute bottom-0 w-8 h-0.5 rounded-full bg-accent-light"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
          <button
            onClick={() => setMenuOpen(true)}
            className={clsx(
              'flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors duration-200',
              menuOpen ? 'text-accent-light' : 'text-white/35 active:text-white/60'
            )}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">Menü</span>
          </button>
        </div>
      </nav>

      {/* Vollstaendiges Navigations-Overlay (alle Tools + Server-Details) */}
      <AnimatePresence>
        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-[60]">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl border-t border-white/[0.08] overflow-hidden"
            >
              <div className="absolute inset-0 sidebar-glass" />
              <div className="relative z-10 flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
                  <span className="text-base font-semibold">Navigation</span>
                  <button onClick={() => setMenuOpen(false)} className="w-9 h-9 rounded-xl flex items-center justify-center text-white/50 active:bg-white/[0.06]">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mx-4 h-px bg-white/[0.06] flex-shrink-0" />

                <div className="flex-1 overflow-y-auto px-3 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
                  {/* Server mit Unterpunkten */}
                  <div>
                    <p className="px-2 mb-1.5 text-[10px] uppercase tracking-widest text-white/25 font-medium">Server</p>
                    <div className="space-y-2">
                      {servers.map(server => (
                        <div key={server.id} className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-2">
                          <div className="flex items-center gap-2.5 px-2 py-1">
                            <div className="relative flex-shrink-0">
                              <Server className="w-4 h-4 text-white/60" />
                              <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0a0a1a]',
                                server.status === 'connected' ? 'bg-emerald-400' : 'bg-red-400')} />
                            </div>
                            <span className="text-[13px] font-medium truncate">{server.name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 mt-1">
                            {SERVER_SUB_NAV.map(sub => {
                              const href = sub.href(server.id);
                              return (
                                <Link key={href} href={href} className={linkCls(pathname === href)}>
                                  {sub.icon}
                                  <span className="text-[13px]">{sub.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tools */}
                  <div>
                    <p className="px-2 mb-1.5 text-[10px] uppercase tracking-widest text-white/25 font-medium">Tools</p>
                    <div className="grid grid-cols-2 gap-1">
                      {TOOL_NAV.map(item => (
                        <Link key={item.href} href={item.href} className={linkCls(pathname === item.href || pathname.startsWith(item.href + '/'))}>
                          {item.icon}<span>{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* System */}
                  <div>
                    <p className="px-2 mb-1.5 text-[10px] uppercase tracking-widest text-white/25 font-medium">System</p>
                    {SYSTEM_NAV.map(item => (
                      <Link key={item.href} href={item.href} className={linkCls(pathname === item.href)}>
                        {item.icon}<span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
