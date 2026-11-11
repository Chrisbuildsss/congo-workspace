import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readSourceFiles,replacePlaceholders} from '../scripts/lib/utils.js';
const root=fileURLToPath(new URL('../',import.meta.url));
test('Redesign is a separate distributable skill and retains existing command suggestions',()=>{
  const {skills}=readSourceFiles(root);const redesign=skills.find(s=>s.name==='redesign');assert.ok(redesign);
  assert.ok(redesign.scripts.some(s=>s.name==='workspace.mjs'));
  assert.ok(redesign.scripts.some(s=>s.name==='workspace/ui/index.html'),'the workspace UI ships prebuilt');
  assert.ok(redesign.scripts.some(s=>s.name==='workspace/server/server.mjs'));
  for(const s of redesign.scripts.filter(s=>s.name.startsWith('workspace/ui/'))) assert.ok(/\.(html|js|css)$/.test(s.name),`text-only UI build: ${s.name}`);
  const suggestions=replacePlaceholders('{{available_commands}}','codex',['impeccable','redesign'],['impeccable','redesign']);
  assert.match(suggestions,/impeccable critique/);assert.match(suggestions,/impeccable polish/);assert.match(suggestions,/redesign/);
});
test('generated required providers ship both skills with resolved placeholders',()=>{
  for(const [provider,dir] of [['agents','.agents'],['codex','.codex'],['cursor','.cursor'],['claude-code','.claude']]){
    const base=path.join(root,'dist',provider,dir,'skills');if(!fs.existsSync(base))continue;
    const skill=fs.readFileSync(path.join(base,'redesign','SKILL.md'),'utf8');assert.ok(fs.existsSync(path.join(base,'impeccable','SKILL.md')));assert.ok(!skill.includes('{{'));
    assert.ok(fs.existsSync(path.join(base,'redesign','scripts','workspace.mjs')));
    assert.ok(fs.existsSync(path.join(base,'redesign','scripts','workspace','ui','index.html')));
    assert.ok(fs.existsSync(path.join(base,'redesign','reference','workspace.md')));
    assert.match(skill,/workspace.mjs connect --project/);
    assert.match(skill,/workspace.mjs request --text/);
    assert.match(skill,/live-poll/);
  }
});
test("Redesign opens Compose and routes through Impeccable's live-poll, with no Congo AI",()=>{
  const src=fs.readFileSync(path.join(root,'skills','redesign','SKILL.src.md'),'utf8');
  assert.match(src,/^name: redesign$/m);
  assert.match(src,/help redesign my contacts page/);
  assert.match(src,/You are the only AI/);
  assert.doesNotMatch(src,/—/,'no em dashes');
});
test('the engine is unchanged from the upstream-pinned source',()=>{
  // The workspace lives outside crates/; the installer downloads the original engine.
  assert.ok(!fs.existsSync(path.join(root,'crates','live','src','workspace')));
  assert.ok(!fs.existsSync(path.join(root,'crates','context','src','workspace_bridge.rs')));
});
