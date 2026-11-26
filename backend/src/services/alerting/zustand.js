/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Entprellung: wann ein Schwellwert wirklich meldet
import { sendWebhook } from './senden.js';

// Edge-getriggerte Schwellwert-Alerts mit Recovery (Hysterese).
// Sendet EINMAL beim Überschreiten und EINMAL bei Normalisierung – kein Spam.
// Der Zustand wird über event_type in der alert_history gehalten
// (z. B. "cpu_high::pi-5" bzw. "disk_high::pi-5::/mnt" + "…::ok").
// WICHTIG: Der Zustand muss pro Server (scope) getrennt sein, sonst
// „entwarnt" ein ruhiger Server den Alarm eines anderen (Server-Verwechslung).
//
// Streak-Gate: der Alerting-Zyklus läuft alle 30s und liest jeweils eine
// einzelne Momentaufnahme (glances). Kurze Bursts (SSH-Discovery, Docker-
// Stats-Sammlung, … überlappen gelegentlich im selben Zyklus) reißen die
// CPU/RAM kurz über die Schwelle, ohne dass der Server wirklich unter Last
// steht — das erzeugte Alarm+Entwarnung im Minutentakt. Erst ein Ausschlag
// über mehrere aufeinanderfolgende Zyklen hinweg gilt als echt.
export const REQUIRED_HIGH_STREAK = 3; // ~90s anhaltend über der Schwelle
export const REQUIRED_OK_STREAK = 4;   // ~120s anhaltend wieder normal
const REALERT_COOLDOWN_MIN = 15; // nach Entwarnung 15 Min keine neue Alarm-Meldung desselben Typs
const streaks = new Map(); // key: `${channel.id}:${stateEvent}` -> { high, ok }

export async function handleThreshold(db, channel, opts) {
  // isOk (optional): echte Hysterese — Entwarnung erst unterhalb der tieferen ok-Schwelle.
  // Werte dazwischen (Totband) ändern den Zustand nicht und zählen weder als hoch noch als ok.
  const { event, scope = '', subject = '', isHigh, alert, recovery } = opts;
  // Wie lange ein Alarm als „noch offen" gilt. Standard 1 Tag (danach Erinnerung);
  // Ausfälle sollen dagegen einmal melden und auch nach Tagen noch entwarnen.
  const zeitfenster = opts.stateWindow || '-1 day';
  const isOk = opts.isOk === undefined ? !isHigh : !!opts.isOk;
  const stateEvent = [event, scope, subject].filter(Boolean).join('::');
  const okEvent = `${stateEvent}::ok`;

  const streakKey = `${channel.id}:${stateEvent}`;
  const streak = streaks.get(streakKey) || { high: 0, ok: 0 };
  if (isHigh) { streak.high += 1; streak.ok = 0; }
  else if (isOk) { streak.ok += 1; streak.high = 0; }
  else { streak.high = 0; streak.ok = 0; } // Totband
  streaks.set(streakKey, streak);

  const letzte = db.prepare(
    "SELECT id, sent_at FROM alert_history WHERE channel_id = ? AND event_type = ? AND sent_at > datetime('now', ?) ORDER BY sent_at DESC, id DESC LIMIT 1"
  );
  const lastAlert = letzte.get(channel.id, stateEvent, zeitfenster);
  const lastOk = letzte.get(channel.id, okEvent, zeitfenster);

  // Über die ID verglichen: Alarm und Entwarnung können in derselben Sekunde liegen.
  const alerting = !!lastAlert && (!lastOk || lastAlert.id > lastOk.id);

  // Cooldown: nach einer Entwarnung nicht sofort wieder alarmieren (Flapping-Schutz).
  const inCooldown = !alerting && !!lastOk &&
    !!db.prepare("SELECT 1 FROM alert_history WHERE channel_id = ? AND event_type = ? AND sent_at > datetime('now', ?)").get(channel.id, okEvent, `-${REALERT_COOLDOWN_MIN} minutes`);

  if (isHigh && !alerting && !inCooldown && streak.high >= REQUIRED_HIGH_STREAK) {
    await sendWebhook(channel, { event: stateEvent, ...alert(subject) });
  } else if (isOk && alerting && recovery && streak.ok >= REQUIRED_OK_STREAK) {
    await sendWebhook(channel, { event: okEvent, ...recovery(subject) });
  }
}
