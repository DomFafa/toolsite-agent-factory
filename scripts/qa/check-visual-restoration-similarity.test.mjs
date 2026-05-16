import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runVisualRestorationSimilarityGate } from './check-visual-restoration-similarity.mjs';

function pngHeader(width, height, seed = '') {
  const header = Buffer.alloc(33);
  header.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  header[24] = 8;
  header[25] = 2;
  return Buffer.concat([header, Buffer.from(seed.repeat(10_100))]);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function writeRunFile(runDir, relPath, content) {
  const absolutePath = path.join(runDir, relPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
  return sha256(content);
}

async function makeVisualRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'visual-restoration-stale-'));
  const runDir = path.join(root, 'runs', 'sample');
  await mkdir(runDir, { recursive: true });
  return runDir;
}

test('visual restoration similarity marks dimension mismatch as stale before similarity scoring', async () => {
  const runDir = await makeVisualRun();
  await writeRunFile(runDir, 'agent-2-5-output/selected-design/target/desktop.png', pngHeader(558, 941, 'target-desktop'));
  await writeRunFile(runDir, 'agent-2-5-output/selected-design/target/mobile.png', pngHeader(558, 941, 'target-mobile'));
  await writeRunFile(runDir, 'agent-3-output/final-screenshots/desktop.png', pngHeader(1672, 941, 'old-desktop'));
  await writeRunFile(runDir, 'agent-3-output/final-screenshots/mobile.png', pngHeader(1672, 941, 'old-mobile'));

  const result = await runVisualRestorationSimilarityGate({ runDir });

  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /STALE_VISUAL_RESTORATION_ARTIFACT/);
  assert.match(result.failures.join('\n'), /desktop: restored screenshot dimensions 1672x941 differ from target 558x941/);
  assert.doesNotMatch(result.failures.join('\n'), /similarity \d+% below 90%/);
  assert.equal(result.details.results.length, 0);
  assert.equal(result.details.staleArtifacts.length, 2);
});

test('visual restoration similarity marks restored screenshots stale when target hash changes', async () => {
  const runDir = await makeVisualRun();
  const currentTargetSha = await writeRunFile(
    runDir,
    'agent-2-5-output/selected-design/target/desktop.png',
    pngHeader(558, 941, 'current-target'),
  );
  await writeRunFile(runDir, 'agent-2-5-output/selected-design/target/mobile.png', pngHeader(558, 941, 'current-mobile'));
  await writeRunFile(runDir, 'agent-3-output/final-screenshots/desktop.png', pngHeader(558, 941, 'old-restored'));
  await writeRunFile(runDir, 'agent-3-output/final-screenshots/mobile.png', pngHeader(558, 941, 'current-mobile'));
  await writeFile(
    path.join(runDir, 'agent-3-output/final-screenshots/restoration-manifest.json'),
    `${JSON.stringify({
      targets: {
        desktop: {
          target_path: 'agent-2-5-output/selected-design/target/desktop.png',
          target_sha256: '0'.repeat(64),
          restored_path: 'agent-3-output/final-screenshots/desktop.png',
        },
        mobile: {
          target_path: 'agent-2-5-output/selected-design/target/mobile.png',
          target_sha256: currentTargetSha,
          restored_path: 'agent-3-output/final-screenshots/mobile.png',
        },
      },
    }, null, 2)}\n`,
  );

  const result = await runVisualRestorationSimilarityGate({ runDir });

  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /desktop: target sha256 changed since restored screenshot was generated/);
  assert.doesNotMatch(result.failures.join('\n'), /similarity \d+% below 90%/);
});
