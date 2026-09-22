/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';
import { Cloud, ExternalLink, RefreshCw } from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { getAuroraMetrics } from '@/lib/api';

/**
 * Aurora laeuft (sobald wieder aktiv) als eigener Dienst und wird same-origin
 * unter /aurora-app/ eingebettet (nginx-Proxy, siehe nginx/nginx.conf).
 *
 * Aktuell (seit dem Pi-Umzug) ist kein Aurora-Container mehr angebunden —
 * diese Seite prueft beim Laden kurz per /api/aurora/metrics, ob wieder einer
 * erreichbar ist, und zeigt sonst einen Platzhalter statt des Iframes. Sobald
 * Aurora wieder auf dem Pi laeuft und AURORA_METRICS_URL/AURORA_METRICS_TOKEN
 * (bzw. der nginx-Upstream) wieder auf ihn zeigen, erscheint die Seite
 * automatisch wieder live — ohne Code-Aenderung.
 */
export default function AuroraPage() {
  const [neuLaden, setNeuLaden] = useState(0);
  const [verbunden, setVerbunden] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVerbunden(null);
    getAuroraMetrics()
      .then(() => { if (!cancelled) setVerbunden(true); })
      .catch(() => { if (!cancelled) setVerbunden(false); });
    return () => { cancelled = true; };
  }, [neuLaden]);

  return (
    <PageTransition>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center flex-shrink-0">
              <Cloud className="w-5 h-5 text-accent-light" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-none">Aurora</h1>
              <p className="text-sm text-white/40 mt-1 truncate">Deine Self-Hosted Cloud</p>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setNeuLaden((n) => n + 1)}
              className="p-2 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-all"
              title="Neu laden"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {verbunden && (
              <a
                href="/aurora-app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all duration-200"
                title="In neuem Tab oeffnen"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Neuer Tab</span>
              </a>
            )}
          </div>
        </div>

        {verbunden ? (
          <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-black/20 h-[calc(100dvh-14rem)] md:h-[calc(100dvh-9.5rem)] min-h-[420px]">
            <iframe
              key={neuLaden}
              src="/aurora-app/"
              title="Aurora"
              className="w-full h-full border-0"
              allow="clipboard-read; clipboard-write; fullscreen"
            />
          </div>
        ) : (
          <div className="glass-card">
            <div className="relative z-10 p-10 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                <Cloud className="w-6 h-6 text-white/30" />
              </div>
              <h2 className="text-base font-medium text-white/80">
                {verbunden === null ? 'Prüfe Verbindung…' : 'Aurora läuft aktuell nicht'}
              </h2>
              <p className="text-sm text-white/40 max-w-md">
                Aurora läuft aktuell nicht — wird wieder an den Pi angebunden, sobald der Pi neu aufgesetzt ist.
                Diese Seite verbindet sich dann automatisch, sobald Aurora unter <code className="text-white/50">aurora:8080</code>{' '}
                im Docker-Netzwerk erreichbar ist.
              </p>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
