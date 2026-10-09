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
      'jennys-kochbuch', 'kochbuch', 'changedetection', 'archivebox', 'convertx',
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

// Lesbare Anzeigenamen für Compose-Projekte (Schlüssel = Projektname). Nicht gelistete Projekte
// zeigen ihren Namen unverändert; Pelican-Spielserver bekommen ihren Namen aus der Pelican-API.
export const PROJECT_LABELS: Record<string, string> = {
  infra: 'Basis-Dienste (Cloudflare & Glances)',
  'homelab-dashboard': 'Homelab-Dashboard (mit Mail)',
  'uptime-kuma': 'Uptime-Kuma',
  'offsite-backup': 'Offsite-Backup',
  wartung: 'Wartungsseite',
  pihole: 'Pi-hole',
  speedtest: 'Speedtest-Tracker',
  changedetection: 'Changedetection (mit Browser)',
  archivebox: 'ArchiveBox',
  convertx: 'ConvertX (Datei-Konverter)',
  minecraft: 'Minecraft-Server (mit Agent)',
  'mc-dashboard': 'Minecraft-Dashboard',
  pelican: 'Pelican (Panel & Wings)',
  salenet: 'SaleNet',
  'lawnet-demo': 'LawNet-Demo',
  'mapnet-demo': 'MapNet-Demo',
  'azubinet-demo': 'AzubiNet-Demo',
  'personet-demo': 'PersoNet-Demo',
  'dispatchnet-demo': 'DispatchNet-Demo',
  'mas0n1x-portfolio': 'Portfolio',
  'mas0n1x-links': 'Socials',
  profil: 'Profil',
  'jennys-kochbuch': 'Jennys Kochbuch',
};

/** Anzeigename eines Projekts; `gameServerNames` bildet Pelican-UUIDs auf Servernamen ab. */
export function projectLabel(projectKey: string, gameServerNames?: Map<string, string>): string {
  const key = projectKey.toLowerCase();
  return gameServerNames?.get(key) || PROJECT_LABELS[key] || projectKey;
}
