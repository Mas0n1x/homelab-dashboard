/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { useAuthStore } from '@/stores/authStore';
import type { MetricSample, TunnelInfo, ServiceStatusEntry } from './types';

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api`
  : 'http://localhost:3001/api';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken, setTokens, logout } = useAuthStore.getState();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      logout();
      window.location.href = '/login';
      return false;
    }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return true;
  } catch {
    logout();
    window.location.href = '/login';
    return false;
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  let res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (res.status === 401 && !endpoint.startsWith('/auth/')) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => { isRefreshing = false; });
    }
    const success = await refreshPromise;
    if (success) {
      const newToken = useAuthStore.getState().accessToken;
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Wie fetchApi, gibt aber die rohe Response zurück (kein throw), damit Aufrufer
// Status + Fehler-Body selbst auswerten können — inkl. automatischem 401-Refresh.
export async function authedFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  let res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (res.status === 401 && !endpoint.startsWith('/auth/')) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => { isRefreshing = false; });
    }
    const success = await refreshPromise;
    if (success) {
      headers.Authorization = `Bearer ${useAuthStore.getState().accessToken}`;
      res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    }
  }

  return res;
}

// System
export const getSystemStats = () => fetchApi('/system/stats');
export const getCpu = () => fetchApi('/system/cpu');
export const getMemory = () => fetchApi('/system/memory');

// Docker — alle Aufrufe tragen serverId (Default: lokaler Server), damit
// Container-Aktionen auf dem korrekten Server (z. B. VPS) landen.
export const getDockerInfo = (serverId = 'local') => fetchApi(`/docker/info?serverId=${serverId}`);
export const getContainers = (serverId = 'local') => fetchApi(`/docker/containers?serverId=${serverId}`);
export const getContainerStats = (id: string, serverId = 'local') => fetchApi(`/docker/containers/${id}/stats?serverId=${serverId}`);
export const getContainerDetails = (id: string, serverId = 'local') => fetchApi(`/docker/containers/${id}/details?serverId=${serverId}`);
export const getContainerLogs = (id: string, tail = 100, serverId = 'local') => fetchApi<{ logs: string }>(`/docker/containers/${id}/logs?tail=${tail}&serverId=${serverId}`);
export const containerAction = (id: string, action: string, serverId = 'local') => fetchApi(`/docker/containers/${id}/${action}?serverId=${serverId}`, { method: 'POST' });
export const updateRestartPolicy = (id: string, policy: string, serverId = 'local') =>
  fetchApi(`/docker/containers/${id}/restart-policy?serverId=${serverId}`, { method: 'PUT', body: JSON.stringify({ policy }) });
export const getImages = (serverId = 'local') => fetchApi(`/docker/images?serverId=${serverId}`);
export const deleteImage = (id: string, force = false, serverId = 'local') => fetchApi(`/docker/images/${encodeURIComponent(id)}?force=${force}&serverId=${serverId}`, { method: 'DELETE' });
export const pruneImages = (serverId = 'local') => fetchApi(`/docker/images/prune?serverId=${serverId}`, { method: 'POST' });
export const getVolumes = (serverId = 'local') => fetchApi(`/docker/volumes?serverId=${serverId}`);
export const deleteVolume = (name: string, force = false, serverId = 'local') => fetchApi(`/docker/volumes/${name}?force=${force}&serverId=${serverId}`, { method: 'DELETE' });
export const pruneVolumes = (serverId = 'local') => fetchApi(`/docker/volumes/prune?serverId=${serverId}`, { method: 'POST' });
export const getNetworks = (serverId = 'local') => fetchApi(`/docker/networks?serverId=${serverId}`);
export const getPorts = (serverId = 'local') => fetchApi(`/docker/ports?serverId=${serverId}`);
export const systemPrune = (options: Record<string, boolean>, serverId = 'local') => fetchApi(`/docker/system/prune?serverId=${serverId}`, { method: 'POST', body: JSON.stringify(options) });

// Services
export const getServices = (serverId = 'local') => fetchApi(`/services?serverId=${serverId}`);
export const getManagedServices = (serverId = 'local') =>
  fetchApi<{ services: any[] }>(`/services?serverId=${serverId}&includeHidden=1`);
export const addService = (data: { name: string; url: string; icon?: string; description?: string; category?: string; serverId?: string }) =>
  fetchApi('/services', { method: 'POST', body: JSON.stringify(data) });
export const updateService = (id: string, data: Record<string, unknown>) =>
  fetchApi(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteService = (id: string) =>
  fetchApi(`/services/${id}`, { method: 'DELETE' });
export const updateServiceOverride = (serviceId: string, data: Record<string, unknown>) =>
  fetchApi(`/services/override/${serviceId}`, { method: 'PUT', body: JSON.stringify(data) });

// Servers
export const getServers = () => fetchApi('/servers');
export const addServer = (data: { name: string; host: string; glancesUrl?: string; dockerHost?: string; sshHost?: string; sshPort?: number; sshUser?: string; sshKeyPath?: string }) =>
  fetchApi('/servers', { method: 'POST', body: JSON.stringify(data) });
export const updateServer = (id: string, data: Record<string, unknown>) =>
  fetchApi(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteServer = (id: string) =>
  fetchApi(`/servers/${id}`, { method: 'DELETE' });

// Metrik-Verlauf (Sparklines/Charts)
export const getMetrics = (serverId = 'local', minutes = 60) =>
  fetchApi<MetricSample[]>(`/metrics/${serverId}?minutes=${minutes}`);

// Cloudflare-Tunnel-Status
export const getTunnels = () => fetchApi<TunnelInfo[]>('/tunnels');

// Uptime
export const getUptimeSummary = (serverId = 'local') => fetchApi(`/uptime/summary?serverId=${serverId}`);
export const getUptimeHistory = (serviceId: string, hours = 24) => fetchApi(`/uptime/${serviceId}?hours=${hours}`);
export const getUptimeTimeline = (serviceId: string, days = 30) => fetchApi(`/uptime/timeline/${serviceId}?days=${days}`);
export const getUptimeStatus = (serverId = 'local', days = 30) =>
  fetchApi<Record<string, ServiceStatusEntry>>(`/uptime/status?serverId=${serverId}&days=${days}`);

// Portfolio
export const getPortfolioDashboard = () => fetchApi('/portfolio/dashboard');
export const getPortfolioRequests = () => fetchApi('/portfolio/requests');
export const getPortfolioInvoices = () => fetchApi('/portfolio/invoices');
export const getPortfolioCustomers = () => fetchApi('/portfolio/customers');
export const getPortfolioAppointments = () => fetchApi('/portfolio/appointments');
export const getNotifications = () => fetchApi('/portfolio/notifications');
export const markNotificationRead = (id: string) => fetchApi(`/portfolio/notifications/${id}/read`, { method: 'PUT' });
export const clearNotifications = () => fetchApi('/portfolio/notifications', { method: 'DELETE' });

// Aurora (Self-Hosted Cloud) — Metrics
export interface AuroraMetrics {
  users: number;
  files: number;
  folders: number;
  storageBytes: number;
  trashItems: number;
  trashBytes: number;
  versions: number;
  versionBytes: number;
  shares: number;
}
export const getAuroraMetrics = () => fetchApi<AuroraMetrics>('/aurora/metrics');

// Business (SaleNet + Portfolio zusammengeführt, mit lokalem "erledigt")
export interface BusinessItem {
  ref: string;
  source: 'SaleNet' | 'Portfolio';
  kind: 'order' | 'contact' | 'request';
  title: string;
  sub: string;
  email?: string | null;
  message?: string | null;
  amount?: string | null;
  status: string;
  time: string;
  isNew: boolean;
}
export const getBusinessRequests = () =>
  fetchApi<{ items: BusinessItem[]; total: number; dismissedCount: number }>('/business/requests');
export const dismissBusinessRequest = (ref: string) =>
  fetchApi('/business/requests/dismiss', { method: 'POST', body: JSON.stringify({ ref }) });
export const restoreBusinessRequests = (ref?: string) =>
  fetchApi('/business/requests/restore', { method: 'POST', body: JSON.stringify(ref ? { ref } : {}) });

// Favorites
export const getFavorites = (serverId = 'local') => fetchApi(`/favorites?serverId=${serverId}`);
export const addFavorite = (serviceId: string, serverId = 'local') =>
  fetchApi('/favorites', { method: 'POST', body: JSON.stringify({ serviceId, serverId }) });
export const removeFavorite = (serviceId: string, serverId = 'local') =>
  fetchApi(`/favorites/${serviceId}?serverId=${serverId}`, { method: 'DELETE' });

// Speedtest
export const getSpeedtestLatest = () => fetchApi('/speedtest/latest');
export const getSpeedtestHistory = (limit = 50) => fetchApi(`/speedtest/history?limit=${limit}`);
export const runSpeedtest = () => fetchApi('/speedtest/run', { method: 'POST' });
export const getSpeedtestStatus = () => fetchApi<{ running: boolean }>('/speedtest/status');

// Docker Compose
export const getComposeProjects = (serverId = 'local') => fetchApi(`/docker/compose/projects?serverId=${serverId}`);
export const composeAction = (project: string, action: string, serverId = 'local') =>
  fetchApi(`/docker/compose/${encodeURIComponent(project)}/${action}?serverId=${serverId}`, { method: 'POST' });
export const getComposeFile = (project: string, serverId = 'local') =>
  fetchApi<{ content: string; path: string; workingDir: string; remote?: boolean }>(`/docker/compose/${encodeURIComponent(project)}/file?serverId=${serverId}`);
export const saveComposeFile = (project: string, content: string, serverId = 'local') =>
  fetchApi(`/docker/compose/${encodeURIComponent(project)}/file?serverId=${serverId}`, { method: 'PUT', body: JSON.stringify({ content }) });

// Docker Disk Usage
export const getDiskUsage = (serverId = 'local') => fetchApi(`/docker/disk-usage?serverId=${serverId}`);

// Container Stats (batch)
export const getAllContainerStats = (serverId = 'local') => fetchApi(`/docker/stats/all?serverId=${serverId}`);

// Image Updates
export const checkImageUpdates = (serverId = 'local') => fetchApi(`/docker/updates/check?serverId=${serverId}`);
export const pullAndRecreate = (containerId: string, serverId = 'local') =>
  fetchApi(`/docker/updates/pull/${containerId}?serverId=${serverId}`, { method: 'POST' });

// Alerts
export const getAlertChannels = () => fetchApi('/alerts/channels');
export const addAlertChannel = (data: { type: string; name: string; webhookUrl: string; events: string[] }) =>
  fetchApi('/alerts/channels', { method: 'POST', body: JSON.stringify(data) });
export const updateAlertChannel = (id: string, data: Record<string, unknown>) =>
  fetchApi(`/alerts/channels/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAlertChannel = (id: string) =>
  fetchApi(`/alerts/channels/${id}`, { method: 'DELETE' });
