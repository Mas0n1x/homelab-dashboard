const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api`
  : 'http://localhost:3001/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
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
