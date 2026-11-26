/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import crypto from 'node:crypto';

/** Bearer-Token zeitkonstant vergleichen. Ohne erwarteten Wert gilt nichts. */
export function bearerPasst(req, erwartet) {
  const kopf = String(req.headers.authorization || '');
  if (!erwartet || !kopf.startsWith('Bearer ')) return false;
  const hash = (s) => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(hash(kopf.slice(7)), hash(erwartet));
}
