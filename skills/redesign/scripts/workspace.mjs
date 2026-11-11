#!/usr/bin/env node
// Fork-only runtime resolver. No model calls, credential handling or downloads.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
export function runtimePath(env = process.env) {
  if (env.CONGO_WORKSPACE_BIN) return env.CONGO_WORKSPACE_BIN;
  const base = env.LOCALAPPDATA || env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  const file = env.CONGO_WORKSPACE_REGISTRATION || path.join(base, process.platform === 'win32' ? 'Congo' : 'congo', 'workspace-runtime.json');
  try { const record = JSON.parse(fs.readFileSync(file, 'utf8')); return record.protocol === 1 ? record.executable : null; } catch { return null; }
}
const executable = runtimePath();
if (!executable || !path.isAbsolute(executable) || !fs.existsSync(executable)) {
  console.error('Install the Congo × Impeccable fork workspace first: build this fork, then run node scripts/install-workspace.mjs --prefix <local-install>. See https://github.com/Chrisbuildsss/Congo-x-Impeccable.');
  process.exitCode = 1;
} else {
  const probe = spawnSync(executable, ['workspace', '--probe'], { encoding: 'utf8', windowsHide: true });
  let valid = false; try { valid = probe.status === 0 && JSON.parse(probe.stdout).protocol === 1; } catch {}
  if (!valid) { console.error('The configured runtime does not support the Congo workspace. Install the built fork runtime.'); process.exitCode = 1; }
  else { const args=process.argv.slice(2);const forwarded=args[0]==='question'?['serve-question',...args.slice(1)]:args[0]==='engine'?args.slice(1):['workspace',...args];const result = spawnSync(executable, forwarded, {stdio:'inherit',windowsHide:true}); if (result.error) console.error(result.error.message); process.exitCode = result.status ?? 1; }
}
