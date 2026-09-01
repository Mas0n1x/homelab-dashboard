/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */

/**
 * Lineare Regression nach der Methode der kleinsten Quadrate.
 *
 * Bewusst ein eigenes Modul ohne Datenbank-Abhängigkeit: reine Rechnung, die
 * sich damit auch ohne laufende Umgebung prüfen lässt.
 *
 * Liefert neben der Steigung das Bestimmtheitsmaß R². Das ist der wichtigere
 * Teil: eine Prognose aus verrauschten Daten sieht genauso präzise aus wie eine
 * aus sauberen, und ohne dieses Maß würde man ihr genauso glauben.
 *
 * @param {{x: number, y: number}[]} punkte
 * @returns {{steigung: number, achsenabschnitt: number, r2: number}}
 */
export function lineareRegression(punkte) {
  const n = punkte.length;
  if (n === 0) return { steigung: 0, achsenabschnitt: 0, r2: 0 };
  if (n === 1) return { steigung: 0, achsenabschnitt: punkte[0].y, r2: 0 };

  const mittelX = punkte.reduce((s, p) => s + p.x, 0) / n;
  const mittelY = punkte.reduce((s, p) => s + p.y, 0) / n;

  let zaehler = 0;
  let nenner = 0;
  for (const p of punkte) {
    zaehler += (p.x - mittelX) * (p.y - mittelY);
    nenner += (p.x - mittelX) ** 2;
  }

  // Alle Punkte auf derselben x-Position: keine Steigung bestimmbar.
  if (nenner === 0) return { steigung: 0, achsenabschnitt: mittelY, r2: 0 };

  const steigung = zaehler / nenner;
  const achsenabschnitt = mittelY - steigung * mittelX;

  let quadratRest = 0;
  let quadratGesamt = 0;
  for (const p of punkte) {
    quadratRest += (p.y - (steigung * p.x + achsenabschnitt)) ** 2;
    quadratGesamt += (p.y - mittelY) ** 2;
  }
  // Waagerechte Messreihe: die Vorhersage ist exakt, R² definitionsgemäß 1.
  const r2 = quadratGesamt === 0 ? 1 : Math.max(0, 1 - quadratRest / quadratGesamt);

  return { steigung, achsenabschnitt, r2 };
}
