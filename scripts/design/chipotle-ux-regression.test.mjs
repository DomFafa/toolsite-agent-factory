import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readSiteSource() {
  return readFile(new URL('../../runs/chipotle-nutrition-calculator/site/src/pages/index.astro', import.meta.url), 'utf8');
}

test('Chipotle calculator keeps No choices as exclusive clearing actions', async () => {
  const source = await readSiteSource();

  assert.match(source, /id:\s*"no-rice"[^}]*clearGroup:\s*true/);
  assert.match(source, /id:\s*"no-beans"[^}]*clearGroup:\s*true/);
  assert.match(source, /id:\s*"no-protein"[^}]*clearGroup:\s*true/);
  assert.match(source, /const clearItemByGroup = Object\.fromEntries/);
  assert.match(source, /function clearGroupSelection\(group\)/);
  assert.match(source, /function toggleItem\(id\)/);
  assert.match(source, /function applyPortion\(id, value\)/);
  assert.match(source, /if \(selected\[id\] === numericValue\) \{/);
  assert.match(source, /delete selected\[id\];\n\s*return;\n\s*\}/);
  assert.match(source, /isClearOption \? "" : `<div class="portion-row"/);
  assert.match(source, /portionsDisabled \? "disabled aria-disabled=\\"true\\"" : ""/);
});

test('Chipotle meal format buttons apply visible default ingredients', async () => {
  const source = await readSiteSource();

  assert.match(source, /const formatDefaults = \{/);
  assert.match(source, /bowl:\s*\{(?=[^}]*chicken:\s*1)(?=[^}]*"white-rice":\s*1)(?=[^}]*"black-beans":\s*1)[^}]*\}/s);
  assert.match(source, /burrito:\s*\{(?=[^}]*chicken:\s*1)(?=[^}]*"white-rice":\s*1)(?=[^}]*"pinto-beans":\s*1)[^}]*\}/s);
  assert.match(source, /salad:\s*\{(?=[^}]*chicken:\s*1)(?=[^}]*fajita:\s*1)[^}]*\}/s);
  assert.match(source, /tacos:\s*\{(?=[^}]*steak:\s*1)(?=[^}]*"black-beans":\s*1)[^}]*\}/s);
  assert.match(source, /quesadilla:\s*\{(?=[^}]*chicken:\s*1)(?=[^}]*"sour-cream":\s*1)[^}]*\}/s);
  assert.match(source, /let selected = \{ \.\.\.formatDefaults\[selectedFormat\] \};/);
  assert.match(source, /selected = \{ \.\.\.\(formatDefaults\[selectedFormat\] \|\| \{\}\) \};/);
});
