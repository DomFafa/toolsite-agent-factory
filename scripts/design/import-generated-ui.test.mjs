import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertSafeOption,
  assertSafeZipEntries,
  buildImportPaths,
  importGeneratedUi,
} from './import-generated-ui.mjs';

function hasCommand(command) {
  return spawnSync(command, ['-v'], { encoding: 'utf8' }).status === 0;
}

test('validates safe option names', () => {
  assert.equal(assertSafeOption('Option-A'), 'option-a');
  assert.throws(() => assertSafeOption('../bad'), /--option/);
  assert.throws(() => assertSafeOption('-bad'), /--option/);
});

test('rejects unsafe zip entries', () => {
  assert.deepEqual(assertSafeZipEntries(['index.html', 'assets/style.css']), ['index.html', 'assets/style.css']);
  assert.throws(() => assertSafeZipEntries(['../evil.txt']), /parent-directory/);
  assert.throws(() => assertSafeZipEntries(['/tmp/evil.txt']), /absolute/);
  assert.throws(() => assertSafeZipEntries(['C:/evil.txt']), /absolute/);
  assert.throws(() => assertSafeZipEntries(['nested\\evil.txt']), /backslashes/);
});

test('builds import paths inside the run folder', () => {
  const paths = buildImportPaths({ runDir: 'runs/example-site', option: 'option-b' });
  assert.equal(paths.option, 'option-b');
  assert.match(paths.codeRoot, /runs[/\\]example-site[/\\]agent-2-5-output[/\\]generated-designs[/\\]option-b[/\\]code$/);
});

test('imports a generated UI zip and can mark it selected', (t) => {
  if (!hasCommand('zip') || !hasCommand('unzip')) {
    t.skip('zip/unzip commands are not available');
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-import-test-'));
  const sourceDir = path.join(tmp, 'source');
  const runDir = path.join(tmp, 'runs', 'sample-site');
  const zipPath = path.join(tmp, 'design.zip');

  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'index.html'), '<!doctype html><title>Generated UI</title>', 'utf8');
  fs.mkdirSync(path.join(sourceDir, 'assets'));
  fs.writeFileSync(path.join(sourceDir, 'assets', 'style.css'), 'body{margin:0}', 'utf8');

  const zipped = spawnSync('zip', ['-qr', zipPath, '.'], { cwd: sourceDir, encoding: 'utf8' });
  assert.equal(zipped.status, 0, zipped.stderr || zipped.stdout);

  const result = importGeneratedUi({
    runDir,
    zipPath,
    option: 'option-a',
    select: true,
  });

  assert.equal(result.option, 'option-a');
  assert.equal(result.entryCount >= 2, true);
  assert.equal(fs.existsSync(path.join(runDir, 'agent-2-5-output', 'generated-designs', 'option-a', 'code', 'index.html')), true);
  assert.equal(fs.existsSync(path.join(runDir, 'agent-2-5-output', 'selected-design', 'code', 'index.html')), true);
  assert.equal(fs.existsSync(path.join(runDir, 'agent-2-5-output', 'source-archives', 'option-a.zip')), true);
});
