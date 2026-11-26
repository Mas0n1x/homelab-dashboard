/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Terminals, Host-Shell und Log-Streams über WebSocket
import fs from 'fs';
import { Client as SSHClient } from 'ssh2';
import serverManager from '../services/serverManager.js';

// Terminal sessions: ws -> { exec, stream }
const terminalSessions = new Map();
// Log streaming sessions: ws -> Map<containerId, stream>
const logSessions = new Map();

export async function handleTerminalOpen(ws, data) {
  const serverId = data.serverId || 'local';
  const containerId = data.containerId;

  const docker = serverManager.getDocker(serverId);
  if (!docker) {
    ws.send(JSON.stringify({ type: 'terminal-error', error: 'Server nicht verbunden' }));
    return;
  }

  try {
    // Close existing session if any
    if (terminalSessions.has(ws)) {
      const old = terminalSessions.get(ws);
      try { old.stream?.destroy(); } catch {}
      terminalSessions.delete(ws);
    }

    const container = docker.getContainer(containerId);
    const info = await container.inspect();

    if (!info.State.Running) {
      ws.send(JSON.stringify({ type: 'terminal-error', error: 'Container läuft nicht' }));
      return;
    }

    // Try sh first (works in Alpine), fall back to bash
    const exec = await container.exec({
      Cmd: ['/bin/sh'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Env: ['TERM=xterm-256color', 'COLUMNS=120', 'LINES=30']
    });

    const stream = await exec.start({ hijack: true, stdin: true, Tty: true });

    terminalSessions.set(ws, { exec, stream, containerId });

    stream.on('data', (chunk) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'terminal-data',
          data: chunk.toString('base64')
        }));
      }
    });

    stream.on('end', () => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'terminal-closed' }));
      }
      terminalSessions.delete(ws);
    });

    ws.send(JSON.stringify({
      type: 'terminal-opened',
      containerId,
      name: info.Name.replace(/^\//, '')
    }));

    console.log(`Terminal opened for container ${info.Name}`);
  } catch (error) {
    ws.send(JSON.stringify({ type: 'terminal-error', error: error.message }));
  }
}

// Interaktive Root-Shell zum Server-HOST via SSH (nicht Container).
// Nutzt die SSH-Zugangsdaten aus der servers-Tabelle. Ist der SSH-User nicht root,
// wird direkt in eine root-Login-Shell (sudo -i) gewechselt.
export async function handleHostShellOpen(ws, data) {
  const serverId = data.serverId || 'local';
  const conn = serverManager.getConnection(serverId);
  if (!conn) {
    ws.send(JSON.stringify({ type: 'terminal-error', error: 'Server nicht gefunden' }));
    return;
  }
  const cfg = conn.config;
  const host = cfg.ssh_host || process.env.LOCAL_SSH_HOST || 'host.docker.internal';
  const port = cfg.ssh_port || 22;
  const username = cfg.ssh_user || 'root';
  const keyPath = cfg.ssh_key_path || process.env.SSH_KEY_PATH;

  let privateKey;
  try {
    privateKey = fs.readFileSync(keyPath);
  } catch {
    ws.send(JSON.stringify({ type: 'terminal-error', error: `SSH-Schlüssel nicht lesbar (${keyPath})` }));
    return;
  }

  cleanupTerminalSession(ws);

  const client = new SSHClient();
  const cols = data.cols || 120;
  const rows = data.rows || 30;

  client.on('ready', () => {
    client.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
      if (err) {
        ws.send(JSON.stringify({ type: 'terminal-error', error: err.message }));
        client.end();
        return;
      }
      terminalSessions.set(ws, { kind: 'ssh', sshClient: client, stream });

      // Root erzwingen, falls als Nicht-root-Nutzer verbunden.
      if (username !== 'root') {
        stream.write('sudo -i\n');
      }

      ws.send(JSON.stringify({
        type: 'terminal-opened',
        name: `${cfg.name} · root@${host}`,
      }));

      const forward = (chunk) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'terminal-data', data: chunk.toString('base64') }));
        }
      };
      stream.on('data', forward);
      stream.stderr?.on('data', forward);

      stream.on('close', () => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'terminal-closed' }));
        try { client.end(); } catch {}
        terminalSessions.delete(ws);
      });
    });
  });

  client.on('error', (err) => {
    ws.send(JSON.stringify({ type: 'terminal-error', error: `SSH: ${err.message}` }));
  });

  client.connect({ host, port, username, privateKey, readyTimeout: 15000, keepaliveInterval: 15000 });
}

export function handleTerminalInput(ws, data) {
  const session = terminalSessions.get(ws);
  if (!session?.stream) return;

  try {
    const buf = Buffer.from(data.data, 'base64');
    session.stream.write(buf);
  } catch {}
}

export async function handleTerminalResize(ws, data) {
  const session = terminalSessions.get(ws);
  if (!session) return;

  try {
    if (session.kind === 'ssh') {
      session.stream?.setWindow(data.rows || 30, data.cols || 120, 0, 0);
      return;
    }
    if (!session.exec) return;
    // Use Docker API to resize the exec TTY
    const docker = serverManager.getDocker(data.serverId || 'local');
    if (!docker) return;

    await docker.getExec(session.exec.id).resize({
      h: data.rows || 30,
      w: data.cols || 120
    });
  } catch {}
}

export async function handleLogStream(ws, data) {
  const serverId = data.serverId || 'local';
  const containerId = data.containerId;
  const tail = data.tail || 100;

  const docker = serverManager.getDocker(serverId);
  if (!docker) {
    ws.send(JSON.stringify({ type: 'log-error', error: 'Server nicht verbunden' }));
    return;
  }

  try {
    // Stop existing log stream for this container
    stopLogStream(ws, containerId);

    const container = docker.getContainer(containerId);
    const stream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: tail,
      timestamps: true,
    });

    if (!logSessions.has(ws)) logSessions.set(ws, new Map());
    logSessions.get(ws).set(containerId, stream);

    stream.on('data', (chunk) => {
      if (ws.readyState === ws.OPEN) {
        // Strip Docker stream header (8 bytes)
        const lines = chunk.toString('utf8');
        ws.send(JSON.stringify({
          type: 'log-data',
          containerId,
          data: lines,
        }));
      }
    });

    stream.on('end', () => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'log-closed', containerId }));
      }
      logSessions.get(ws)?.delete(containerId);
    });

    ws.send(JSON.stringify({ type: 'log-opened', containerId }));
  } catch (error) {
    ws.send(JSON.stringify({ type: 'log-error', containerId, error: error.message }));
  }
}

export function stopLogStream(ws, containerId) {
  const streams = logSessions.get(ws);
  if (!streams) return;
  const stream = streams.get(containerId);
  if (stream) {
    try { stream.destroy(); } catch {}
    streams.delete(containerId);
  }
}

export function cleanupLogSessions(ws) {
  const streams = logSessions.get(ws);
  if (streams) {
    for (const [, stream] of streams) {
      try { stream.destroy(); } catch {}
    }
    logSessions.delete(ws);
  }
}

export function cleanupTerminalSession(ws) {
  const session = terminalSessions.get(ws);
  if (session) {
    try { session.stream?.destroy?.(); } catch {}
    try { if (session.kind === 'ssh') session.sshClient?.end(); } catch {}
    terminalSessions.delete(ws);
  }
}
