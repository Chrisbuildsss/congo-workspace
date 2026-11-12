import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readSourceFiles,replacePlaceholders} from '../scripts/lib/utils.js';
const root=fileURLToPath(new URL('../',import.meta.url));
test('Congo is a separate distributable skill and retains existing command suggestions',()=>{
  const {skills}=readSourceFiles(root);const congo=skills.find(s=>s.name==='congo');assert.ok(congo);
  assert.ok(congo.scripts.some(s=>s.name==='workspace.mjs'));
  assert.ok(congo.scripts.some(s=>s.name==='workspace/ui/index.html'),'the workspace UI ships prebuilt');
  assert.ok(congo.scripts.some(s=>s.name==='workspace/server/server.mjs'));
  for(const s of congo.scripts.filter(s=>s.name.startsWith('workspace/ui/'))) assert.ok(/\.(html|js|css)$/.test(s.name),`text-only UI build: ${s.name}`);
  const suggestions=replacePlaceholders('{{available_commands}}','codex',['impeccable','congo'],['impeccable','congo']);
  assert.match(suggestions,/impeccable critique/);assert.match(suggestions,/impeccable polish/);assert.match(suggestions,/congo/);
});
test('generated required providers ship both skills with resolved placeholders',()=>{
  for(const [provider,dir] of [['agents','.agents'],['codex','.codex'],['cursor','.cursor'],['claude-code','.claude']]){
    const base=path.join(root,'dist',provider,dir,'skills');if(!fs.existsSync(base))continue;
    const skill=fs.readFileSync(path.join(base,'congo','SKILL.md'),'utf8');assert.ok(fs.existsSync(path.join(base,'impeccable','SKILL.md')));assert.ok(!skill.includes('{{'));
    assert.ok(fs.existsSync(path.join(base,'congo','scripts','workspace.mjs')));
    assert.ok(fs.existsSync(path.join(base,'congo','scripts','workspace','ui','index.html')));
    assert.ok(fs.existsSync(path.join(base,'congo','reference','workspace.md')));
    assert.ok(skill.includes('workspace.mjs connect [--project'),'connect, project optional');
    assert.match(skill,/workspace.mjs request --text/);
    assert.match(skill,/live-poll/);
  }
});
const read=(...p)=>fs.readFileSync(path.join(root,...p),'utf8').replace(/\r\n?/g,'\n');
test("Congo builds from real apps, one result by default, with or without the workspace",()=>{
  const src=read('skills','congo','SKILL.src.md');
  assert.match(src,/^name: congo$/m);
  assert.match(src,/build me a CRM for realtors/,'new apps start here too');
  assert.match(src,/redesign my dashboard/,'redesigns still trigger it');
  assert.match(src,/You are the only AI/);
  assert.match(src,/\*\*One result by default\.\*\*/);
  assert.match(src,/\*\*Whole app or screens is your call,\*\*/);
  assert.match(src,/\*\*Adapt before building\.\*\*/);
  assert.match(src,/There is no fixed routine/);
  assert.match(src,/## Without the workspace/,'"build me X from Congo" works without the workspace');
  assert.match(src,/congo create <template-id> --project <new folder>/);
  assert.match(src,/Only \*\*Use this\*\*/,'only Use this changes the project');
  assert.doesNotMatch(src,/—/,'no em dashes');
});
test('workspace.md: Send and Library actions make prototypes; Use this is the only project change',()=>{
  const ref=read('skills','congo','reference','workspace.md');
  for(const section of ['## `send`: Library items with notes','## `library`: one Library item','## `compose`','## `tweak`','## `build`: Use this','## Live editing a prototype']) assert.ok(ref.includes(section),section);
  assert.match(ref,/\*\*One prototype per request\.\*\*/);
  assert.match(ref,/Prototypes are made in the working area, never in the user's project/);
  assert.match(ref,/"root": true/,'whole-app prototypes run at their own address');
  assert.match(ref,/congo create <template-id> --project <new folder>/,'Use this on a new app');
  assert.match(ref,/workspace\.mjs connect --project <new folder>/,'the new app is attached for My app');
  assert.doesNotMatch(ref,/—/,'no em dashes');
});
test('no fixed three-app, three-version round anywhere in the Congo instructions',()=>{
  for(const file of [['skills','congo','SKILL.src.md'],['skills','congo','reference','workspace.md'],['skill','reference','congo.md'],['skill','reference','new-work.md'],['skill','SKILL.src.md']]){
    assert.doesNotMatch(read(...file),/three (closest|real|congo) apps|three versions|three alternatives|usually three|Pick the app to build on/i,file.join('/'));
  }
});
test('the skill never hardcodes specific Congo apps, not even as examples',()=>{
  // Apps in the Congo catalog on 2026-11-11. The skill chooses from what the Library holds.
  const names=['Hateable','Dawdle','Ghosted','Hornett','Squiggle','Fewchat','Fumbler','Smudge','Bugbase','Shelfmade','Hush','Thorndesk','Stumble','Drama','Quibble','Crooked','Popped','Mumble','Minus','Dabble','Editr'];
  const pattern=new RegExp(`\\b(${names.join('|')})\\b|\\b(${names.map((n)=>n.toLowerCase()).join('|')})-[a-z0-9]`);
  for(const file of [['skills','congo','SKILL.src.md'],['skills','congo','reference','workspace.md'],['skill','reference','congo.md']]){
    const match=read(...file).match(pattern);
    assert.equal(match,null,`${file.join('/')} names ${match?.[0]}`);
  }
});
test('the engine is unchanged from the upstream-pinned source',()=>{
  // The workspace lives outside crates/; the installer downloads the original engine.
  assert.ok(!fs.existsSync(path.join(root,'crates','live','src','workspace')));
  assert.ok(!fs.existsSync(path.join(root,'crates','context','src','workspace_bridge.rs')));
});
