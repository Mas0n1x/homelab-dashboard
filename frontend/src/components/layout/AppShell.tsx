/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Background } from './Background';

interface AppShellProps {
  children: React.ReactNode;
  connected: boolean;
}

export function AppShell({ children, connected }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync with sidebar collapsed state via localStorage
  useEffect(() => {
    const checkCollapsed = () => {
      setSidebarCollapsed(localStorage.getItem('sidebar-collapsed') === 'true');
    };
    checkCollapsed();
    window.addEventListener('storage', checkCollapsed);
    // Also poll for changes from same-tab updates
    const interval = setInterval(checkCollapsed, 300);
    return () => {
      window.removeEventListener('storage', checkCollapsed);
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Background />
      <Sidebar />

      {/* Main content area - offset by sidebar width. overflow-x-hidden verhindert,
          dass ein zu breites Kind die ganze Seite horizontal verschiebbar macht. */}
      <div
        className="overflow-x-hidden md:transition-[margin-left] md:duration-300 md:ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ marginLeft: 'var(--sidebar-width, 0px)' }}
      >
        <TopBar connected={connected} />
        <main className="px-4 lg:px-6 py-5 pb-24 md:pb-6 min-h-[calc(100vh-3.5rem)] overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* CSS variable for sidebar width */}
      <style jsx global>{`
        @media (min-width: 768px) {
          :root {
            --sidebar-width: ${sidebarCollapsed ? '68px' : '260px'};
          }
        }
        @media (max-width: 767px) {
          :root {
            --sidebar-width: 0px;
          }
        }
      `}</style>
    </>
  );
}
