/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  KeyRound, LogIn, Loader2, Briefcase, ShoppingCart, AlertTriangle, Plus, Search, Pencil, Copy, Check,
  ExternalLink, Trash2, House,
} from 'lucide-react';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import {
  getSsoTargets, createSsoLink, getZugaenge, addZugang, updateZugang, deleteZugang,
  type SsoTarget, type Zugang, type ZugangEingabe,
} from '@/lib/api';

const ICONS: Record<string, React.ReactNode> = {
  portfolio: <Briefcase className="w-5 h-5 text-accent-light" />,
  salenet: <ShoppingCart className="w-5 h-5 text-accent-light" />,
};

const LEER: ZugangEingabe = { name: '', url: '', kategorie: '', beschreibung: '', benutzer: '' };
const RASTER = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 [&>*]:h-full';
const KNOPF = 'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 bg-accent/20 border border-accent/30 text-accent-light hover:bg-accent/30 disabled:opacity-60';
const FELD = 'w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm outline-none focus:border-accent/50';

/** Private Adressen sind nur zu Hause erreichbar — wird auf der Kachel markiert. */
function nurHeimnetz(url: string) {
  try {
    const host = new URL(url).hostname;
    return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || /\.(local|box|lan)$/.test(host);
  } catch {
    return false;
  }
}

function Kachelkopf({ icon, name, text }: { icon: React.ReactNode; name: string; text: string }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-semibold leading-tight truncate">{name}</p>
        <p className="text-xs text-white/55 mt-0.5 truncate" title={text}>{text}</p>
      </div>
    </div>
  );
}

/**
 * Zentrale zu allen Diensten. Oben die Ein-Klick-Logins (Einmal-Ticket), darunter
 * frei pflegbare Kacheln. Passwörter speichert das Dashboard bewusst nicht.
 */
