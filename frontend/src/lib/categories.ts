/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */

// ── Projekt-Kategorien (feste Zuordnung; nicht gelistete Projekte → "Persönliches") ──
// Geteilt zwischen Docker-Container-Tab und Services-Tab, damit beide identisch gruppieren.
export const PROJECT_CATEGORIES: { name: string; projects: string[] }[] = [
  {
    name: 'LawNet',
    projects: ['salenet'],
  },
];

export const FALLBACK_CATEGORY = 'Persönliches';
export const CATEGORY_ORDER = [...PROJECT_CATEGORIES.map(c => c.name), FALLBACK_CATEGORY];

export function categoryOf(projectKey: string | undefined | null): string {
  if (!projectKey) return FALLBACK_CATEGORY;
  const hit = PROJECT_CATEGORIES.find(cat => cat.projects.includes(projectKey));
  return hit ? hit.name : FALLBACK_CATEGORY;
}
