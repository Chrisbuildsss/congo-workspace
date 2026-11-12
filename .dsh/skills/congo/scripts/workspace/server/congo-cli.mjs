// The person's own Congo CLI, run as a subprocess. The workspace never reads
// the CLI's sign-in: the CLI uses its saved sign-in itself and prints only
// catalog data. Used for the Library's Saved filter (`congo saved`) and to ask
// whether the account has a subscription (`congo whoami`).
import { spawn } from 'node:child_process';
import path from 'node:path';

/**
 * How to run the CLI. CONGO_CLI may name another CLI for tests or a
 * development checkout: a .mjs/.js script runs with this Node, anything else
 * runs as an executable.
 */
export function congoCommand(env = process.env) {
  const custom = typeof env.CONGO_CLI === 'string' ? env.CONGO_CLI.trim() : '';
  if (custom) {
    return /\.(c|m)?js$/i.test(custom)
      ? { file: process.execPath, args: [path.resolve(custom)], shell: false }
      : { file: custom, args: [], shell: false };
  }
  // npm installs the CLI as congo.cmd on Windows; the arguments here are fixed.
  return process.platform === 'win32'
    ? { file: 'congo.cmd', args: [], shell: true }
    : { file: 'congo', args: [], shell: false };
}

export function runCongo(args, { env = process.env, timeoutMs = 20000 } = {}) {
  const command = congoCommand(env);
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, ...result });
    };
    let child;
    try {
      child = spawn(command.file, [...command.args, ...args], {
        env: { ...env, NO_COLOR: '1' },
        shell: command.shell,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      finish({ code: null, error });
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      finish({ code: null, error: Object.assign(new Error('The Congo CLI did not answer in time'), { code: 'ETIMEDOUT' }) });
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout = (stdout + chunk).slice(-2_000_000); });
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-20_000); });
    child.on('error', (error) => finish({ code: null, error }));
    child.on('close', (code) => finish({ code }));
  });
}

function firstLine(text) {
  return String(text ?? '').split(/\r?\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 200) ?? '';
}

/**
 * The signed-in account's Saved items (the website's bookmarks, which hold
 * apps) as listing ids and slugs. Never throws: a missing, outdated or
 * signed-out CLI comes back with a reason the Library shows as it is.
 */
export async function savedItems({ env = process.env, run = runCongo } = {}) {
  const result = await run(['saved', '--json', '--all'], { env });
  const output = `${result.stdout}\n${result.stderr}`;
  const missing = result.error?.code === 'ENOENT'
    || /is not recognized as an internal or external command|command not found/i.test(output);
  if (missing) {
    return { available: false, signedIn: null, ids: [], slugs: [], reason: 'Install the Congo CLI to see your Saved items' };
  }
  if (result.code === 0) {
    try {
      const parsed = JSON.parse(result.stdout);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      const ids = items.map((item) => item?.id).filter((id) => typeof id === 'string');
      const slugs = items.map((item) => item?.slug).filter((slug) => typeof slug === 'string');
      return { available: true, signedIn: true, ids, slugs, total: ids.length, reason: null };
    } catch {
      return { available: true, signedIn: null, ids: [], slugs: [], reason: 'The Congo CLI returned something unexpected' };
    }
  }
  // Older CLIs don't know `saved` and print their usage instead.
  if (/Usage: congo COMMAND/i.test(output) && !/^\s*saved\s/m.test(output)) {
    return { available: false, signedIn: null, ids: [], slugs: [], reason: 'Update the Congo CLI to see your Saved items' };
  }
  if (/Sign in required/i.test(output)) {
    return { available: true, signedIn: false, ids: [], slugs: [], reason: 'Sign in with congo login to see your Saved items' };
  }
  if (result.error?.code === 'ETIMEDOUT') {
    return { available: true, signedIn: null, ids: [], slugs: [], reason: result.error.message };
  }
  return { available: true, signedIn: null, ids: [], slugs: [], reason: firstLine(result.stderr) || firstLine(result.stdout) || 'The Congo CLI could not list your Saved items' };
}

/**
 * Whether Explore may show the Library: the person's own CLI says whether the
 * signed-in account has an active subscription (`congo whoami --json`). Only
 * the yes or no is kept; the email is never read into the workspace.
 *
 * This is a courtesy gate in open-source code, not protection: anyone can
 * change it. What protects Library source is Congo's server, which refuses a
 * source pull without a subscription whatever this says.
 *
 * Never throws. `state` is one of active, no-subscription, signed-out, no-cli,
 * unknown; `reason` is a line the workspace shows for the last one.
 */
export async function libraryAccess({ env = process.env, run = runCongo } = {}) {
  const result = await run(['whoami', '--json'], { env });
  const output = `${result.stdout}\n${result.stderr}`;
  const missing = result.error?.code === 'ENOENT'
    || /is not recognized as an internal or external command|command not found/i.test(output);
  if (missing) return { allowed: false, state: 'no-cli', reason: null };
  if (result.code === 0) {
    try {
      const active = JSON.parse(result.stdout)?.subscription?.active === true;
      return { allowed: active, state: active ? 'active' : 'no-subscription', reason: null };
    } catch {
      return { allowed: false, state: 'unknown', reason: 'The Congo CLI returned something unexpected' };
    }
  }
  if (/Sign in required/i.test(output)) return { allowed: false, state: 'signed-out', reason: null };
  if (result.error?.code === 'ETIMEDOUT') return { allowed: false, state: 'unknown', reason: result.error.message };
  return { allowed: false, state: 'unknown', reason: firstLine(result.stderr) || firstLine(result.stdout) || 'The Congo CLI could not check your account' };
}