export default function ZugaengePage() {
  const [ziele, setZiele] = useState<SsoTarget[]>([]);
  const [eintraege, setEintraege] = useState<Zugang[] | null>(null);
  const [suche, setSuche] = useState('');
  const [laedt, setLaedt] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [formular, setFormular] = useState<(ZugangEingabe & { id?: string }) | null>(null);
  const [formFehler, setFormFehler] = useState<string | null>(null);

  const laden = useCallback(() => {
    getZugaenge().then(setEintraege).catch(() => {
      setEintraege([]);
      setFehler('Die Zugänge konnten nicht geladen werden.');
    });
  }, []);

  useEffect(() => {
    getSsoTargets().then(setZiele).catch(() => setZiele([]));
    laden();
  }, [laden]);

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

  const kopieren = async (eintrag: Zugang) => {
    try {
      await navigator.clipboard.writeText(eintrag.benutzer);
      setKopiert(eintrag.id);
      setTimeout(() => setKopiert(null), 1500);
    } catch {
      setFehler('Kopieren wird vom Browser nur über HTTPS erlaubt.');
    }
  };

  const speichern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formular) return;
    const { id, ...daten } = formular;
    try {
      await (id ? updateZugang(id, daten) : addZugang(daten));
      setFormular(null);
      laden();
    } catch (err) {
      setFormFehler(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    }
  };

  const loeschen = async () => {
    if (!formular?.id || !window.confirm(`„${formular.name}“ wirklich entfernen?`)) return;
    try {
      await deleteZugang(formular.id);
      setFormular(null);
      laden();
    } catch {
      setFormFehler('Löschen fehlgeschlagen');
    }
  };

  const bearbeiten = (eintrag: ZugangEingabe & { id?: string }) => {
    setFormFehler(null);
    setFormular(eintrag);
  };

  const begriff = suche.trim().toLowerCase();
  const passt = (...werte: string[]) => !begriff || werte.some((w) => w.toLowerCase().includes(begriff));
  const sso = ziele.filter((z) => passt(z.name, z.beschreibung));
  const treffer = (eintraege ?? []).filter((z) => passt(z.name, z.beschreibung, z.kategorie, z.url));
  const kategorien = Array.from(new Set(treffer.map((z) => z.kategorie))).sort((a, b) => a.localeCompare(b, 'de'));

  return (
    <PageTransition>
      <PageHeader
        title="Zugänge"
        subtitle="Von hier aus überall rein"
        icon={<KeyRound className="w-5 h-5" />}
        actions={
          <button onClick={() => bearbeiten(LEER)} className={clsx(KNOPF, '!w-auto')}>
            <Plus className="w-4 h-4" />
            Neu
          </button>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Dienst suchen …"
            aria-label="Dienst suchen"
            className={clsx(FELD, 'pl-9')}
          />
        </div>

        {fehler && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {fehler}
          </div>
        )}

        {sso.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-white/70">Ein-Klick-Anmeldung</h2>
            <div className={RASTER}>
              {sso.map((ziel, i) => (
                <GlassCard key={ziel.id} hover delay={i * 0.05}>
                  <div className="flex flex-col h-full gap-4">
                    <Kachelkopf
                      icon={ICONS[ziel.id] ?? <KeyRound className="w-5 h-5 text-accent-light" />}
                      name={ziel.name}
                      text={ziel.beschreibung}
                    />
                    <div className="mt-auto">
                      {ziel.konfiguriert ? (
                        <button onClick={() => oeffnen(ziel)} disabled={laedt === ziel.id} className={KNOPF}>
                          {laedt === ziel.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
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
          </section>
        )}

        {kategorien.map((kategorie) => (
          <section key={kategorie} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-white/70">{kategorie}</h2>
            <div className={RASTER}>
              {treffer.filter((z) => z.kategorie === kategorie).map((z) => (
                <GlassCard key={z.id} hover>
                  <div className="flex flex-col h-full gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <Kachelkopf
                        icon={nurHeimnetz(z.url)
                          ? <House className="w-5 h-5 text-accent-light" aria-label="Nur im Heimnetz" />
                          : <ExternalLink className="w-5 h-5 text-accent-light" />}
                        name={z.name}
                        text={z.beschreibung || new URL(z.url).host}
                      />
                      <button
                        onClick={() => bearbeiten(z)}
                        aria-label={`${z.name} bearbeiten`}
                        className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 flex-shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 min-h-7 text-xs">
                      {z.benutzer ? (
                        <button onClick={() => kopieren(z)} title="Benutzername kopieren" className="flex items-center gap-1.5 min-w-0 text-white/60 hover:text-white">
                          {kopiert === z.id ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 flex-shrink-0" />}
                          <span className="truncate">{z.benutzer}</span>
                        </button>
                      ) : <span />}
                      {nurHeimnetz(z.url) && <span className="text-amber-300/80 flex-shrink-0">Heimnetz</span>}
                    </div>

                    <a href={z.url} target="_blank" rel="noopener noreferrer" className={clsx(KNOPF, 'mt-auto')}>
                      <LogIn className="w-4 h-4" />
                      Öffnen
                    </a>
                  </div>
                </GlassCard>
              ))}
            </div>
          </section>
        ))}

        {eintraege && treffer.length === 0 && sso.length === 0 && (
          <p className="text-sm text-white/50 text-center py-8">Kein Dienst gefunden.</p>
        )}
      </div>

      <Modal isOpen={!!formular} onClose={() => setFormular(null)} title={formular?.id ? 'Zugang bearbeiten' : 'Neuer Zugang'} size="sm">
        {formular && (
          <form onSubmit={speichern} className="flex flex-col gap-3">
            {([
              ['name', 'Name', 'Proxmox'],
              ['url', 'Adresse', 'https://…'],
              ['kategorie', 'Kategorie', 'Zuhause'],
              ['beschreibung', 'Beschreibung', 'Wofür ist der Dienst?'],
              ['benutzer', 'Benutzername (kein Passwort)', ''],
            ] as const).map(([feld, titel, beispiel]) => (
              <label key={feld} className="flex flex-col gap-1.5 text-xs text-white/60">
                {titel}
                <input
                  value={formular[feld]}
                  onChange={(e) => setFormular({ ...formular, [feld]: e.target.value })}
                  placeholder={beispiel}
                  required={feld === 'name' || feld === 'url'}
                  list={feld === 'kategorie' ? 'zugang-kategorien' : undefined}
                  autoComplete="off"
                  className={clsx(FELD, 'text-white')}
                />
              </label>
            ))}
            <datalist id="zugang-kategorien">
              {Array.from(new Set((eintraege ?? []).map((z) => z.kategorie))).map((k) => <option key={k} value={k} />)}
            </datalist>

            {formFehler && <p className="text-sm text-red-300">{formFehler}</p>}

            <div className="flex gap-2 pt-1">
              {formular.id && (
                <button type="button" onClick={loeschen} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20">
                  <Trash2 className="w-4 h-4" />
                  Entfernen
                </button>
              )}
              <button type="submit" className={KNOPF}>Speichern</button>
            </div>
          </form>
        )}
      </Modal>
    </PageTransition>
  );
}
