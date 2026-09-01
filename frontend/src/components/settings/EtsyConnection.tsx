/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Package, PlugZap, Unplug, CheckCircle2, AlertTriangle, Copy, Check } from 'lucide-react';
import * as api from '@/lib/api';
import type { EtsyStatus } from '@/lib/types';

/**
 * Etsy verbinden bzw. trennen.
 *
 * Der Anmeldevorgang läuft über Etsy im Browser: „Verbinden" holt die
 * Anmelde-Adresse vom Backend und leitet dorthin weiter. Etsy schickt danach
 * zurück auf `/api/etsy/callback`, das Backend tauscht den Code gegen Tokens
 * und leitet wieder hierher — mit einem Ergebnis in der Adresszeile.
 */
export function EtsyConnection() {
  const queryClient = useQueryClient();
  const [kopiert, setKopiert] = useState(false);
  const [rueckmeldung, setRueckmeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);

  const { data: status } = useQuery<EtsyStatus>({
    queryKey: ['etsy-status'],
    queryFn: api.getEtsyStatus,
    retry: false,
  });

  // Ergebnis des Rückrufs auswerten und die Parameter danach aus der Adresse
  // nehmen — sonst steht die Meldung nach jedem Neuladen wieder da.
  //
  // Bewusst über window.location statt useSearchParams: der Hook zwingt eine
  // statisch vorgerenderte Seite in Next 14 unter eine Suspense-Grenze, und
  // hier wird der Wert ohnehin nur ein einziges Mal nach dem Rückruf gebraucht.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ergebnis = params.get('etsy');
    if (!ergebnis) return;

    if (ergebnis === 'ok') {
      const shop = params.get('shop');
      setRueckmeldung({ art: 'ok', text: shop ? `Verbunden mit „${shop}".` : 'Verbindung hergestellt.' });
      queryClient.invalidateQueries({ queryKey: ['etsy-status'] });
      queryClient.invalidateQueries({ queryKey: ['etsy-orders'] });
    } else {
      setRueckmeldung({
        art: 'fehler',
        text: params.get('grund') || (ergebnis === 'abgelehnt' ? 'Zugriff bei Etsy abgelehnt.' : 'Verbindung fehlgeschlagen.'),
      });
    }

    window.history.replaceState({}, '', window.location.pathname);
  }, [queryClient]);

  const verbinden = useMutation({
    mutationFn: api.connectEtsy,
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (e: Error) => setRueckmeldung({ art: 'fehler', text: e.message }),
  });

  const trennen = useMutation({
    mutationFn: api.disconnectEtsy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etsy-status'] });
      queryClient.invalidateQueries({ queryKey: ['etsy-orders'] });
      setRueckmeldung({ art: 'ok', text: 'Verbindung getrennt.' });
    },
  });

  const kopiereRedirect = () => {
    if (!status?.redirectUri) return;
    navigator.clipboard.writeText(status.redirectUri).then(() => {
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    }).catch(() => { /* Zwischenablage nicht verfügbar */ });
  };

  return (
    <div className="relative z-10">
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-white/[0.06]">
        <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
          <Package className="w-4 h-4 text-orange-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">Etsy — PrintOasis3D</p>
          <p className="text-xs text-white/40">Offene Bestellungen auf der Startseite</p>
        </div>
        {status?.connected && (
          <span className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/12 border border-emerald-400/25 text-[11px] text-emerald-300 flex-shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            Verbunden
          </span>
        )}
      </div>

      {rueckmeldung && (
        <div className={clsx(
          'flex items-start gap-2.5 p-3 rounded-xl border mb-4',
          rueckmeldung.art === 'ok'
            ? 'border-emerald-400/20 bg-emerald-500/[0.06]'
            : 'border-red-400/20 bg-red-500/[0.06]',
        )}>
          {rueckmeldung.art === 'ok'
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            : <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
          <p className={clsx('text-[12px]', rueckmeldung.art === 'ok' ? 'text-emerald-200/80' : 'text-red-200/80')}>
            {rueckmeldung.text}
          </p>
        </div>
      )}

      {!status?.configured ? (
        // Ohne App-Registrierung geht bei Etsy gar nichts — es gibt keinen
        // einfachen API-Schlüssel. Die Schritte stehen deshalb hier.
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06]">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-200/80">
              Noch nicht eingerichtet. Etsy verlangt eine eigene App — ein reiner API-Schlüssel reicht nicht.
            </p>
          </div>

          <ol className="text-[12px] text-white/50 space-y-2 list-decimal pl-4">
            <li>
              Auf{' '}
              <a href="https://www.etsy.com/developers/your-apps" target="_blank" rel="noreferrer" className="text-accent-light hover:underline">
                etsy.com/developers/your-apps
              </a>{' '}
              eine App anlegen.
            </li>
            <li>
              Dort als Rückruf-Adresse <span className="font-mono text-white/70">https://dash.mas0n1x.online/api/etsy/callback</span> eintragen
              — exakt so, HTTPS ist Pflicht.
            </li>
            <li>
              <span className="font-mono text-white/70">ETSY_KEYSTRING</span>,{' '}
              <span className="font-mono text-white/70">ETSY_SHARED_SECRET</span> und{' '}
              <span className="font-mono text-white/70">ETSY_REDIRECT_URI</span> in die <span className="font-mono text-white/70">.env</span> setzen.
            </li>
            <li>Backend neu bauen, dann erscheint hier der Verbinden-Knopf.</li>
          </ol>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Rückruf-Adresse (muss in der Etsy-App stehen)</label>
            <div className="flex items-center gap-2">
              <input className="glass-input flex-1 min-w-0 font-mono text-[12px]" value={status.redirectUri || ''} readOnly />
              <button
                onClick={kopiereRedirect}
                className="btn-glass p-2.5 flex-shrink-0"
                title="Kopieren"
              >
                {kopiert ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {status.connected && status.shopName && (
            <p className="text-[12px] text-white/50">
              Shop: <span className="text-white/80">{status.shopName}</span>
              {status.shopId && <span className="text-white/30"> (#{status.shopId})</span>}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {status.connected ? (
              <button
                onClick={() => { if (confirm('Verbindung zu Etsy wirklich trennen?')) trennen.mutate(); }}
                disabled={trennen.isPending}
                className="btn-glass flex items-center gap-2 text-xs disabled:opacity-40"
              >
                <Unplug className="w-3.5 h-3.5" />
                Verbindung trennen
              </button>
            ) : (
              <button
                onClick={() => verbinden.mutate()}
                disabled={verbinden.isPending}
                className="btn-primary flex items-center gap-2 text-xs disabled:opacity-40"
              >
                <PlugZap className="w-3.5 h-3.5" />
                {verbinden.isPending ? 'Leitet weiter …' : 'Mit Etsy verbinden'}
              </button>
            )}
          </div>

          <p className="text-[11px] text-white/25">
            Gelesen werden nur Bestellungen und Shop-Daten ({status.scopes.join(', ')}). Das Zugriffs-Token
            hält eine Stunde und wird selbstständig aufgefrischt; nach 90 Tagen ohne Nutzung ist eine neue
            Verbindung nötig.
          </p>
        </div>
      )}
    </div>
  );
}
