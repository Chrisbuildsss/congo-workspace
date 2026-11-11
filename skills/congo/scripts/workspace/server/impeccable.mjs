// Impeccable's own live helper, used as-is. The workspace boots it on its
// working area with `impeccable live`, sends actions as `steer` events, and
// reads replies from the helper's event stream. Nothing here changes how the
// engine, its commands or its live editor behave.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { helperInfo, helperStatus } from './live.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const AREA_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Congo workspace area</title></head>
<body><p>Congo workspace working area. Designs live in designs/.</p></body></html>
`;

export const AREA_CONFIG = {
  files: ['index.html', 'designs/**/*.html'],
  exclude: ['sources/**'],
  insertBefore: '</body>',
  commentSyntax: 'html',
  cspChecked: true,
};

/** The Impeccable skill launcher installed next to the Congo skill. */
export function findLauncher(env = process.env) {
  const name = process.platform === 'win32' ? 'impeccable.cmd' : 'impeccable';
  const candidates = [
    env.IMPECCABLE_LAUNCHER,
    // Installed: <skills>/congo/scripts/workspace/server -> <skills>/impeccable/scripts
    path.resolve(here, '..', '..', '..', '..', 'impeccable', 'scripts', name),
    // This repository: skills/congo/... -> skill/scripts
    path.resolve(here, '..', '..', '..', '..', '..', 'skill', 'scripts', name),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function referenceDir(launcher) {
  if (!launcher) return null;
  const dir = path.resolve(path.dirname(launcher), '..', 'reference');
  return fs.existsSync(dir) ? dir : null;
}

/** Runs a launcher verb with output to a file, never a pipe: on Windows the
 * detached helper would inherit a pipe and keep the caller waiting. */
export function runImpeccable(launcher, args, { cwd, outFile, timeoutMs = 60000, env = process.env }) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const fd = fs.openSync(outFile, 'w');
    const options = { cwd, env, stdio: ['ignore', fd, fd], windowsHide: true };
    const child = process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', `"${launcher}" ${args.join(' ')}`], { ...options, windowsVerbatimArguments: true })
      : spawn('sh', [launcher, ...args], options);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`impeccable ${args[0]} timed out`));
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      fs.closeSync(fd);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      fs.closeSync(fd);
      resolve({ code, output: fs.readFileSync(outFile, 'utf8') });
    });
  });
}

function lastJson(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return null;
  }
}

export function prepareArea(area) {
  fs.mkdirSync(path.join(area, 'designs'), { recursive: true });
  fs.mkdirSync(path.join(area, '.impeccable', 'live'), { recursive: true });
  const page = path.join(area, 'index.html');
  if (!fs.existsSync(page)) fs.writeFileSync(page, AREA_PAGE);
  const config = path.join(area, '.impeccable', 'live', 'config.json');
  if (!fs.existsSync(config)) fs.writeFileSync(config, JSON.stringify(AREA_CONFIG, null, 2));
}

/** Boots (or reuses) the live helper for the working area. */
export async function ensureHelper(area, launcher, logDir) {
  const status = await helperStatus(area);
  if (status.running) return helperInfo(area);
  if (!launcher) throw Object.assign(new Error('Impeccable is not installed next to the Congo skill'), { status: 409 });
  prepareArea(area);
  const { output } = await runImpeccable(launcher, ['live', '--allow-missing-context'], {
    cwd: area,
    outFile: path.join(logDir, 'impeccable-live.json'),
  });
  const result = lastJson(output);
  if (!result?.ok) {
    const reason = result?.error ? `${result.error}` : output.trim().slice(0, 200);
    throw Object.assign(new Error(`Impeccable live did not start: ${reason}`), { status: 502 });
  }
  return { port: result.serverPort, token: result.serverToken };
}

export async function postSteer(info, { id, message, pageUrl }) {
  const response = await fetch(`http://127.0.0.1:${info.port}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: info.token, id, type: 'steer', message, ...(pageUrl ? { pageUrl } : {}) }),
    signal: AbortSignal.timeout(5000),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(value.error || `Impeccable refused the request (${response.status})`), { status: 502 });
  return value;
}

/** Follows the helper's event stream; reconnects while the workspace runs. */
export function followEvents(getInfo, onEvent, log = () => {}) {
  let stopped = false;
  let request = null;
  let retry = null;
  const connect = () => {
    if (stopped) return;
    const info = getInfo();
    if (!info) {
      retry = setTimeout(connect, 2000);
      return;
    }
    request = http.get(
      { host: '127.0.0.1', port: info.port, path: `/events?token=${encodeURIComponent(info.token)}`, headers: { Accept: 'text/event-stream' } },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          retry = setTimeout(connect, 3000);
          return;
        }
        res.setEncoding('utf8');
        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk;
          let at;
          while ((at = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, at);
            buffer = buffer.slice(at + 2);
            const data = frame.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
            if (!data) continue;
            try {
              onEvent(JSON.parse(data), info);
            } catch (error) {
              log(`event parse: ${error.message}`);
            }
          }
        });
        res.on('end', () => {
          if (!stopped) retry = setTimeout(connect, 1500);
        });
      },
    );
    request.on('error', () => {
      if (!stopped) retry = setTimeout(connect, 3000);
    });
  };
  connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    request?.destroy();
  };
}
