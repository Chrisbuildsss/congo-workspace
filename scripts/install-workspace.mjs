#!/usr/bin/env node
// Local feature installation only; does not publish, download or select models.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const repo = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const arg = n => { const i=args.indexOf(`--${n}`); return i<0?null:args[i+1]; };
const prefixArg = arg('prefix');
if (!prefixArg) throw Error('Usage: node scripts/install-workspace.mjs --prefix PATH [--runtime FILE] [--project PATH] [--providers codex,cursor,claude]');
const prefix = path.resolve(prefixArg);
const exe = process.platform === 'win32' ? 'impeccable.exe' : 'impeccable';
const runtime = path.resolve(arg('runtime') || process.env.IMPECCABLE_BIN || path.join(repo,'target','release',exe));
const probe = spawnSync(runtime,['workspace','--probe'],{encoding:'utf8',windowsHide:true});
if (probe.status !== 0 || JSON.parse(probe.stdout).protocol !== 1) throw Error('Build this fork runtime first; the selected binary has no workspace support.');
const providers = (arg('providers') || 'codex,cursor,claude').split(',');
const mapping = {codex:['agents','.agents'],cursor:['cursor','.cursor'],claude:['claude-code','.claude']};
const project = arg('project') ? path.resolve(arg('project')) : null;
for (const p of providers) {
  if (!mapping[p]) throw Error(`Unsupported installation provider: ${p}`);
  const [build,dir]=mapping[p];
  for (const skill of ['impeccable','redesign']) {
    const from=path.join(repo,'dist',build,dir,'skills',skill);
    if(!fs.existsSync(path.join(from,'SKILL.md'))) throw Error(`Build provider output first: missing ${from}`);
    if(project && fs.existsSync(path.join(project,dir,'skills',skill))) throw Error(`Existing ${skill} skill retained at ${project}. Install into a fresh target or update the intended copy yourself.`);
  }
}
fs.mkdirSync(path.join(prefix,'bin'),{recursive:true});
const installed=path.join(prefix,'bin',exe);fs.copyFileSync(runtime,installed);fs.chmodSync(installed,0o755);
for (const p of providers) {
  const [build,dir]=mapping[p];
  for (const skill of ['impeccable','redesign']) {
    const from=path.join(repo,'dist',build,dir,'skills',skill);
    const to=path.join(prefix,'distribution',p,dir,'skills',skill);
    fs.cpSync(from,to,{recursive:true});
    // The upstream launcher keeps its behavior, but this installation uses
    // the engine we just built instead of the upstream released binary.
    if(skill==='impeccable') {const target={win32:'windows',darwin:'darwin',linux:'linux'}[process.platform]+'-'+process.arch;const bin=path.join(to,'scripts','bin',target,exe);fs.mkdirSync(path.dirname(bin),{recursive:true});fs.copyFileSync(runtime,bin);fs.chmodSync(bin,0o755);}
    if(project) fs.cpSync(to,path.join(project,dir,'skills',skill),{recursive:true});
  }
}
for(const name of ['LICENSE','NOTICE.md']) fs.copyFileSync(path.join(repo,name),path.join(prefix,name));
const base=process.env.LOCALAPPDATA || process.env.XDG_DATA_HOME || path.join(os.homedir(),'.local','share');
const registration=process.env.CONGO_WORKSPACE_REGISTRATION || path.join(base,process.platform==='win32'?'Congo':'congo','workspace-runtime.json');
fs.mkdirSync(path.dirname(registration),{recursive:true});
fs.writeFileSync(registration,JSON.stringify({protocol:1,executable:installed,installedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({prefix,executable:installed,registration,providers,project,start:'congo workspace'},null,2));
