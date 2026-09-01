/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */

// Dauerhafter SSH-Agent für Docker-über-SSH.
//
// WARUM ES DAS GIBT: `docker-modem` (5.0.7, `lib/ssh.js` + `modem.js` Zeile 266)
// baut bei `protocol: 'ssh'` für **jede einzelne Docker-Anfrage** einen neuen
// ssh2-Client, verbindet, authentifiziert, führt `docker system dial-stdio` aus
// und schließt die Verbindung im `close`-Handler des Streams sofort wieder.
// Ein Blick auf `getAllContainerStats` zeigt, was das bedeutet: ein
// `listContainers` plus ein `stats`-Aufruf pro laufendem Container, alle 5
// Sekunden. Auf einem Server mit 10 Containern sind das 11 vollständige
// SSH-Anmeldungen alle 5 Sekunden.
//
// Gemessen am 01.09.2026 an zwei Remote-Servern: **457.694 erfolgreiche
// SSH-Anmeldungen in sechs Tagen** (~1/s) bzw. **1.785 in zehn Minuten** (~3/s).
// Das rotiert das journald-Protokoll so schnell, dass dort nichts älter als
// sechs Tage übrig war — ein Einbruch wäre nicht mehr rekonstruierbar gewesen.
// Das ist der eigentliche Schaden; die verschwendete CPU für die Handshakes
// ist nur der sichtbare Teil.
//
// WIE ES BEHOBEN WIRD: eine **dauerhafte** SSH-Verbindung pro Server, und pro
// Docker-Anfrage nur noch ein zusätzlicher **Exec-Kanal** darauf. Kanäle lösen
// keine erneute Anmeldung aus, es bleibt also eine Zeile „Accepted publickey"
// pro Verbindung statt pro Aufruf.
//
// Eingehängt wird der Agent über `protocol: 'http'` + `agent` statt
// `protocol: 'ssh'`, weil `buildRequest` bei `'ssh'` den mitgegebenen Agent
// **überschreibt** (genau dort entsteht der Pro-Anfrage-Client). Bei `'http'`
// reicht docker-modem `optionsf.agent` unverändert an `http.request` durch;
// unser `createConnection` liefert den SSH-Stream, `host`/`port` landen nur
// noch im `Host`-Header und werden nie für einen Socket benutzt.

import http from 'http';
import { Client } from 'ssh2';

// sshd erlaubt standardmäßig `MaxSessions 10` Kanäle pro Verbindung. Darüber
// lehnt der Server weitere Kanäle ab — deshalb hier deckeln und den Rest
// kurz anstehen lassen, statt auf gut Glück Kanäle zu öffnen.
const MAX_KANAELE = 8;
// Nach dieser Zeit ohne Nutzung wird die Verbindung geschlossen. Ein toter
// Server hält so keinen Socket offen, und nach einem Neustart des Zielservers
// wird beim nächsten Aufruf sauber neu verbunden.
const LEERLAUF_MS = 10 * 60 * 1000;
const KEEPALIVE_MS = 30 * 1000;

/**
 * Erzeugt einen http.Agent, der jede HTTP-Verbindung über einen Exec-Kanal
 * einer gemeinsamen, dauerhaften SSH-Verbindung führt.
 *
 * @param {object} connectConfig ssh2-Verbindungsdaten (host, port, username, privateKey, …)
 * @param {string} label Name für Protokollausgaben (Server-ID)
 */
