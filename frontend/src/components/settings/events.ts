/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */

export const EVENT_OPTIONS = [
  { id: 'server_offline', label: 'Server nicht erreichbar', icon: '🔌' },
  { id: 'cpu_high', label: 'CPU > 90%', icon: '🔥' },
  { id: 'ram_high', label: 'RAM > 90%', icon: '💾' },
  { id: 'disk_high', label: 'Speicher > 90%', icon: '🗄️' },
  { id: 'temp_high', label: 'Temperatur > 75°C', icon: '🌡️' },
  { id: 'container_crash', label: 'Container gestoppt', icon: '💀' },
  { id: 'container_restart', label: 'Container wieder aktiv', icon: '🟢' },
  { id: 'service_offline', label: 'Service offline', icon: '🔴' },
  { id: 'reboot', label: 'Neustart erkannt', icon: '🔄' },
  { id: 'status_report', label: 'Statusbericht (periodisch)', icon: '📊' },
  { id: 'new_portfolio_request', label: 'Neue Anfrage', icon: '📩' },
  { id: 'new_portfolio_customer', label: 'Neuer Kunde', icon: '👤' },
  { id: 'backup_completed', label: 'Backup erfolgreich', icon: '💾' },
  { id: 'backup_failed', label: 'Backup fehlgeschlagen', icon: '⚠️' },
  { id: 'disk_forecast', label: 'Speicher-Prognose (voll in ≤ 30 Tagen)', icon: '📉' },
  { id: 'image_updates', label: 'Veraltete Container-Images', icon: '🐳' },
  { id: 'ram_trend', label: 'RAM-Trend (Speicherleck-Verdacht)', icon: '📈' },
];
