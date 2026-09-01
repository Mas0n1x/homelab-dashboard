/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Cloud, ExternalLink, LogIn, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import * as api from '@/lib/api';

/**
 * Aurora läuft als eigener Dienst auf dem Pi und wird same-origin unter
 * /aurora-app/ eingebettet (nginx-Proxy).
 *
 * Die zweite Anmeldung entfällt: das Dashboard holt sich beim Öffnen ein
 * Aurora-Sitzungscookie über die Durchreiche-Anmeldung. Erst danach wird das
 * Fenster geladen — sonst zeigte Aurora seine eigene Anmeldemaske und der
 * Wechsel wäre wieder da.
 */
export default function AuroraPage() {
  const [bereit, setBereit] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const { data: session, isLoading, refetch } = useQuery({
    queryKey: ['aurora-session'],
    queryFn: api.getAuroraSession,
    retry: false,
    staleTime: 60000,
  });

  const anmelden = useMutation({
    mutationFn: api.auroraSignIn,
    onSuccess: () => { setHinweis(null); setBereit(true); },
    onError: (e: Error) => {
      // Fehlgeschlagene Durchreiche ist kein Grund, die Seite leer zu lassen —
      // Aurora zeigt dann eben seine eigene Anmeldung im Fenster.
      setHinweis(e.message);
      setBereit(true);
    },
  });

  useEffect(() => {
    if (isLoading || !session) return;
    if (session.authenticated) { setBereit(true); return; }
    if (session.ssoConfigured) {
      anmelden.mutate();
    } else {
      setHinweis('Keine Aurora-Zugangsdaten hinterlegt (AURORA_SSO_EMAIL / AURORA_SSO_PASSWORD).');
      setBereit(true);
    }
    // Nur beim ersten brauchbaren Sitzungsstand auslösen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, session?.authenticated, session?.ssoConfigured]);

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
            {hinweis && (
              <button
                onClick={() => { setBereit(false); anmelden.mutate(); }}
                disabled={anmelden.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all disabled:opacity-40"
                title="Anmeldung erneut versuchen"
              >
                <LogIn className={anmelden.isPending ? 'w-4 h-4 animate-pulse' : 'w-4 h-4'} />
                <span className="hidden sm:inline">Anmelden</span>
              </button>
            )}
            <button
              onClick={() => refetch()}
              className="p-2 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-all"
              title="Status prüfen"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
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
        </div>

        {hinweis && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06]">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-200/80">
              Automatische Anmeldung nicht möglich: {hinweis} Du kannst dich unten wie gewohnt selbst anmelden.
            </p>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-black/20 h-[calc(100dvh-14rem)] md:h-[calc(100dvh-9.5rem)] min-h-[420px]">
          {bereit ? (
            <iframe
              src="/aurora-app/"
              title="Aurora"
              className="w-full h-full border-0"
              allow="clipboard-read; clipboard-write; fullscreen"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-white/15 border-t-accent-light rounded-full animate-spin" />
              <p className="text-sm text-white/35">Melde bei Aurora an …</p>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
