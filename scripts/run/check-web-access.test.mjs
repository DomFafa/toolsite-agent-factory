import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runWebAccessPreflight } from './check-web-access.mjs';

const repoRoot = path.resolve('.');

async function copyFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'web-access-preflight-'));
  await cp(path.join(repoRoot, 'web-access'), path.join(root, 'web-access'), { recursive: true });
  return root;
}

test('web-access preflight passes with repo-local skill files and relative script paths', async () => {
  const result = await runWebAccessPreflight({ root: repoRoot });
  assert.equal(result.passed, true);
});

test('web-access preflight fails when the repo-local skill is missing', async () => {
  const root = await copyFixture();
  await rm(path.join(root, 'web-access/SKILL.md'));

  const result = await runWebAccessPreflight({ root });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /missing web-access\/SKILL\.md/);
});

test('web-access preflight fails on stale global claude skill paths', async () => {
  const root = await copyFixture();
  await mkdir(path.join(root, 'web-access'), { recursive: true });
  await writeFile(
    path.join(root, 'web-access/SKILL.md'),
    [
      '---',
      'name: web-access',
      '---',
      '',
      'Run `bash ~/.claude/skills/web-access/scripts/check-deps.sh` before browsing.',
    ].join('\n'),
  );

  const result = await runWebAccessPreflight({ root });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /still references ~\/\.claude\/skills\/web-access/);
});
