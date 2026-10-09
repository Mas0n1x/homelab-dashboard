/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */

// ── Projekt-Kategorien (feste Zuordnung, eine Quelle für die ganze Oberfläche) ──
// Geteilt zwischen Docker-Container-Tab, Services-Tab und der Container-Schnellliste.
// Der Schlüssel ist der Compose-Projektname bzw. — ohne Projekt — der Container-/Service-Name.
// Nicht gelistete Projekte landen unter "Sonstiges".
export const PROJECT_CATEGORIES: { name: string; projects: string[] }[] = [
  {
    name: 'Infra',
    projects: [
      'infra', 'cloudflared', 'glances', 'glances-auth',
      'homelab-dashboard', 'homelab-backend', 'homelab-frontend', 'homelab-nginx',
      'homelab-stalwart', 'homelab-bot-runtime',
      'uptime-kuma', 'offsite-backup', 'wartung',
      'pihole', 'speedtest', 'speedtest-tracker',
    ],
  },
  {
    name: 'Minecraft',
    projects: ['minecraft', 'mc-agent', 'mc-dashboard'],
  },
  {
    name: 'Game-Server',
    projects: ['pelican', 'pelican-panel', 'pelican-wings'],
  },
  {
    name: 'LawNet',
    projects: [
      'salenet',
      'lawnet-demo', 'mapnet-demo', 'azubinet-demo', 'personet-demo', 'dispatchnet-demo',
    ],
  },
  {
    name: 'Persönliches',
    projects: [
      'mas0n1x-portfolio', 'mas0n1x-portfolio-backend', 'mas0n1x-links', 'profil',
      'jennys-kochbuch', 'kochbuch',
    ],
  },
];

export const FALLBACK_CATEGORY = 'Sonstiges';
export const CATEGORY_ORDER = [...PROJECT_CATEGORIES.map(c => c.name), FALLBACK_CATEGORY];

// Pelican/Wings legt jeden Spielserver als Container an, der nur seine UUID als Namen trägt.
const GAME_SERVER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(_installer)?$/;

export function categoryOf(projectKey: string | undefined | null): string {
  if (!projectKey) return FALLBACK_CATEGORY;
  const key = projectKey.toLowerCase();
  if (GAME_SERVER_UUID.test(key)) return 'Game-Server';
  const hit = PROJECT_CATEGORIES.find(cat => cat.projects.includes(key));
  return hit ? hit.name : FALLBACK_CATEGORY;
}
