/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

// Öffentliche Download-Seite eines Freigabelinks — ohne Anmeldung, ohne Dashboard-Hülle.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, Loader2, Lock, FileDown, AlertTriangle, Clock } from 'lucide-react';

interface Info {
  name: string;
  size: number | null;
  expiresAt: string | null;
  needsPassword: boolean;
  restDownloads: number | null;
}

const API = '/api/share';

function groesse(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  const einheiten = ['KB', 'MB', 'GB', 'TB'];
  let wert = bytes / 1024;
  let i = 0;
  while (wert >= 1024 && i < einheiten.length - 1) { wert /= 1024; i++; }
  return `${wert.toLocaleString('de-DE', { maximumFractionDigits: wert < 10 ? 1 : 0 })} ${einheiten[i]}`;
}

function ablauf(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [passwort, setPasswort] = useState('');
  const [busy, setBusy] = useState(false);
  const [gestartet, setGestartet] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    fetch(`${API}/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const daten = await res.json().catch(() => ({}));
        if (abgebrochen) return;
        if (!res.ok) setFehler(daten.error || 'Dieser Link existiert nicht (mehr).');
        else setInfo(daten);
      })
      .catch(() => { if (!abgebrochen) setFehler('Verbindung fehlgeschlagen. Bitte später erneut versuchen.'); });
    return () => { abgebrochen = true; };
  }, [token]);

  const herunterladen = async () => {
    if (!info) return;
    setBusy(true);
    setFehler(null);
    try {
      const res = await fetch(`${API}/${encodeURIComponent(token)}/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwort }),
      });
      const daten = await res.json().catch(() => ({}));
      if (!res.ok) { setFehler(daten.error || 'Download nicht möglich'); return; }
      // Der Browser übernimmt den Download selbst (Fortschritt, große Dateien) — keine Blob-Kopie im Speicher.
      window.location.href = `${API}/${encodeURIComponent(token)}/file?t=${encodeURIComponent(daten.ticket)}`;
      setGestartet(true);
    } catch {
      setFehler('Verbindung fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setBusy(false);
    }
  };

  const fehlerNurSeite = fehler && !info;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'radial-gradient(ellipse at top, #12122a 0%, #0a0a1a 60%)' }}>
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
        {fehlerNurSeite ? (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <AlertTriangle className="w-10 h-10 text-amber-400/70" />
            <h1 className="text-lg font-semibold text-white/90">Link nicht verfügbar</h1>
            <p className="text-sm text-white/50">{fehler}</p>
          </div>
        ) : !info ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <FileDown className="w-7 h-7 text-cyan-400" />
              </div>
              <div className="min-w-0 w-full">
                <h1 className="text-lg font-semibold text-white/90 break-words">{info.name}</h1>
                <p className="text-sm text-white/40 mt-1">{groesse(info.size)}</p>
              </div>
            </div>

            {info.needsPassword && (
              <label className="block space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs text-white/40"><Lock className="w-3 h-3" /> Passwort</span>
                <input
                  type="password"
                  value={passwort}
                  onChange={(e) => setPasswort(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && passwort && herunterladen()}
                  autoFocus
                  autoComplete="off"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 outline-none focus:border-cyan-500/40 transition-colors"
                />
              </label>
            )}

            {fehler && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />{fehler}
              </div>
            )}

            <button
              onClick={herunterladen}
              disabled={busy || (info.needsPassword && !passwort)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 font-medium transition-colors disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {gestartet ? 'Erneut herunterladen' : 'Herunterladen'}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-xs text-white/30">
              <Clock className="w-3 h-3" />
              {info.expiresAt ? `Verfügbar bis ${ablauf(info.expiresAt)}` : 'Ohne Ablaufdatum'}
              {info.restDownloads != null && ` · noch ${info.restDownloads} ${info.restDownloads === 1 ? 'Download' : 'Downloads'}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
