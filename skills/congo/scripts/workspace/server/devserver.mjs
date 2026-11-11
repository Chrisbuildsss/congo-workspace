// Live App: runs the user's project's own dev command, only when they click
// Start, and keeps its state, output and local URL. Stop ends the whole tree.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SCRIPTS = ['dev', 'start', 'serve'];
const LOOPBACK_URL = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0):\d{2,5}(?:\/[^\s'"\u001b]*)?/i;
const MAX_LINES = 400;

/** The project's own dev command, from package.json and its lockfile. */
export function detectDevCommand(appPath) {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(appPath, 'package.json'), 'utf8'));
  } catch {
    return { ok: false, reason: 'No package.json in this folder' };
  }
  const script = SCRIPTS.find((name) => typeof pkg.scripts?.[name] === 'string');
  if (!script) return { ok: false, reason: 'package.json has no dev, start or serve script' };
  const has = (file) => fs.existsSync(path.join(appPath, file));
  const manager = has('pnpm-lock.yaml') ? 'pnpm' : has('yarn.lock') ? 'yarn' : has('bun.lock') || has('bun.lockb') ? 'bun' : 'npm';
  const declares = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }).length > 0;
  const needsInstall = declares && !fs.existsSync(path.join(appPath, 'node_modules'));
  return {
    ok: true,
    manager,
    script,
    body: pkg.scripts[script],
    label: `${manager} run ${script}`,
    needsInstall,
  };
}

function strip(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

export function normalizeUrl(raw) {
  const url = new URL(raw);
  if (url.hostname === '0.0.0.0' || url.hostname === '[::1]') url.hostname = '127.0.0.1';
  return url.href;
}

export class DevServers {
  constructor({ log = () => {} } = {}) {
    this.log = log;
    this.runs = new Map();
  }

  status(app) {
    const run = this.runs.get(app.id);
    const detected = detectDevCommand(app.path);
    if (!run) return { status: 'stopped', detected, url: null, output: [], pid: null, exitCode: null };
    return {
      status: run.status,
      detected,
      url: run.url,
      output: run.lines.slice(-200),
      pid: run.child?.pid ?? null,
      exitCode: run.exitCode,
      startedAt: run.startedAt,
      startedBy: run.startedBy,
    };
  }

  /** A URL found another way (the user's AI started the app). */
  attachUrl(app, url, startedBy = 'ai') {
    const existing = this.runs.get(app.id);
    if (existing?.child && existing.status !== 'exited') {
      existing.url = normalizeUrl(url);
      return;
    }
    this.runs.set(app.id, { status: 'running', url: normalizeUrl(url), lines: [`Started by your AI at ${url}`], child: null, exitCode: null, startedAt: new Date().toISOString(), startedBy });
  }

  start(app) {
    const current = this.runs.get(app.id);
    if (current?.child && ['starting', 'running'].includes(current.status)) return this.status(app);
    const detected = detectDevCommand(app.path);
    if (!detected.ok) throw Object.assign(new Error(detected.reason), { status: 409 });
    if (detected.needsInstall) {
      throw Object.assign(new Error('Dependencies are not installed yet. Ask your AI to start it, or install them first.'), { status: 409 });
    }
    const run = { status: 'starting', url: null, lines: [`$ ${detected.label}`], child: null, exitCode: null, startedAt: new Date().toISOString(), startedBy: 'workspace' };
    const options = { cwd: app.path, env: { ...process.env, FORCE_COLOR: '0', BROWSER: 'none' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true };
    const child = process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', `${detected.manager} run ${detected.script}`], options)
      : spawn(detected.manager, ['run', detected.script], { ...options, detached: true });
    run.child = child;
    const onData = (chunk) => {
      for (const line of strip(chunk.toString('utf8')).split(/\r?\n/)) {
        if (!line.trim()) continue;
        run.lines.push(line);
        if (run.lines.length > MAX_LINES) run.lines.splice(0, run.lines.length - MAX_LINES);
        if (!run.url) {
          const match = LOOPBACK_URL.exec(line);
          if (match) {
            run.url = normalizeUrl(match[0]);
            run.status = 'running';
          }
        }
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (error) => {
      run.lines.push(`Could not start: ${error.message}`);
      run.status = 'exited';
    });
    child.on('exit', (code) => {
      run.exitCode = code;
      run.status = 'exited';
      run.lines.push(`Process ended${code === null ? '' : ` with code ${code}`}.`);
      run.child = null;
    });
    this.runs.set(app.id, run);
    this.log(`dev server started for ${app.name} (pid ${child.pid})`);
    return this.status(app);
  }

  stop(app) {
    const run = this.runs.get(app.id);
    if (!run) return this.status(app);
    if (run.child?.pid) {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(run.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } else {
        try { process.kill(-run.child.pid, 'SIGTERM'); } catch {}
      }
    }
    this.runs.delete(app.id);
    return this.status(app);
  }

  stopAll() {
    for (const [id, run] of this.runs) {
      if (run.child) this.stop({ id, path: '', name: id });
    }
  }
}
