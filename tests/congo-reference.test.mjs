// Congo Workspace: the fork's Congo instructions live in one reference
// file plus three short pointers. An upstream merge that rewrites the
// surrounding paragraphs can silently drop a pointer; these checks catch it.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf-8').replace(/\r\n?/g, '\n');

describe('Congo Workspace reference', () => {
  const congo = read('skill/reference/congo.md');

  it('is linked from the skill, new-work and live mode', () => {
    assert.match(read('skill/SKILL.src.md'), /\]\(reference\/congo\.md\)/);
    assert.match(read('skill/reference/new-work.md'), /\]\(congo\.md\)/);
    assert.match(read('skill/reference/live.md'), /\]\(congo\.md\)/);
  });

  it('names every CLI command it relies on', () => {
    for (const command of [
      'congo search --kind screen --query',
      '--category',
      '--source',
      'congo categories',
      'congo templates',
      'congo create',
      'congo handbooks',
      'congo login',
      'congo init',
      'congo add <id> --destination <path>',
    ]) {
      assert.ok(congo.includes(command), `congo.md should name ${command}`);
    }
  });

  it('keeps the sign-in, subscription and fallback rules', () => {
    assert.match(congo, /Never ask for, print, read or store the user's Congo sign-in/);
    assert.match(congo, /Source needs an active Congo subscription \(\$30\/month\)/);
    assert.match(congo, /Node older than 22\.20/);
    assert.match(congo, /Without Congo, Impeccable works exactly as before/);
    assert.match(congo, /Keep every license and notice file/);
  });

  it('runs no decision round of its own, so it never touches the roll or its telemetry', () => {
    assert.doesNotMatch(congo, /serve-question/);
    assert.doesNotMatch(congo, /```json/);
  });

  it('starts new products from the closest real app, one result, and adapts existing screens', () => {
    assert.match(congo, /start from the closest real app/);
    assert.match(congo, /\*\*Pick the closest app\.\*\*/);
    assert.match(congo, /\*\*One result\.\*\* Show several directions only when the user asks/);
    assert.match(congo, /Run concept-seed only when Congo is unavailable/);
    assert.match(congo, /Adapt what is there before building anything new/);
    assert.match(read('skill/reference/new-work.md'), /## 3\. Choose the right amount of invention\n\nWith Congo available, a new product/);
    assert.match(read('skill/reference/new-work.md'), /starts from the closest real Congo app/);
  });
});
