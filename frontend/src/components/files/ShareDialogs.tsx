/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Check, Loader2, Lock, Trash2, Link2, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import * as api from '@/lib/api';
import { formatBytes, formatDateTime } from '@/lib/formatters';

const DAUER = [
  { label: '1 Stunde', value: 1 },
  { label: '1 Tag', value: 24 },
  { label: '7 Tage', value: 24 * 7 },
  { label: '30 Tage', value: 24 * 30 },
  { label: 'Unbegrenzt', value: 0 },
];

const feld = 'w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 outline-none focus:border-accent/30 transition-colors';

function CopyButton({ text }: { text: string }) {
  const [kopiert, setKopiert] = useState(false);
  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ohne HTTPS/Berechtigung: über ein verstecktes Feld kopieren
      const t = document.createElement('textarea');
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setKopiert(true);
    setTimeout(() => setKopiert(false), 1800);
  };
  return (
    <button onClick={kopieren} title="Link kopieren" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-accent/15 hover:bg-accent/25 text-accent-light transition-colors flex-shrink-0">
      {kopiert ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {kopiert ? 'Kopiert' : 'Kopieren'}
    </button>
  );
}

/** Link für eine Datei anlegen. `target` = null schließt den Dialog. */
export function ShareCreateModal({ target, onClose }: { target: { serverId: string; path: string; name: string } | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [dauer, setDauer] = useState(24 * 7);
  const [passwort, setPasswort] = useState('');
  const [limit, setLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<api.ShareInfo | null>(null);

  const schliessen = () => {
    setErgebnis(null);
    setPasswort('');
    setLimit('');
    setFehler(null);
    setDauer(24 * 7);
    onClose();
  };

  const anlegen = async () => {
    if (!target) return;
    setBusy(true);
    setFehler(null);
    try {
      const s = await api.createShare({
        serverId: target.serverId,
        path: target.path,
        expiresInHours: dauer === 0 ? null : dauer,
        password: passwort || undefined,
        maxDownloads: limit ? Number(limit) : null,
      });
      setErgebnis(s);
      queryClient.invalidateQueries({ queryKey: ['shares'] });
    } catch (e: any) {
      setFehler(e.message || 'Freigabe fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const link = ergebnis ? api.shareUrl(ergebnis.token) : '';

  return (
    <Modal isOpen={!!target} onClose={schliessen} title="Datei teilen" size="md">
      {target && !ergebnis && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-white/70 min-w-0">
            <Link2 className="w-4 h-4 text-cyan-400/70 flex-shrink-0" />
            <span className="truncate">{target.name}</span>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs text-white/40">Link gültig für</span>
            <select value={dauer} onChange={e => setDauer(Number(e.target.value))} className={feld}>
              {DAUER.map(d => <option key={d.value} value={d.value} className="bg-[#12122a]">{d.label}</option>)}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-white/40">Passwort (optional)</span>
            <input type="text" value={passwort} onChange={e => setPasswort(e.target.value)} placeholder="Leer lassen = kein Passwort" autoComplete="off" className={feld} />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-white/40">Maximale Downloads (optional)</span>
            <input type="number" min={1} value={limit} onChange={e => setLimit(e.target.value)} placeholder="Unbegrenzt" className={feld} />
          </label>

          {fehler && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{fehler}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={schliessen} className="px-4 py-2 text-sm rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/60 transition-colors">Abbrechen</button>
            <button onClick={anlegen} disabled={busy || (!!passwort && passwort.length < 4)} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-light font-medium transition-colors disabled:opacity-30">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Link erstellen
            </button>
          </div>
        </div>
      )}

      {ergebnis && (
        <div className="space-y-4">
          <p className="text-sm text-white/60">Jeder mit diesem Link kann die Datei herunterladen{ergebnis.passwort ? ' (Passwort nötig)' : ''}.</p>
          <div className="flex items-center gap-2">
            <input readOnly value={link} onFocus={e => e.currentTarget.select()} className={`${feld} font-mono text-xs`} />
            <CopyButton text={link} />
          </div>
          <p className="text-xs text-white/30">
            {ergebnis.expiresAt ? `Gültig bis ${formatDateTime(ergebnis.expiresAt)}` : 'Ohne Ablaufdatum'}
            {ergebnis.maxDownloads ? ` · maximal ${ergebnis.maxDownloads} Downloads` : ''}
          </p>
          <div className="flex justify-end">
            <button onClick={schliessen} className="px-4 py-2 text-sm rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/60 transition-colors">Fertig</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Liste aller aktiven Links mit Widerrufen. */
export function SharesListModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['shares'], queryFn: api.listShares, enabled: open });

  const widerrufen = async (s: api.ShareInfo) => {
    if (!confirm(`Link zu "${s.name}" widerrufen? Er funktioniert danach nicht mehr.`)) return;
    await api.revokeShare(s.id);
    queryClient.invalidateQueries({ queryKey: ['shares'] });
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Freigaben" size="lg">
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
      ) : !data?.length ? (
        <p className="text-sm text-white/40 text-center py-10">Noch keine Links erstellt. In der Dateiliste auf das Teilen-Symbol klicken.</p>
      ) : (
        <div className="divide-y divide-white/[0.05] max-h-[60vh] overflow-y-auto">
          {data.map(s => (
            <div key={s.id} className="py-3 flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-white/80 truncate">{s.name}</span>
                  {s.passwort && <Lock className="w-3 h-3 text-amber-400/70 flex-shrink-0" />}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${s.status === 'aktiv' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.06] text-white/40'}`}>
                    {s.status === 'aktiv' ? 'Aktiv' : 'Beendet'}
                  </span>
                </div>
                <p className="text-[11px] text-white/30">
                  {s.size != null ? `${formatBytes(s.size)} · ` : ''}
                  {s.downloads}{s.maxDownloads ? ` / ${s.maxDownloads}` : ''} Downloads ·{' '}
                  {s.expiresAt ? `bis ${formatDateTime(s.expiresAt)}` : 'ohne Ablauf'}
                </p>
              </div>
              {s.status === 'aktiv' && <CopyButton text={api.shareUrl(s.token)} />}
              <button onClick={() => widerrufen(s)} title="Widerrufen" className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
