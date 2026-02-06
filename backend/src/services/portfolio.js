const PORTFOLIO_API = process.env.PORTFOLIO_API_URL || 'http://host.docker.internal:3000';

let lastKnownState = {
  requestCount: 0,
  customerCount: 0,
  activities: []
};

let notifications = [];

async function fetchPortfolio(endpoint) {
  const response = await fetch(`${PORTFOLIO_API}${endpoint}`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`Portfolio API error: ${response.status}`);
  }
  return response.json();
}

export async function getDashboardData() {
  try {
    const data = await fetchPortfolio('/api/dashboard');
    return {
      stats: {
        projects: data.stats?.totalProjects || 0,
        customers: data.stats?.totalCustomers || 0,
        openRequests: data.stats?.openRequests || 0,
        totalRevenue: data.stats?.totalRevenue || 0,
        paidRevenue: data.stats?.paidRevenue || 0,
        openRevenue: data.stats?.openRevenue || 0,
        overdueRevenue: data.stats?.overdueRevenue || 0
      },
      activities: (data.activities || []).slice(0, 10),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Portfolio API error:', error.message);
    return null;
  }
}

export async function getRequests() {
  try {
    const requests = await fetchPortfolio('/api/admin/requests');
    return Array.isArray(requests) ? requests : [];
  } catch (error) {
    console.error('Portfolio requests error:', error.message);
    return [];
  }
}

export async function getInvoices() {
  try {
    const invoices = await fetchPortfolio('/api/invoices');
    return Array.isArray(invoices) ? invoices : [];
  } catch (error) {
    console.error('Portfolio invoices error:', error.message);
    return [];
  }
}

export async function getAppointments() {
  try {
    const appointments = await fetchPortfolio('/api/admin/appointments');
    return Array.isArray(appointments) ? appointments : [];
  } catch (error) {
    console.error('Portfolio appointments error:', error.message);
    return [];
  }
}

export async function checkForNotifications() {
  try {
    const dashboard = await getDashboardData();
    if (!dashboard) return [];

    const newNotifications = [];

    // Check for new requests
    if (dashboard.stats.openRequests > lastKnownState.requestCount && lastKnownState.requestCount > 0) {
      const diff = dashboard.stats.openRequests - lastKnownState.requestCount;
      newNotifications.push({
        id: `req-${Date.now()}`,
        type: 'new-request',
        title: `${diff} neue Anfrage${diff > 1 ? 'n' : ''}`,
        message: `Du hast ${diff} neue Projektanfrage${diff > 1 ? 'n' : ''} erhalten`,
        timestamp: new Date().toISOString(),
        read: false
      });
    }

    // Check for new customers
    if (dashboard.stats.customers > lastKnownState.customerCount && lastKnownState.customerCount > 0) {
      const diff = dashboard.stats.customers - lastKnownState.customerCount;
      newNotifications.push({
        id: `cust-${Date.now()}`,
        type: 'new-customer',
        title: `${diff} neue${diff > 1 ? 'r' : ''} Kunde${diff > 1 ? 'n' : ''}`,
        message: `${diff} neue Registrierung${diff > 1 ? 'en' : ''}`,
        timestamp: new Date().toISOString(),
        read: false
      });
    }

    lastKnownState.requestCount = dashboard.stats.openRequests;
    lastKnownState.customerCount = dashboard.stats.customers;

    if (newNotifications.length > 0) {
      notifications = [...newNotifications, ...notifications].slice(0, 50);
    }

    return newNotifications;
  } catch {
    return [];
  }
}

export function getNotifications() {
  return notifications;
}

export function markNotificationRead(id) {
  const notif = notifications.find(n => n.id === id);
  if (notif) notif.read = true;
}

export function clearNotifications() {
  notifications = [];
}
