/*
 * Einmal-Aufräumer: entfernt die Uptime-Historie und die Umbenennungen, die
 * noch auf container-gebundene Kennungen (docker-<id>) zeigen. Diese Kennungen
 * wechselten bei jedem Redeploy, die Zeilen sind seit der Umstellung auf
 * stabile svc:-Kennungen unerreichbar.
 *
 * Läuft nur bei gestopptem Backend (sauberer SQLite-Zustand).
 */
const Database = require('better-sqlite3');
const fs = require('fs');

const PFAD = '/app/data/dashboard.db';
const db = new Database(PFAD);
const zahl = (s) => db.prepare(s).get().c;
const groesse = () => (fs.statSync(PFAD).size / 1048576).toFixed(1) + ' MB';

const TOT_UPTIME = "SELECT COUNT(*) c FROM uptime_checks WHERE service_id LIKE 'docker-%'";
const LEBEND_UPTIME = "SELECT COUNT(*) c FROM uptime_checks WHERE service_id LIKE 'svc:%'";
const TOT_OVERRIDES = "SELECT COUNT(*) c FROM service_overrides WHERE service_id LIKE 'docker-%'";

console.log('VORHER   uptime gesamt  :', zahl('SELECT COUNT(*) c FROM uptime_checks'));
console.log('         davon tot      :', zahl(TOT_UPTIME));
console.log('         davon lebendig :', zahl(LEBEND_UPTIME));
console.log('         tote Overrides :', zahl(TOT_OVERRIDES));
console.log('         Dateigroesse   :', groesse());

// Kontrollwert: die lebendigen Zeilen MUESSEN unverändert bleiben.
const lebendVorher = zahl(LEBEND_UPTIME);

db.exec('BEGIN');
const a = db.prepare("DELETE FROM uptime_checks WHERE service_id LIKE 'docker-%'").run();
const b = db.prepare("DELETE FROM service_overrides WHERE service_id LIKE 'docker-%'").run();
db.exec('COMMIT');

console.log('ENTFERNT uptime_checks  :', a.changes);
console.log('         service_overrides:', b.changes);

const lebendNachher = zahl(LEBEND_UPTIME);
console.log('KONTROLLE lebendig vorher/nachher:', lebendVorher, '/', lebendNachher,
  lebendVorher === lebendNachher ? '-> unangetastet' : '-> ABWEICHUNG!');
console.log('          tote Reste    :', zahl(TOT_UPTIME));

console.log('... VACUUM laeuft (kann dauern) ...');
db.exec('VACUUM');

console.log('NACHHER  uptime gesamt  :', zahl('SELECT COUNT(*) c FROM uptime_checks'));
console.log('         Dateigroesse   :', groesse());
db.close();
