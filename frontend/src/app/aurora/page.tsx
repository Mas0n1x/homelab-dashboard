/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { Cloud, ExternalLink, RefreshCw } from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';

/**
 * Aurora laeuft als eigener Dienst auf dem Pi und wird same-origin unter
 * /aurora-app/ eingebettet (nginx-Proxy).
 *
 * Keine zweite Anmeldung: der Dashboard-nginx weist sich gegenueber Aurora als
 * vertrauenswuerdiger Reverse-Proxy aus (geteiltes Header-Secret, AURORA_PROXY_AUTH_*).
 * Aurora legt dann automatisch eine Sitzung fuer das hinterlegte Konto an. Der
 * Dashboard-Login davor schuetzt den Zugang.
 */
export default function AuroraPage() {
  const [neuLaden, setNeuLaden] = useState(0);

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
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-black/20 h-[calc(100dvh-14rem)] md:h-[calc(100dvh-9.5rem)] min-h-[420px]">
          <iframe
            key={neuLaden}
            src="/aurora-app/"
            title="Aurora"
            className="w-full h-full border-0"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        </div>
      </div>
    </PageTransition>
  );
}
