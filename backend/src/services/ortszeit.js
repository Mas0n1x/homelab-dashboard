/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Der Container läuft in UTC. Ruhezeiten und Zeitpläne meinen die Uhr an der Wand.
const ZONE = process.env.ANZEIGE_ZEITZONE || 'Europe/Berlin';
const format = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE, hourCycle: 'h23', weekday: 'short',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});
const TAGE = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ortszeit(date = new Date()) {
  const t = Object.fromEntries(format.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    minuten: Number(t.hour) * 60 + Number(t.minute),
    wochentag: TAGE.indexOf(t.weekday), // 0 = Sonntag
    datum: `${t.year}-${t.month}-${t.day}`,
  };
}

export const istUhrzeit = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));
export const alsMinuten = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/** Nächster Zeitpunkt (nach jetzt), zu dem die Wanduhr `uhrzeit` zeigt. */
export function naechsteZeit(uhrzeit, jetzt = new Date()) {
  const abstand = ((alsMinuten(uhrzeit) - ortszeit(jetzt).minuten + 1440) % 1440) || 1440;
  const ziel = new Date(jetzt.getTime() + abstand * 60000);
  ziel.setSeconds(0, 0);
  return ziel;
}

export function imZeitraum(minuten, von, bis) {
  const a = alsMinuten(von), b = alsMinuten(bis);
  return a <= b ? minuten >= a && minuten < b : minuten >= a || minuten < b;
}