export const testAlertChannel = (id: string) =>
  fetchApi(`/alerts/channels/${id}/test`, { method: 'POST' });
export const getAlertHistory = (limit = 50) => fetchApi(`/alerts/history?limit=${limit}`);
export const getAlertThresholds = () => fetchApi<{ cpu: number; ram: number; disk: number; temp: number }>('/alerts/thresholds');
export const setAlertThresholds = (data: { cpu: number; ram: number; disk: number; temp: number }) =>
  fetchApi('/alerts/thresholds', { method: 'PUT', body: JSON.stringify(data) });

// Audit
export const getAuditLog = (limit = 50) => fetchApi(`/audit?limit=${limit}`);

// Backups
export const getBackups = (limit = 20) => fetchApi(`/backup?limit=${limit}`);
export const getBackupStatus = () => fetchApi<{ running: boolean; latest: any }>('/backup/status');
export const runBackup = (type = 'database') => fetchApi('/backup/run', { method: 'POST', body: JSON.stringify({ type }) });
export const deleteBackup = (id: number | string) => fetchApi(`/backup/${id}`, { method: 'DELETE' });
export type BackupSchedule = { enabled: boolean; type: 'database' | 'full'; intervalHours: number };
export const getBackupSchedule = () => fetchApi<BackupSchedule>('/backup/schedule');
export const setBackupSchedule = (cfg: Partial<BackupSchedule>) =>
  fetchApi<BackupSchedule>('/backup/schedule', { method: 'PUT', body: JSON.stringify(cfg) });