export function createSshDockerAgent(connectConfig, label = 'ssh') {
  // keepAlive: false ist hier richtig — die HTTP-„Verbindung" ist ein
  // Exec-Kanal, der nach der Antwort ohnehin endet. Wiederverwendet wird die
  // SSH-Verbindung darunter, nicht der Kanal.
  const agent = new http.Agent({ keepAlive: false, maxSockets: MAX_KANAELE });

  let client = null;
  let bereit = null;        // Promise auf den verbundenen Client
  let offeneKanaele = 0;
  let warteschlange = [];
  let leerlaufTimer = null;
  // Diagnose: wie oft musste neu verbunden werden, und warum wurde zuletzt
  // abgeräumt. Genau diese Zahl zeigt, ob die Wiederverwendung wirklich greift
  // — ohne sie sieht ein ständig neu verbindender Agent gesund aus.
  let verbindungen = 0;
  let letzterAbbruch = null;

  function leerlaufPruefen() {
    clearTimeout(leerlaufTimer);
    if (offeneKanaele > 0 || !client) return;
    leerlaufTimer = setTimeout(() => {
      if (offeneKanaele === 0) zuruecksetzen(null, 'leerlauf');
    }, LEERLAUF_MS);
    // Ein Leerlauf-Timer darf den Prozess nicht am Beenden hindern.
    leerlaufTimer.unref?.();
  }

  function zuruecksetzen(fehler, grund = 'unbekannt') {
    clearTimeout(leerlaufTimer);
    if (client) letzterAbbruch = { grund, fehler: fehler?.message || null, zeit: new Date().toISOString() };
    const alt = client;
    client = null;
    bereit = null;
    offeneKanaele = 0;
    if (alt) { try { alt.end(); } catch { /* schon tot */ } }
    // Wartende nicht hängen lassen: sie bekommen den Fehler und dürfen es
    // beim nächsten Aufruf mit einer neuen Verbindung versuchen.
    const wartend = warteschlange;
    warteschlange = [];
    for (const { ablehnen } of wartend) {
      ablehnen(fehler || new Error(`SSH-Verbindung zu ${label} wurde geschlossen`));
    }
  }

  function verbindung() {
    if (bereit) return bereit;
    client = new Client();
    verbindungen++;
    bereit = new Promise((erfuellen, ablehnen) => {
      const c = client;
      c.once('ready', () => erfuellen(c));
      c.once('error', (err) => {
        // Nur zurücksetzen, wenn dieser Client noch der aktuelle ist —
        // sonst räumt ein spätes Fehler-Ereignis eine frische Verbindung ab.
        if (client === c) zuruecksetzen(err, 'fehler');
        ablehnen(err);
      });
      c.once('close', () => { if (client === c) zuruecksetzen(null, 'vom Gegenpart geschlossen'); });
      c.connect({
        ...connectConfig,
        // Hält die Verbindung durch NAT/Firewalls offen und erkennt einen
        // toten Gegenpart, statt endlos auf Antwort zu warten.
        keepaliveInterval: KEEPALIVE_MS,
        keepaliveCountMax: 3,
      });
    });
    return bereit;
  }

  function platzFrei() {
    if (offeneKanaele < MAX_KANAELE) {
      offeneKanaele++;
      return Promise.resolve();
    }
    return new Promise((erfuellen, ablehnen) => {
      warteschlange.push({ erfuellen, ablehnen });
    });
  }

  function platzZurueck() {
    const naechster = warteschlange.shift();
    if (naechster) {
      // Zähler bleibt gleich: der Platz wandert direkt zum Wartenden.
      naechster.erfuellen();
      return;
    }
    offeneKanaele = Math.max(0, offeneKanaele - 1);
    leerlaufPruefen();
  }

  agent.createConnection = function (options, rueckruf) {
    clearTimeout(leerlaufTimer);
    let freigegeben = false;
    const freigeben = () => {
      if (freigegeben) return;
      freigegeben = true;
      platzZurueck();
    };

    platzFrei()
      .then(() => verbindung())
      .then((c) => new Promise((erfuellen, ablehnen) => {
        c.exec('docker system dial-stdio', (err, stream) => {
          if (err) return ablehnen(err);
          erfuellen(stream);
        });
      }))
      .then((stream) => {
        // Ein Fehler auf EINEM Kanal darf die gemeinsame Verbindung nicht
        // mitnehmen — sonst reißt ein einzelner abgebrochener Docker-Aufruf
        // alle parallelen Abfragen mit.
        stream.on('error', () => { /* der HTTP-Client bekommt es über den Stream */ });
        stream.once('close', freigeben);
        rueckruf(null, stream);
      })
      .catch((err) => {
        freigeben();
        rueckruf(err);
      });
  };

  // docker-modem ruft in seinem eigenen ssh.js `agent.destroy()` auf, sobald
  // ein Stream endet. Diesen Agent verwendet es nicht, aber Node selbst räumt
  // Agents ebenfalls ab — und ein `destroy()` würde hier die dauerhafte
  // Verbindung zerstören, also genau den Fehler wiederherstellen, den dieses
  // Modul behebt. Deshalb absichtlich wirkungslos; zum Beenden gibt es close().
  agent.destroy = function () { /* die SSH-Verbindung bewusst offen halten */ };

  agent.close = function () { zuruecksetzen(null, 'close()'); };
  agent.zustand = () => ({
    verbunden: !!client,
    offeneKanaele,
    wartend: warteschlange.length,
    verbindungen,
    letzterAbbruch,
  });

  return agent;
}
