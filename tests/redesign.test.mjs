import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readSourceFiles,replacePlaceholders} from '../scripts/lib/utils.js';
const root=fileURLToPath(new URL('../',import.meta.url));
test('Redesign is a separate distributable skill and retains existing command suggestions',()=>{
  const {skills}=readSourceFiles(root);const redesign=skills.find(s=>s.name==='redesign');assert.ok(redesign);assert.ok(redesign.scripts.some(s=>s.name==='workspace.mjs'));
  const suggestions=replacePlaceholders('{{available_commands}}','codex',['impeccable','redesign'],['impeccable','redesign']);
  assert.match(suggestions,/impeccable critique/);assert.match(suggestions,/impeccable polish/);assert.match(suggestions,/redesign/);
});
test('generated required providers ship both skills with resolved commands',()=>{
  for(const [provider,dir] of [['agents','.agents'],['codex','.codex'],['cursor','.cursor'],['claude-code','.claude']]){
    const base=path.join(root,'dist',provider,dir,'skills');if(!fs.existsSync(base))continue;
    const skill=fs.readFileSync(path.join(base,'redesign','SKILL.md'),'utf8');assert.ok(fs.existsSync(path.join(base,'impeccable','SKILL.md')));assert.ok(!skill.includes('{{'));assert.match(skill,/--view choices/);
    assert.ok(fs.existsSync(path.join(base,'redesign','scripts','workspace.mjs')));
  }
});
