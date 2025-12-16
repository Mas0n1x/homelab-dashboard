import { writable } from 'svelte/store';

export const systemStats = writable(null);
export const containers = writable([]);
export const dockerInfo = writable(null);
export const services = writable([]);
export const connected = writable(false);

const API_URL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : 'http://localhost:3001';

const WS_URL = typeof window !== 'undefined'
  ? `ws://${window.location.hostname}:3001/ws`
  : 'ws://localhost:3001/ws';

let ws = null;
let reconnectTimeout = null;

export function connectWebSocket() {
  if (typeof window === 'undefined') return;

  if (ws) {
    ws.close();
  }

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('WebSocket connected');
    connected.set(true);
    ws.send(JSON.stringify({ type: 'subscribe' }));
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'stats') {
        if (message.data.system) {
          systemStats.set(message.data.system);
        }
        if (message.data.containers) {
          containers.set(message.data.containers);
        }
        if (message.data.docker) {
          dockerInfo.set(message.data.docker);
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    connected.set(false);
    // Reconnect after 3 seconds
    reconnectTimeout = setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

export function disconnectWebSocket() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  if (ws) {
    ws.send(JSON.stringify({ type: 'unsubscribe' }));
    ws.close();
    ws = null;
  }
}

// API functions
export async function fetchServices() {
  try {
    const response = await fetch(`${API_URL}/api/services`);
    const data = await response.json();
    services.set(data);
    return data;
  } catch (error) {
    console.error('Error fetching services:', error);
    return [];
  }
}

export async function addService(service) {
  try {
    const response = await fetch(`${API_URL}/api/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(service)
    });
    const newService = await response.json();
    await fetchServices();
    return newService;
  } catch (error) {
    console.error('Error adding service:', error);
    throw error;
  }
}

export async function deleteService(id) {
  try {
    await fetch(`${API_URL}/api/services/${id}`, { method: 'DELETE' });
    await fetchServices();
  } catch (error) {
    console.error('Error deleting service:', error);
    throw error;
  }
}

export async function containerAction(containerId, action) {
  try {
    const response = await fetch(`${API_URL}/api/docker/containers/${containerId}/${action}`, {
      method: 'POST'
    });
    return await response.json();
  } catch (error) {
    console.error(`Error ${action} container:`, error);
    throw error;
  }
}

export async function getContainerLogs(containerId, tail = 100) {
  try {
    const response = await fetch(`${API_URL}/api/docker/containers/${containerId}/logs?tail=${tail}`);
    const data = await response.json();
    return data.logs;
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
}
