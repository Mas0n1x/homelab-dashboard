/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Alarm-Zentrale: Sammelstelle für die Teilmodule unter ./alerting/
import { sendWebhook } from './alerting/senden.js';
import { liefereFaellige } from './alerting/zustellung.js';

export { getVapidPublicKey, subscribePush } from './alerting/senden.js';
export { getZustellung, setZustellung } from './alerting/zustellung.js';
export const liefereSammelmeldungen = () => liefereFaellige(sendWebhook);
export { getThresholds, getAllOverrides, setAllOverrides, getMaintenance, addMaintenance, removeMaintenance, maintenanceFor } from './alerting/einstellungen.js';
export { checkServiceAlerts, getAlertOverview, checkAlerts } from './alerting/pruefung.js';
export { sendStatusReport, notify, checkForecastAlerts, checkMemoryTrendAlerts, notifyImageUpdates } from './alerting/meldungen.js';
export { getChannels, addChannel, updateChannel, getChannelRaw, deleteChannel, getAlertHistory, testWebhook } from './alerting/kanaele.js';
