// Congo X Impeccable: the fork's Congo instructions live in one reference
// file plus three short pointers. An upstream merge that rewrites the
// surrounding paragraphs can silently drop a pointer; these checks catch it.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf-8').replace(/\r\n?/g, '\n');

describe('Congo X Impeccable reference', () => {
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

  it('keeps the Congo decision round off the roll and its telemetry', () => {
    const payload = congo.match(/```json\n([\s\S]*?)\n```/)?.[1];
    assert.ok(payload, 'congo.md should show the decision payload');
    const parsed = JSON.parse(payload);
    assert.equal(parsed.buildPath, undefined);
    for (const option of parsed.options) {
      assert.equal(option.kind, undefined);
      assert.ok(option.id === 'scratch' || option.id.startsWith('congo:'), option.id);
    }
    assert.match(congo, /No `buildPath`, `kind`, `reroll` or `canon`/);
  });

  it('starts new products from three real apps and adapts existing screens', () => {
    assert.match(congo, /real apps first/);
    assert.match(congo, /Pick the three closest apps, not screens/);
    assert.match(congo, /main screen/);
    assert.match(congo, /run concept-seed only when the user answers `scratch`/);
    assert.match(congo, /Adapt what is there before building anything new/);
    assert.match(read('skill/reference/new-work.md'), /## 3\. Choose the right amount of invention\n\nWith Congo available, a new product/);
  });
});
