// Reads Impeccable's live helper state. The helper is Impeccable's own
// (`impeccable live`); the workspace only looks at what it already publishes.
import path from 'node:path';
import { readJson } from './store.mjs';

export function helperInfo(root) {
  if (!root) return null;
  const info = readJson(path.join(root, '.impeccable', 'live', 'server.json'), null);
  if (!info || !Number.isInteger(info.port) || typeof info.token !== 'string') return null;
  return { port: info.port, token: info.token, pid: info.pid ?? null };
}

export async function helperStatus(root, timeoutMs = 800) {
  const info = helperInfo(root);
  if (!info) return { running: false, agentPolling: false };
  try {
    const url = `http://127.0.0.1:${info.port}/status?token=${encodeURIComponent(info.token)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { running: false, agentPolling: false };
    const status = await response.json();
    return { running: true, port: info.port, agentPolling: status.agentPolling === true };
  } catch {
    return { running: false, agentPolling: false };
  }
}
