import { useAuthStore } from '@/stores/authStore';

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

// System
export const getSystemStats = () => fetchApi('/system/stats');
export const getCpu = () => fetchApi('/system/cpu');
export const getMemory = () => fetchApi('/system/memory');

// Docker
export const getDockerInfo = () => fetchApi('/docker/info');
export const getContainers = () => fetchApi('/docker/containers');
export const getContainerStats = (id: string) => fetchApi(`/docker/containers/${id}/stats`);
export const getContainerDetails = (id: string) => fetchApi(`/docker/containers/${id}/details`);
export const getContainerLogs = (id: string, tail = 100) => fetchApi<{ logs: string }>(`/docker/containers/${id}/logs?tail=${tail}`);
export const containerAction = (id: string, action: string) => fetchApi(`/docker/containers/${id}/${action}`, { method: 'POST' });
export const updateRestartPolicy = (id: string, policy: string) =>
  fetchApi(`/docker/containers/${id}/restart-policy`, { method: 'PUT', body: JSON.stringify({ policy }) });
export const getImages = () => fetchApi('/docker/images');
export const deleteImage = (id: string, force = false) => fetchApi(`/docker/images/${encodeURIComponent(id)}?force=${force}`, { method: 'DELETE' });
export const pruneImages = () => fetchApi('/docker/images/prune', { method: 'POST' });
export const getVolumes = () => fetchApi('/docker/volumes');
export const deleteVolume = (name: string, force = false) => fetchApi(`/docker/volumes/${name}?force=${force}`, { method: 'DELETE' });
export const pruneVolumes = () => fetchApi('/docker/volumes/prune', { method: 'POST' });
export const getNetworks = () => fetchApi('/docker/networks');
export const getPorts = () => fetchApi('/docker/ports');
export const systemPrune = (options: Record<string, boolean>) => fetchApi('/docker/system/prune', { method: 'POST', body: JSON.stringify(options) });

// Services
export const getServices = (serverId = 'local') => fetchApi(`/services?serverId=${serverId}`);
export const addService = (data: { name: string; url: string; icon?: string; description?: string; category?: string }) =>
  fetchApi('/services', { method: 'POST', body: JSON.stringify(data) });
