const PORTFOLIO_API = process.env.PORTFOLIO_API_URL || 'http://host.docker.internal:3000';
const PORTFOLIO_PASSWORD = process.env.PORTFOLIO_PASSWORD || 'admin';

let lastKnownState = {
  requestCount: 0,
  customerCount: 0,
  requests: [],
  customers: [],
};

let notifications = [];
let portfolioAvailable = null;
let sessionCookie = null;

// Login to portfolio API and get session cookie
async function login() {
  try {
    const response = await fetch(`${PORTFOLIO_API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PORTFOLIO_PASSWORD }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    // Extract session cookie from Set-Cookie header
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      // Parse just the cookie name=value part
      sessionCookie = setCookie.split(';')[0];
      console.log('Portfolio: Login successful');
      portfolioAvailable = true;
      return true;
    }

    throw new Error('No session cookie returned');
  } catch (error) {
    if (portfolioAvailable !== false) {
      console.error('Portfolio login failed:', error.message);
    }
    portfolioAvailable = false;
    sessionCookie = null;
    return false;
  }
}

async function fetchPortfolio(endpoint) {
  // Try with existing session first
  if (sessionCookie) {
    const response = await fetch(`${PORTFOLIO_API}${endpoint}`, {
      headers: {
        'Accept': 'application/json',
        'Cookie': sessionCookie,
      },
    });

    if (response.ok) {
      portfolioAvailable = true;
      return response.json();
    }

    // If 401, session expired - try re-login
    if (response.status === 401) {
      sessionCookie = null;
    } else {
      throw new Error(`Portfolio API error: ${response.status}`);
    }
  }

  // Login and retry
  const loggedIn = await login();
  if (!loggedIn) {
    throw new Error('Portfolio login failed');
  }

  const response = await fetch(`${PORTFOLIO_API}${endpoint}`, {
    headers: {
      'Accept': 'application/json',
      'Cookie': sessionCookie,
    },
  });

  if (!response.ok) {
    throw new Error(`Portfolio API error: ${response.status}`);
  }

  portfolioAvailable = true;
  return response.json();
}

export async function getDashboardData() {
  try {
    const data = await fetchPortfolio('/api/dashboard');
    return {
      stats: {
        projects: data.stats?.projects || 0,
        customers: data.stats?.customers || 0,
        openRequests: data.stats?.openRequests || 0,
        totalRevenue: data.revenue?.total || 0,
        paidRevenue: data.revenue?.paid || 0,
        openRevenue: data.revenue?.open || 0,
        overdueRevenue: data.revenue?.overdue || 0,
      },
      activities: (data.activities || []).slice(0, 10),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (portfolioAvailable !== false) {
      console.error('Portfolio API unavailable:', error.message);
      portfolioAvailable = false;
    }
    return null;
  }
}

export async function getRequests() {
  try {
    return await fetchPortfolio('/api/admin/requests') || [];
  } catch {
    return [];
  }
}

export async function getInvoices() {
  try {
    return await fetchPortfolio('/api/invoices') || [];
  } catch {
    return [];
  }
}

export async function getAppointments() {
  try {
    return await fetchPortfolio('/api/admin/appointments') || [];
  } catch {
    return [];
  }
}

export async function getCustomers() {
  try {
    return await fetchPortfolio('/api/customers') || [];
  } catch {
    return [];
  }
}

export async function checkForNotifications() {
  try {
    const dashboard = await getDashboardData();
    if (!dashboard) return [];

    const newNotifications = [];
    let newRequests = [];

    // Check for new requests
    if (dashboard.stats.openRequests > lastKnownState.requestCount && lastKnownState.requestCount > 0) {
      const diff = dashboard.stats.openRequests - lastKnownState.requestCount;

      // Fetch actual request details for webhook
      try {
        const allRequests = await getRequests();
        if (Array.isArray(allRequests)) {
          // Find new requests by comparing with last known
          const lastIds = new Set(lastKnownState.requests.map(r => r.id));
          newRequests = allRequests.filter(r => !lastIds.has(r.id));
          lastKnownState.requests = allRequests.slice(0, 50);
        }
      } catch {}

      newNotifications.push({
        id: `req-${Date.now()}`,
        type: 'new-request',
        title: `${diff} neue Anfrage${diff > 1 ? 'n' : ''}`,
        message: `Du hast ${diff} neue Projektanfrage${diff > 1 ? 'n' : ''} erhalten`,
        timestamp: new Date().toISOString(),
        read: false,
        requests: newRequests,
      });
    } else if (lastKnownState.requestCount === 0) {
      // First run - just store current requests
      try {
        const allRequests = await getRequests();
        if (Array.isArray(allRequests)) {
          lastKnownState.requests = allRequests.slice(0, 50);
        }
      } catch {}
    }

    // Check for new customers
    let newCustomers = [];
    if (dashboard.stats.customers > lastKnownState.customerCount && lastKnownState.customerCount > 0) {
      const diff = dashboard.stats.customers - lastKnownState.customerCount;

      // Fetch actual customer details for webhook
      try {
        const allCustomers = await getCustomers();
        if (Array.isArray(allCustomers)) {
          const lastIds = new Set(lastKnownState.customers.map(c => c.id));
          newCustomers = allCustomers.filter(c => !lastIds.has(c.id));
          lastKnownState.customers = allCustomers.slice(0, 50);
        }
      } catch {}

      newNotifications.push({
        id: `cust-${Date.now()}`,
        type: 'new-customer',
        title: `${diff} neue${diff > 1 ? 'r' : ''} Kunde${diff > 1 ? 'n' : ''}`,
        message: `${diff} neue Registrierung${diff > 1 ? 'en' : ''}`,
        timestamp: new Date().toISOString(),
        read: false,
        customers: newCustomers,
      });
    } else if (lastKnownState.customerCount === 0) {
      // First run - store current customers
      try {
        const allCustomers = await getCustomers();
        if (Array.isArray(allCustomers)) {
          lastKnownState.customers = allCustomers.slice(0, 50);
        }
      } catch {}
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

export function isAvailable() {
  return portfolioAvailable;
}
