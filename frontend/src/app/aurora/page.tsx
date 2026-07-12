/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { Cloud, ExternalLink } from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';

// Aurora läuft als eigener Dienst auf dem Pi und wird same-origin unter
// /aurora-app/ eingebettet (nginx-Proxy). So sind alle Funktionen 1:1 verfügbar
// und das Login-Cookie funktioniert (gleiche Herkunft wie das Dashboard).
export default function AuroraPage() {
  return (
    <PageTransition>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-accent-light" />
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-none">Aurora</h1>
              <p className="text-sm text-white/40 mt-1">Deine Self-Hosted Cloud</p>
            </div>
          </div>
          <a
            href="/aurora-app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all duration-200"
            title="In neuem Tab öffnen"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Neuer Tab</span>
          </a>
        </div>

        <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-black/20 h-[calc(100dvh-11rem)] min-h-[480px]">
          <iframe
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
