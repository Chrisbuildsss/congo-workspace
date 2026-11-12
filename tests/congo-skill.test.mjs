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
    assert.match(skill,/workspace\.mjs/);
    assert.match(skill,/WS connect \[--project/,'connect, project optional');
    assert.match(skill,/live-poll/);
    for(const helper of ['congo-compete','congo-ideas']){ const text=fs.readFileSync(path.join(base,helper,'SKILL.md'),'utf8'); assert.ok(!text.includes('{{'),helper); }
  }
});
const read=(...p)=>fs.readFileSync(path.join(root,...p),'utf8').replace(/\r\n?/g,'\n');
test("Congo makes prototypes from real apps: one by default, main screen first, kept in Congo files",()=>{
  const src=read('skills','congo','SKILL.src.md');
  assert.match(src,/^name: congo$/m);
  assert.match(src,/prototype a CRM for realtors/,'new products start here');
  assert.match(src,/a few directions for my dashboard/,'redesigns still trigger it');
  assert.match(src,/You are the only AI/);
  assert.match(src,/\*\*One prototype by default\.\*\*/);
  assert.match(src,/\*\*The user's request decides how much you build\.\*\*/);
  assert.match(src,/\*\*When it is open, prefer a main screen\.\*\*/);
  assert.match(src,/a preference to keep you fast, not a rule/);
  assert.match(src,/\*\*Adapt before building\.\*\*/);
  assert.match(src,/no built-in ways in/);
  assert.match(src,/\*\*Prototypes go into Congo files,\*\* never straight into a code project/);
  assert.match(src,/Only \*\*Pull into a project\*\* changes the user's code/);
  assert.match(src,/This works with the workspace closed/);
  for(const command of ['WS files --json','WS new --title','WS prepare <template-id> --into','WS preview <prototype folder> --status main|ready']) assert.ok(src.includes(command),command);
  assert.doesNotMatch(src,/—/,'no em dashes');
  assert.doesNotMatch(src,/My app|Use this/,'the My app tab and Use this are gone');
});
test('workspace.md: every request makes a prototype in a Congo file; Pull into a project is the only code change',()=>{
  const ref=read('skills','congo','reference','workspace.md');
  for(const section of ['## `send`: Explore items with notes','## `library`: one Explore item','## `compose`','## `expand`','## `tweak`','## `build`: Pull into a project','## Live editing a prototype']) assert.ok(ref.includes(section),section);
  assert.match(ref,/\*\*One prototype per request\.\*\*/);
  assert.match(ref,/\*\*The conversation is this chat\.\*\* The local workspace shows no messages and no replies/);
  assert.match(ref,/\*\*Prototypes never go into the user's project\.\*\*/);
  assert.match(ref,/\*\*How much to build is the user's call,\*\*/);
  assert.match(ref,/prefer one main screen/);
  assert.match(ref,/"brief": \{/,'briefs on product ideas');
  assert.match(ref,/never on design-only prototypes/);
  assert.match(ref,/congo create <template-id> --project <new folder>/,'Pull into a new project');
  assert.match(ref,/--allow-missing-context/);
  assert.doesNotMatch(ref,/—/,'no em dashes');
});
test('helper skills use congo underneath, add briefs, and ship no schedule skill',()=>{
  for(const name of ['congo-compete','congo-ideas']){
    const src=read('skills',name,'SKILL.src.md');
    assert.match(src,new RegExp(`^name: ${name}$`,'m'));
    assert.match(src,/uses the `congo` skill/);
    assert.match(src,/brief/);
    assert.match(src,/No invented numbers/);
    assert.doesNotMatch(src,/—/,'no em dashes');
  }
  assert.ok(!fs.existsSync(path.join(root,'skills','congo-schedule')),'schedules are a Congo AI feature');
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
  for(const file of [['skills','congo','SKILL.src.md'],['skills','congo','reference','workspace.md'],['skills','congo-compete','SKILL.src.md'],['skills','congo-ideas','SKILL.src.md'],['skill','reference','congo.md']]){
    const match=read(...file).match(pattern);
    assert.equal(match,null,`${file.join('/')} names ${match?.[0]}`);
  }
});
test('the engine is unchanged from the upstream-pinned source',()=>{
  // The workspace lives outside crates/; the installer downloads the original engine.
  assert.ok(!fs.existsSync(path.join(root,'crates','live','src','workspace')));
  assert.ok(!fs.existsSync(path.join(root,'crates','context','src','workspace_bridge.rs')));
});
