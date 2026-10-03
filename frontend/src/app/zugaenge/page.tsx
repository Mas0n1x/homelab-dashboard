/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';
import { KeyRound, LogIn, Loader2, Briefcase, ShoppingCart, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';
import { GlassCard } from '@/components/ui/GlassCard';
import { getSsoTargets, createSsoLink, type SsoTarget } from '@/lib/api';

const ICONS: Record<string, React.ReactNode> = {
  portfolio: <Briefcase className="w-5 h-5 text-accent-light" />,
  salenet: <ShoppingCart className="w-5 h-5 text-accent-light" />,
};

/**
 * Ein Klick → neuer Tab, dort direkt als Admin angemeldet. Das Dashboard holt
 * ein 60-Sekunden-Einmal-Ticket, die Ziel-App löst es unter /api/sso ein.
 */
export default function ZugaengePage() {
  const [ziele, setZiele] = useState<SsoTarget[] | null>(null);
  const [laedt, setLaedt] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    getSsoTargets().then(setZiele).catch(() => setZiele([]));
  }, []);

  const oeffnen = async (ziel: SsoTarget) => {
    setFehler(null);
    setLaedt(ziel.id);
    // Tab sofort im Klick öffnen — nach dem await würde der Popup-Blocker zuschlagen.
    const tab = window.open('about:blank', '_blank');
    try {
      const { url } = await createSsoLink(ziel.id);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch {
      tab?.close();
      setFehler(`${ziel.name}: Anmeldung konnte nicht vorbereitet werden.`);
    } finally {
      setLaedt(null);
    }
  };

  return (
    <PageTransition>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center flex-shrink-0">
            <KeyRound className="w-5 h-5 text-accent-light" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-none">Zugänge</h1>
            <p className="text-sm text-white/40 mt-1 truncate">Mit einem Klick als Admin angemeldet</p>
          </div>
        </div>

        {fehler && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {fehler}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 [&>*]:h-full">
          {(ziele ?? []).map((ziel, i) => (
            <GlassCard key={ziel.id} hover delay={i * 0.05}>
              <div className="flex flex-col h-full gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                    {ICONS[ziel.id] ?? <KeyRound className="w-5 h-5 text-accent-light" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight">{ziel.name}</p>
                    <p className="text-xs text-white/40 mt-0.5 truncate">{ziel.beschreibung}</p>
                  </div>
                </div>

                <div className="mt-auto">
                  {ziel.konfiguriert ? (
                    <button
                      onClick={() => oeffnen(ziel)}
                      disabled={laedt === ziel.id}
                      className={clsx(
                        'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                        'bg-accent/20 border border-accent/30 text-accent-light hover:bg-accent/30 disabled:opacity-60'
                      )}
                    >
                      {laedt === ziel.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <LogIn className="w-4 h-4" />}
                      Als Admin öffnen
                    </button>
                  ) : (
                    <p className="text-xs text-amber-300/80 px-1 py-2.5 text-center">
                      Noch nicht eingerichtet — SSO-Geheimnis fehlt in der .env
                    </p>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
