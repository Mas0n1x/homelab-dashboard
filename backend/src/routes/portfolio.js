import { Router } from 'express';
import * as portfolio from '../services/portfolio.js';

const router = Router();

// Get portfolio dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const data = await portfolio.getDashboardData();
    if (!data) {
      return res.status(503).json({ error: 'Portfolio API unavailable' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio data', message: error.message });
  }
});

// Get requests
router.get('/requests', async (req, res) => {
  try {
    const requests = await portfolio.getRequests();
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch requests', message: error.message });
  }
});

// Get invoices
router.get('/invoices', async (req, res) => {
  try {
    const invoices = await portfolio.getInvoices();
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoices', message: error.message });
  }
});

// Get customers
router.get('/customers', async (req, res) => {
  try {
    const customers = await portfolio.getCustomers();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers', message: error.message });
  }
});

// Get appointments
router.get('/appointments', async (req, res) => {
  try {
    const appointments = await portfolio.getAppointments();
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments', message: error.message });
  }
});

// Get notifications
router.get('/notifications', (req, res) => {
  try {
    res.json(portfolio.getNotifications());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications', message: error.message });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', (req, res) => {
  try {
    portfolio.markNotificationRead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification', message: error.message });
  }
});

// Clear all notifications
router.delete('/notifications', (req, res) => {
  try {
    portfolio.clearNotifications();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear notifications', message: error.message });
  }
});

export default router;