export const updateService = (id: string, data: Record<string, unknown>) =>
  fetchApi(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteService = (id: string) =>
  fetchApi(`/services/${id}`, { method: 'DELETE' });
export const updateServiceOverride = (serviceId: string, data: Record<string, unknown>) =>
  fetchApi(`/services/override/${serviceId}`, { method: 'PUT', body: JSON.stringify(data) });

// Servers
export const getServers = () => fetchApi('/servers');
export const addServer = (data: { name: string; host: string; glancesUrl?: string; dockerHost?: string }) =>
  fetchApi('/servers', { method: 'POST', body: JSON.stringify(data) });
export const deleteServer = (id: string) =>
  fetchApi(`/servers/${id}`, { method: 'DELETE' });

// Uptime
export const getUptimeSummary = (serverId = 'local') => fetchApi(`/uptime/summary?serverId=${serverId}`);
export const getUptimeHistory = (serviceId: string, hours = 24) => fetchApi(`/uptime/${serviceId}?hours=${hours}`);
export const getUptimeTimeline = (serviceId: string, days = 30) => fetchApi(`/uptime/timeline/${serviceId}?days=${days}`);

// Portfolio
export const getPortfolioDashboard = () => fetchApi('/portfolio/dashboard');
export const getPortfolioRequests = () => fetchApi('/portfolio/requests');
export const getPortfolioInvoices = () => fetchApi('/portfolio/invoices');
export const getPortfolioCustomers = () => fetchApi('/portfolio/customers');
export const getPortfolioAppointments = () => fetchApi('/portfolio/appointments');
export const getNotifications = () => fetchApi('/portfolio/notifications');
export const markNotificationRead = (id: string) => fetchApi(`/portfolio/notifications/${id}/read`, { method: 'PUT' });
export const clearNotifications = () => fetchApi('/portfolio/notifications', { method: 'DELETE' });

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
export const getComposeProjects = () => fetchApi('/docker/compose/projects');
export const composeAction = (project: string, action: string) =>
  fetchApi(`/docker/compose/${encodeURIComponent(project)}/${action}`, { method: 'POST' });
export const getComposeFile = (project: string) =>
  fetchApi<{ content: string; path: string; workingDir: string }>(`/docker/compose/${encodeURIComponent(project)}/file`);
export const saveComposeFile = (project: string, content: string) =>
  fetchApi(`/docker/compose/${encodeURIComponent(project)}/file`, { method: 'PUT', body: JSON.stringify({ content }) });

// Docker Disk Usage
export const getDiskUsage = () => fetchApi('/docker/disk-usage');

// Container Stats (batch)
export const getAllContainerStats = () => fetchApi('/docker/stats/all');

// Image Updates
export const checkImageUpdates = () => fetchApi('/docker/updates/check');
export const pullAndRecreate = (containerId: string) =>
  fetchApi(`/docker/updates/pull/${containerId}`, { method: 'POST' });

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

// Audit
export const getAuditLog = (limit = 50) => fetchApi(`/audit?limit=${limit}`);

// Backups
export const getBackups = (limit = 20) => fetchApi(`/backup?limit=${limit}`);
export const getBackupStatus = () => fetchApi<{ running: boolean; latest: any }>('/backup/status');
export const runBackup = (type = 'database') => fetchApi('/backup/run', { method: 'POST', body: JSON.stringify({ type }) });

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

// Tracker - Tasks
export const getTrackerTasks = () => fetchApi('/tracker/tasks');
export const createTrackerTask = (data: { title: string; description?: string; estimated_time?: number; category?: string; labels?: string[]; project_id?: string; subtasks?: { text: string; completed: boolean }[] }) =>
  fetchApi('/tracker/tasks', { method: 'POST', body: JSON.stringify(data) });
export const updateTrackerTask = (id: string, data: Record<string, unknown>) =>
  fetchApi(`/tracker/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const moveTrackerTask = (id: string, status: string, sort_order?: number) =>
  fetchApi(`/tracker/tasks/${id}/move`, { method: 'PUT', body: JSON.stringify({ status, sort_order }) });
export const completeTrackerTask = (id: string, actual_time: number) =>
  fetchApi(`/tracker/tasks/${id}/complete`, { method: 'PUT', body: JSON.stringify({ actual_time }) });
export const deleteTrackerTask = (id: string) =>
  fetchApi(`/tracker/tasks/${id}`, { method: 'DELETE' });
export const clearDoneTasks = () =>
  fetchApi('/tracker/tasks/done', { method: 'DELETE' });

// Tracker - Projects
export const getTrackerProjects = () => fetchApi('/tracker/projects');
export const createTrackerProject = (data: { name: string; color?: string }) =>
  fetchApi('/tracker/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateTrackerProject = (id: string, data: Record<string, unknown>) =>
  fetchApi(`/tracker/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTrackerProject = (id: string) =>
  fetchApi(`/tracker/projects/${id}`, { method: 'DELETE' });

// Tracker - Player & Achievements
export const getTrackerPlayer = () => fetchApi('/tracker/player');
export const updateDailyGoal = (daily_goal: number) =>
  fetchApi('/tracker/player/goal', { method: 'PUT', body: JSON.stringify({ daily_goal }) });
export const getTrackerAchievements = () => fetchApi('/tracker/achievements');
export const getTrackerCategories = () => fetchApi('/tracker/categories');

// Tracker - Stats
export const getTrackerStatsToday = () => fetchApi('/tracker/stats/today');
export const getTrackerStatsWeek = () => fetchApi('/tracker/stats/week');
export const getTrackerHeatmap = () => fetchApi('/tracker/stats/heatmap');
export const getTrackerAccuracy = () => fetchApi('/tracker/stats/accuracy');

// Tracker - Notes
export const getTrackerNotes = () => fetchApi('/tracker/notes');
export const createTrackerNote = (data: { title: string; content?: string }) =>
  fetchApi('/tracker/notes', { method: 'POST', body: JSON.stringify(data) });
export const updateTrackerNote = (id: string, data: Record<string, unknown>) =>
  fetchApi(`/tracker/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTrackerNote = (id: string) =>
  fetchApi(`/tracker/notes/${id}`, { method: 'DELETE' });

// Tracker - Backup
export const exportTrackerBackup = () => fetchApi('/tracker/backup/export');
export const importTrackerBackup = (data: unknown) =>
  fetchApi('/tracker/backup/import', { method: 'POST', body: JSON.stringify(data) });

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
export const addUserMailAccount = (data: { email: string; password: string; displayName?: string }) =>
  fetchApi<MailAccount>('/mail/accounts', { method: 'POST', body: JSON.stringify(data) });
export const activateUserMailAccount = (id: number) =>
  fetchApi<{ ok: boolean; email: string }>(`/mail/accounts/${id}/activate`, { method: 'PUT' });
export const deleteUserMailAccount = (id: number) =>
  fetchApi<{ ok: boolean }>(`/mail/accounts/${id}`, { method: 'DELETE' });

// Admin (Stalwart Server Management)
export const getMailAccounts = () => fetchApi('/mail/admin/accounts');
export const createMailAccount = (data: { username: string; password: string; displayName?: string; domain?: string }) =>
  fetchApi('/mail/admin/accounts', { method: 'POST', body: JSON.stringify(data) });
export const deleteMailAccount = (username: string) =>
  fetchApi(`/mail/admin/accounts/${encodeURIComponent(username)}`, { method: 'DELETE' });
export const updateMailAccountPassword = (username: string, password: string) =>
  fetchApi(`/mail/admin/accounts/${encodeURIComponent(username)}/password`, { method: 'PUT', body: JSON.stringify({ password }) });
export const getMailDomains = () => fetchApi('/mail/admin/domains');
export const getMailDkim = (domain: string) => fetchApi(`/mail/admin/dkim/${encodeURIComponent(domain)}`);