export const restoreBackup = (id: number | string) => fetchApi(`/backup/${id}/restore`, { method: 'POST' });
export type OffsiteConfig = { enabled: boolean; serverId: string; path: string };
export const getOffsiteConfig = () => fetchApi<OffsiteConfig>('/backup/offsite');
export const setOffsiteConfig = (cfg: OffsiteConfig) =>
  fetchApi<OffsiteConfig>('/backup/offsite', { method: 'PUT', body: JSON.stringify(cfg) });

// Backup-Datei herunterladen (Blob über authedFetch, damit der Bearer-Token mitgeht)
export async function downloadBackup(id: number | string): Promise<void> {
  const res = await authedFetch(`/backup/${id}/download`);
  if (!res.ok) throw new Error(`Download fehlgeschlagen: ${res.status}`);
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `backup-${id}`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// Bookmarks
export const getBookmarks = () => fetchApi('/bookmarks');
export const addBookmark = (data: { name: string; url: string; icon?: string; category?: string }) =>
  fetchApi('/bookmarks', { method: 'POST', body: JSON.stringify(data) });
export const updateBookmark = (id: string, data: Record<string, unknown>) =>
  fetchApi(`/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteBookmark = (id: string) =>
  fetchApi(`/bookmarks/${id}`, { method: 'DELETE' });

// Notes
export const getNotes = () => fetchApi('/notes');
export const addNote = (data: { title: string; content?: string; color?: string }) =>
  fetchApi('/notes', { method: 'POST', body: JSON.stringify(data) });
export const updateNote = (id: string, data: Record<string, unknown>) =>
  fetchApi(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteNote = (id: string) =>
  fetchApi(`/notes/${id}`, { method: 'DELETE' });

// Calendar
export const getCalendarEvents = (month?: number, year?: number) =>
  fetchApi(`/calendar${month && year ? `?month=${month}&year=${year}` : ''}`);
export const addCalendarEvent = (data: { title: string; date: string; time?: string; description?: string; color?: string }) =>
  fetchApi('/calendar', { method: 'POST', body: JSON.stringify(data) });
export const updateCalendarEvent = (id: string, data: Record<string, unknown>) =>
  fetchApi(`/calendar/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCalendarEvent = (id: string) =>
  fetchApi(`/calendar/${id}`, { method: 'DELETE' });

// Container Templates
export const getTemplates = () => fetchApi('/templates');
export const addTemplate = (data: Record<string, unknown>) =>
  fetchApi('/templates', { method: 'POST', body: JSON.stringify(data) });
export const deleteTemplate = (id: string) =>
  fetchApi(`/templates/${id}`, { method: 'DELETE' });
export const deployTemplate = (id: string, data: Record<string, unknown>) =>
  fetchApi(`/templates/${id}/deploy`, { method: 'POST', body: JSON.stringify(data) });

// Auth
export const changePassword = (currentPassword: string, newPassword: string) =>
  fetchApi('/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) });

// ─── Mail ───

function mailHeaders(email?: string): Record<string, string> {
  if (!email) return {};
  return { 'X-Mail-Account': email };
}

// JMAP Session
export interface JmapSession {
  primaryAccounts?: Record<string, string>;
  accounts?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  apiUrl?: string;
  uploadUrl?: string;
  downloadUrl?: string;
}

export const getMailSession = (email: string) =>
  fetchApi<JmapSession>('/mail/session', { headers: mailHeaders(email) });

// Generic JMAP proxy
export const jmapCall = (email: string, methodCalls: unknown[][]) =>
  fetchApi<{ methodResponses: unknown[][] }>('/mail/jmap', {
    method: 'POST',
    headers: mailHeaders(email),
    body: JSON.stringify({ methodCalls }),
  });

// Credentials
export const getMailCredentials = () => fetchApi<{ email: string | null; password: string | null; accountId: string | null }>('/mail/credentials');
export const saveMailCredentials = (email: string, password: string, accountId?: string | null) =>
  fetchApi('/mail/credentials', { method: 'POST', body: JSON.stringify({ email, password, accountId }) });
export const deleteMailCredentials = () =>
  fetchApi('/mail/credentials', { method: 'DELETE' });

// Upload attachment
export const uploadMailAttachment = async (email: string, accountId: string, file: File) => {
  const { accessToken } = useAuthStore.getState();
  const buffer = await file.arrayBuffer();
  return fetch(`${API_BASE}/mail/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      Authorization: `Bearer ${accessToken}`,
      'X-Mail-Account': email,
      'X-Mail-Account-Id': accountId,
    },
    body: buffer,
  }).then(r => r.json());
};

// Download attachment URL
export const getMailAttachmentUrl = (accountId: string, blobId: string, name: string) =>
  `${API_BASE}/mail/download/${accountId}/${encodeURIComponent(blobId)}/${encodeURIComponent(name)}`;

// Multi-Account Management
export interface MailAccount {
  id: number;
  email: string;
  accountId: string | null;
  displayName: string | null;
  sortOrder: number;
  isActive: boolean;
  unreadCount?: number;
}

export const getUserMailAccounts = () => fetchApi<MailAccount[]>('/mail/accounts');
export const addUserMailAccount = (data: { email: string; displayName?: string }) =>
  fetchApi<MailAccount>('/mail/accounts', { method: 'POST', body: JSON.stringify(data) });
export const activateUserMailAccount = (id: number) =>
  fetchApi<{ ok: boolean; email: string }>(`/mail/accounts/${id}/activate`, { method: 'PUT' });
export const deleteUserMailAccount = (id: number) =>
  fetchApi<{ ok: boolean }>(`/mail/accounts/${id}`, { method: 'DELETE' });

// Admin (Stalwart Server Management)
export const getMailAccounts = () => fetchApi('/mail/admin/accounts');
export const createMailAccount = (data: { username: string; displayName?: string; domain?: string }) =>
  fetchApi('/mail/admin/accounts', { method: 'POST', body: JSON.stringify(data) });
export const deleteMailAccount = (username: string) =>
  fetchApi(`/mail/admin/accounts/${encodeURIComponent(username)}`, { method: 'DELETE' });
export const updateMailAccountPassword = (username: string, password: string) =>
  fetchApi(`/mail/admin/accounts/${encodeURIComponent(username)}/password`, { method: 'PUT', body: JSON.stringify({ password }) });
export const getMailDomains = () => fetchApi('/mail/admin/domains');
export const getMailDkim = (domain: string) => fetchApi(`/mail/admin/dkim/${encodeURIComponent(domain)}`);

// ─── Maintenance ───

import type { Process, NetworkConfig, DiskHealthInfo, SystemdService, UpdateStatus } from '@/lib/types';

export const getProcesses = (serverId: string) => fetchApi<Process[]>(`/maintenance/${serverId}/processes`);
export const getNetworkConfig = (serverId: string) => fetchApi<NetworkConfig>(`/maintenance/${serverId}/network`);
export const getDiskHealth = (serverId: string) => fetchApi<DiskHealthInfo>(`/maintenance/${serverId}/disk-health`);
export const getSystemdServices = (serverId: string) => fetchApi<SystemdService[]>(`/maintenance/${serverId}/systemd`);
export const getUpdateStatus = (serverId: string) => fetchApi<UpdateStatus>(`/maintenance/${serverId}/updates`);
