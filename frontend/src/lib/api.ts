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

// Portfolio
export const getPortfolioDashboard = () => fetchApi('/portfolio/dashboard');
export const getPortfolioRequests = () => fetchApi('/portfolio/requests');
export const getPortfolioInvoices = () => fetchApi('/portfolio/invoices');
export const getPortfolioAppointments = () => fetchApi('/portfolio/appointments');
export const getNotifications = () => fetchApi('/portfolio/notifications');
export const markNotificationRead = (id: string) => fetchApi(`/portfolio/notifications/${id}/read`, { method: 'PUT' });
export const clearNotifications = () => fetchApi('/portfolio/notifications', { method: 'DELETE' });
