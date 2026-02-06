import { getDb } from './database.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
let isRunning = false;

export async function runSpeedtest() {
  if (isRunning) return null;
  isRunning = true;

  try {
    // Try speedtest-cli first, fallback to a simple download test
    let result;
    try {
      const { stdout } = await execAsync('speedtest-cli --json --secure', { timeout: 120000 });
      const data = JSON.parse(stdout);
      result = {
        download: data.download / 1_000_000, // bits to Mbps
        upload: data.upload / 1_000_000,
        ping: data.ping,
        server: data.server?.sponsor || 'Unknown',
      };
    } catch {
      // Fallback: simple curl-based test
      const start = Date.now();
      try {
        await execAsync('curl -so /dev/null -w "%{speed_download}" http://speedtest.tele2.net/1MB.zip', { timeout: 30000 });
        const elapsed = (Date.now() - start) / 1000;
        result = {
          download: (8 / elapsed), // rough Mbps estimate from 1MB file
          upload: 0,
          ping: 0,
          server: 'Fallback (curl)',
        };
      } catch {
        result = { download: 0, upload: 0, ping: 0, server: 'Fehler' };
      }
    }

    // Save to database
    const db = getDb();
    db.prepare(
      'INSERT INTO speedtest_results (download, upload, ping, server) VALUES (?, ?, ?, ?)'
    ).run(result.download, result.upload, result.ping, result.server);

    return result;
  } finally {
    isRunning = false;
  }
}

export function getHistory(limit = 50) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM speedtest_results ORDER BY tested_at DESC LIMIT ?'
  ).all(limit);
}

export function getLatest() {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM speedtest_results ORDER BY tested_at DESC LIMIT 1'
  ).get() || null;
}

export function isTestRunning() {
  return isRunning;
}
