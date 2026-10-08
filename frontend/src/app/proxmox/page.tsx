/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Server, RefreshCw, Play, Power, RotateCw, Square, Camera, ChevronDown, ChevronRight,
  Cpu, MemoryStick, HardDrive, Clock, Trash2, Undo2, Plus, AlertTriangle,
} from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import {
  getProxmoxStatus, getProxmoxTasks, getProxmoxSnapshots,
  proxmoxGastAktion, proxmoxSnapshotErstellen, proxmoxSnapshotRollback,
  proxmoxSnapshotLoeschen, proxmoxNodeAktion,
  type ProxmoxStatus, type ProxmoxAufgabe, type ProxmoxGast, type ProxmoxSnapshot,
} from '@/lib/api';
import { formatBytes } from '@/lib/formatters';

const KARTE = 'glass-card';

function dauer(sekunden: number): string {
  if (!sekunden) return '–';
  const t = Math.floor(sekunden / 86400);
  const h = Math.floor((sekunden % 86400) / 3600);
  const m = Math.floor((sekunden % 3600) / 60);
  if (t > 0) return `${t} T ${h} Std`;
  if (h > 0) return `${h} Std ${m} Min`;
  return `${m} Min`;
}

function zeit(epoche: number | null): string {
  if (!epoche) return '–';
  return new Date(epoche * 1000).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function Balken({ anteil, warn = 0.8 }: { anteil: number; warn?: number }) {
  const prozent = Math.max(0, Math.min(1, anteil || 0)) * 100;
  return (
    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${anteil >= warn ? 'bg-amber-400' : 'bg-accent'}`}
        style={{ width: `${prozent}%` }}
      />
    </div>
  );
}

function Kennzahl({ icon, titel, wert, unter, anteil }: {
  icon: React.ReactNode; titel: string; wert: string; unter: string; anteil: number;
}) {
  return (
    <div className={`${KARTE} h-full`}>
      <div className="relative z-10 p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2 text-white/50 text-sm">{icon}<span>{titel}</span></div>
        <div className="text-2xl font-semibold leading-none">{wert}</div>
        <div className="mt-auto flex flex-col gap-2">
          <Balken anteil={anteil} />
          <div className="text-xs text-white/40 truncate">{unter}</div>
        </div>
      </div>
    </div>
  );
}

export default function ProxmoxPage() {
  const [status, setStatus] = useState<ProxmoxStatus | null>(null);
  const [aufgaben, setAufgaben] = useState<ProxmoxAufgabe[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<ProxmoxSnapshot[]>([]);
  const [snapName, setSnapName] = useState('');

  const laden = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([getProxmoxStatus(), getProxmoxTasks().catch(() => [])]);
      setStatus(s);
      setAufgaben(a);
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Proxmox nicht erreichbar');
    }
  }, []);

  useEffect(() => {
    laden();
    const t = setInterval(laden, 5000);
    return () => clearInterval(t);
  }, [laden]);

  const ausfuehren = async (schluessel: string, aktion: () => Promise<void>, erfolg: string) => {
    setBeschaeftigt(schluessel);
    setMeldung(null);
    try {
      await aktion();
      setMeldung(erfolg);
      setTimeout(laden, 1500);
    } catch (e) {
      setMeldung(`Fehler: ${e instanceof Error ? e.message : 'unbekannt'}`);
    } finally {
      setBeschaeftigt(null);
    }
  };

  const gastAktion = (g: ProxmoxGast, aktion: string, text: string, bestaetigen?: string) => {
    if (bestaetigen && !window.confirm(bestaetigen)) return;
    ausfuehren(`${g.typ}${g.vmid}`, () => proxmoxGastAktion(g.typ, g.vmid, aktion), `${g.name}: ${text}`);
  };

  const snapshotsLaden = async (g: ProxmoxGast) => {
    try { setSnapshots(await getProxmoxSnapshots(g.typ, g.vmid)); } catch { setSnapshots([]); }
  };

  const snapshotsUmschalten = (g: ProxmoxGast) => {
    const schluessel = `${g.typ}${g.vmid}`;
    if (offen === schluessel) { setOffen(null); return; }
    setOffen(schluessel);
    setSnapName('');
    setSnapshots([]);
    snapshotsLaden(g);
  };

  const nodeAktion = (aktion: 'reboot' | 'shutdown') => {
    const frage = aktion === 'reboot'
      ? 'Cerberus wirklich NEU STARTEN? Alle VMs und Container werden dabei heruntergefahren.'
      : 'Cerberus wirklich HERUNTERFAHREN? Er lässt sich danach nicht aus der Ferne wieder starten.';
    if (!window.confirm(frage)) return;
    ausfuehren('node', () => proxmoxNodeAktion(aktion), aktion === 'reboot' ? 'Cerberus startet neu …' : 'Cerberus fährt herunter …');
  };

  const node = status?.node;
  const gaeste = status?.gaeste ?? [];

  return (
    <PageTransition>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center flex-shrink-0">
              <Server className="w-5 h-5 text-accent-light" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-none">Proxmox</h1>
              <p className="text-sm text-white/40 mt-1 truncate">
                {node ? `${node.name} · Proxmox VE ${status?.version} · Kernel ${node.kernel}` : 'Cerberus'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={laden} className="p-2 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-all" title="Neu laden">
              <RefreshCw className="w-4 h-4" />
            </button>
            {node && (
              <>
                <button
                  onClick={() => nodeAktion('reboot')} disabled={beschaeftigt === 'node'}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all disabled:opacity-40"
                  title="Cerberus neu starten"
                >
                  <RotateCw className="w-4 h-4" /><span className="hidden sm:inline">Neustart</span>
                </button>
                <button
                  onClick={() => nodeAktion('shutdown')} disabled={beschaeftigt === 'node'}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-red-300/70 hover:text-red-300 hover:bg-red-500/[0.08] transition-all disabled:opacity-40"
                  title="Cerberus herunterfahren"
                >
                  <Power className="w-4 h-4" /><span className="hidden sm:inline">Herunterfahren</span>
                </button>
              </>
            )}
          </div>
        </div>

        {meldung && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/70">{meldung}</div>
        )}

        {fehler && !status && (
          <div className={KARTE}>
            <div className="relative z-10 p-8 flex flex-col items-center text-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <h2 className="text-base font-medium text-white/80">Cerberus nicht erreichbar</h2>
              <p className="text-sm text-white/40 max-w-md">{fehler}. Läuft der Tunnel (<code className="text-white/50">dashboard-tunnel</code> auf Cerberus)?</p>
            </div>
          </div>
        )}

        {status && !status.konfiguriert && (
          <div className={KARTE}>
            <div className="relative z-10 p-8 text-center text-sm text-white/50">
              Proxmox ist nicht konfiguriert. Es fehlen <code className="text-white/60">PROXMOX_URL</code>, <code className="text-white/60">PROXMOX_TOKEN_ID</code> und <code className="text-white/60">PROXMOX_TOKEN_SECRET</code> in der <code className="text-white/60">.env</code>.
            </div>
          </div>
        )}

        {node && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-fr">
              <Kennzahl
                icon={<Cpu className="w-4 h-4" />} titel="CPU"
                wert={`${(node.cpu * 100).toFixed(1)} %`}
                unter={`${node.maxcpu} Threads · Last ${node.last.slice(0, 3).join(' / ')}`}
                anteil={node.cpu}
              />
              <Kennzahl
                icon={<MemoryStick className="w-4 h-4" />} titel="Arbeitsspeicher"
                wert={`${formatBytes(node.mem)}`}
                unter={`von ${formatBytes(node.maxmem)} · Swap ${formatBytes(node.swap)}`}
                anteil={node.maxmem ? node.mem / node.maxmem : 0}
              />
              <Kennzahl
                icon={<HardDrive className="w-4 h-4" />} titel="System-Datenträger"
                wert={`${formatBytes(node.disk)}`}
                unter={`von ${formatBytes(node.maxdisk)}`}
                anteil={node.maxdisk ? node.disk / node.maxdisk : 0}
              />
              <Kennzahl
                icon={<Clock className="w-4 h-4" />} titel="Laufzeit"
                wert={dauer(node.uptime)}
                unter={node.cpuModell || 'Cerberus'}
                anteil={0}
              />
            </div>

            <div className={KARTE}>
              <div className="relative z-10 p-4">
                <h2 className="text-sm font-medium text-white/70 mb-3">VMs &amp; Container <span className="text-white/30">({gaeste.length})</span></h2>
                {gaeste.length === 0 ? (
                  <p className="text-sm text-white/40 py-6 text-center">Noch keine VMs oder Container auf Cerberus.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-white/[0.06]">
                    {gaeste.map((g) => {
                      const schluessel = `${g.typ}${g.vmid}`;
                      const laeuft = g.status === 'running';
                      const busy = beschaeftigt === schluessel;
                      return (
                        <div key={schluessel} className="py-3">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <div className="flex items-center gap-3 min-w-0 flex-1 basis-56">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${laeuft ? 'bg-emerald-400' : 'bg-white/20'}`} />
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{g.name}</div>
                                <div className="text-xs text-white/40">{g.typ === 'qemu' ? 'VM' : 'Container'} · {g.vmid}{g.vorlage ? ' · Vorlage' : ''}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-xs text-white/50 flex-1 basis-64">
                              <div><div className="text-white/30">CPU</div>{laeuft ? `${(g.cpu * 100).toFixed(0)} %` : '–'}</div>
                              <div><div className="text-white/30">RAM</div>{laeuft ? formatBytes(g.mem, 0) : formatBytes(g.maxmem, 0)}</div>
                              <div><div className="text-white/30">Laufzeit</div>{laeuft ? dauer(g.uptime) : 'aus'}</div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!g.vorlage && !laeuft && (
                                <button disabled={busy} onClick={() => gastAktion(g, 'start', 'startet …')} title="Starten"
                                  className="p-2 rounded-lg text-emerald-300/80 hover:bg-emerald-500/10 disabled:opacity-40"><Play className="w-4 h-4" /></button>
                              )}
                              {!g.vorlage && laeuft && (
                                <>
                                  <button disabled={busy} onClick={() => gastAktion(g, 'reboot', 'startet neu …', `${g.name} neu starten?`)} title="Neu starten"
                                    className="p-2 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/[0.05] disabled:opacity-40"><RotateCw className="w-4 h-4" /></button>
                                  <button disabled={busy} onClick={() => gastAktion(g, 'shutdown', 'fährt herunter …', `${g.name} herunterfahren?`)} title="Herunterfahren"
                                    className="p-2 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/[0.05] disabled:opacity-40"><Power className="w-4 h-4" /></button>
                                  <button disabled={busy} onClick={() => gastAktion(g, 'stop', 'wurde hart gestoppt.', `${g.name} HART stoppen? Das entspricht dem Ziehen des Stromkabels.`)} title="Hart stoppen"
                                    className="p-2 rounded-lg text-red-300/70 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40"><Square className="w-4 h-4" /></button>
                                </>
                              )}
                              {!g.vorlage && (
                                <button onClick={() => snapshotsUmschalten(g)} title="Snapshots"
                                  className="flex items-center gap-1 px-2 py-2 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/[0.05]">
                                  <Camera className="w-4 h-4" />
                                  {offen === schluessel ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>

                          {offen === schluessel && (
                            <div className="mt-3 ml-5 rounded-xl border border-white/[0.06] bg-black/20 p-3 flex flex-col gap-2">
                              {snapshots.length === 0 && <div className="text-xs text-white/40">Keine Snapshots.</div>}
                              {snapshots.map((s) => (
                                <div key={s.name} className="flex items-center justify-between gap-3 text-sm">
                                  <div className="min-w-0">
                                    <span className="text-white/80">{s.name}</span>
                                    <span className="text-xs text-white/30 ml-2">{zeit(s.zeit)}{s.beschreibung ? ` · ${s.beschreibung}` : ''}</span>
                                  </div>
                                  <div className="flex gap-1 flex-shrink-0">
                                    <button title="Zurücksetzen auf diesen Stand"
                                      onClick={() => window.confirm(`${g.name} auf „${s.name}“ zurücksetzen? Der aktuelle Stand geht verloren.`) &&
                                        ausfuehren(schluessel, () => proxmoxSnapshotRollback(g.typ, g.vmid, s.name), `${g.name}: Rollback auf „${s.name}“ läuft …`)}
                                      className="p-1.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/[0.05]"><Undo2 className="w-4 h-4" /></button>
                                    <button title="Snapshot löschen"
                                      onClick={() => window.confirm(`Snapshot „${s.name}“ löschen?`) &&
                                        ausfuehren(schluessel, async () => { await proxmoxSnapshotLoeschen(g.typ, g.vmid, s.name); await snapshotsLaden(g); }, `Snapshot „${s.name}“ gelöscht.`)}
                                      className="p-1.5 rounded-lg text-red-300/60 hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </div>
                              ))}
                              <form
                                className="flex gap-2 pt-1"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (!snapName) return;
                                  ausfuehren(schluessel, async () => {
                                    await proxmoxSnapshotErstellen(g.typ, g.vmid, snapName, '');
                                    setSnapName('');
                                    await snapshotsLaden(g);
                                  }, `Snapshot „${snapName}“ wird erstellt …`);
                                }}
                              >
                                <input
                                  value={snapName} onChange={(e) => setSnapName(e.target.value)}
                                  placeholder="Neuer Snapshot, z. B. vor-update" maxLength={40}
                                  className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-base sm:text-sm outline-none focus:border-accent/40"
                                />
                                <button type="submit" disabled={!snapName || busy}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white/70 hover:text-white bg-white/[0.05] hover:bg-white/[0.08] disabled:opacity-40">
                                  <Plus className="w-4 h-4" />Erstellen
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 auto-rows-fr">
              <div className={`${KARTE} h-full`}>
                <div className="relative z-10 p-4 flex flex-col gap-3 h-full">
                  <h2 className="text-sm font-medium text-white/70">Speicher</h2>
                  {(status?.speicher ?? []).map((s) => (
                    <div key={s.name} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/80">{s.name} <span className="text-xs text-white/30">{s.art}</span></span>
                        <span className="text-xs text-white/40">{formatBytes(s.disk)} / {formatBytes(s.maxdisk)}</span>
                      </div>
                      <Balken anteil={s.maxdisk ? s.disk / s.maxdisk : 0} />
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${KARTE} h-full`}>
                <div className="relative z-10 p-4 flex flex-col gap-3 h-full">
                  <h2 className="text-sm font-medium text-white/70">Letzte Aufgaben</h2>
                  {aufgaben.length === 0 && <div className="text-sm text-white/40">Keine Aufgaben.</div>}
                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                    {aufgaben.slice(0, 10).map((a) => (
                      <div key={a.upid} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-white/70 truncate">{a.art}{a.vmid ? ` · ${a.vmid}` : ''}</span>
                        <span className="text-white/30 flex-shrink-0">{zeit(a.start)}</span>
                        <span className={`flex-shrink-0 ${a.status === 'OK' ? 'text-emerald-300/80' : a.status === 'läuft' ? 'text-white/50' : 'text-red-300/80'}`}>{a.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
