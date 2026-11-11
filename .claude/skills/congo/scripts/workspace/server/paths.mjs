// Where the local workspace keeps its state and working area.
// Override with CONGO_WORKSPACE_HOME (tests, portable installs).
import os from 'node:os';
import path from 'node:path';

export function dataDir(env = process.env) {
  if (env.CONGO_WORKSPACE_HOME) return path.resolve(env.CONGO_WORKSPACE_HOME);
  if (process.platform === 'win32') {
    const base = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'Congo', 'workspace');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Congo', 'workspace');
  }
  const base = env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(base, 'congo', 'workspace');
}

export function layout(root) {
  const area = path.join(root, 'area');
  return {
    root,
    server: path.join(root, 'server.json'),
    runtime: path.join(root, 'runtime.json'),
    state: path.join(root, 'state.json'),
    log: path.join(root, 'workspace.log'),
    area,
    designs: path.join(area, 'designs'),
    requests: path.join(area, 'requests'),
    sources: path.join(area, 'sources'),
  };
}
