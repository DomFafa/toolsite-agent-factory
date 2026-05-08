import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runSelectedAssetsGate } from './check-selected-assets.mjs';

async function makeRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'selected-assets-gate-'));
  const runDir = path.join(root, 'runs', 'sample');
  await mkdir(path.join(runDir, 'agent-2-5-output/selected-design'), { recursive: true });
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/asset-quality-contract.md'),
    '# Asset Quality Contract\n\nRequired image slots: none.\n',
  );
  await writeFile(path.join(runDir, 'agent-2-5-output/asset-acquisition-report.md'), '# Asset Acquisition\n\nRequired image slots: none.\n');
  return runDir;
}

function pngBuffer(width, height) {
  const buffer = Buffer.alloc(33);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = 8;
  buffer[25] = 2;
  buffer[26] = 0;
  buffer[27] = 0;
  buffer[28] = 0;
  return buffer;
}

test('selected assets gate passes with an explicit no-image-slots decision', async () => {
  const runDir = await makeRun();
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/image-slots.md'),
    '# Image Slots\n\nRequired image slots: none.\n',
  );
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/asset-manifest.json'),
    JSON.stringify({ imageSlots: [], requiredImageSlots: 'none' }, null, 2),
  );

  const result = await runSelectedAssetsGate({ runDir });
  assert.equal(result.passed, true);
});

test('selected assets gate fails when image-slots.md is missing', async () => {
  const runDir = await makeRun();
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/asset-manifest.json'),
    JSON.stringify({ imageSlots: [], requiredImageSlots: 'none' }, null, 2),
  );

  const result = await runSelectedAssetsGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /image-slots\.md/);
});

test('selected assets gate rejects assets cropped from target screenshots', async () => {
  const runDir = await makeRun();
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/image-slots.md'),
    '# Image Slots\n\n- hero: homepage illustration\n',
  );
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/asset-manifest.json'),
    JSON.stringify(
      {
        imageSlots: [
          {
            id: 'hero',
            file: 'target/desktop.png',
            source: 'cropped-from-target',
            renderedWidth: 300,
            renderedHeight: 160,
          },
        ],
      },
      null,
      2,
    ),
  );

  const result = await runSelectedAssetsGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /cropped screenshot|target-derived|target or screenshot folders/);
});

test('selected assets gate passes generated independent raster assets', async () => {
  const runDir = await makeRun();
  await mkdir(path.join(runDir, 'agent-2-5-output/selected-design/assets'), { recursive: true });
  await mkdir(path.join(runDir, 'agent-2-5-output/selected-design/downloads'), { recursive: true });
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/image-slots.md'),
    '# Image Slots\n\n- hero: independent GPT generated homepage illustration\n',
  );
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/asset-generation-prompt.md'),
    'Generate independent standalone assets. Do not crop or extract from the option screenshot.',
  );
  await writeFile(path.join(runDir, 'agent-2-5-output/selected-design/downloads/selected-option-assets.zip'), 'zip');
  await writeFile(path.join(runDir, 'agent-2-5-output/selected-design/assets/hero.png'), pngBuffer(800, 400));
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/asset-manifest.json'),
    JSON.stringify(
      {
        imageSlots: [
          {
            id: 'hero',
            file: 'assets/hero.png',
            source: 'gpt-generated-independent-asset',
            renderedWidth: 360,
            renderedHeight: 180,
          },
        ],
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(runDir, 'agent-2-5-output/asset-acquisition-report.md'),
    '# Asset Acquisition\n\nDownloaded selected-option-assets.zip from GPT generated independent assets.\n',
  );

  const result = await runSelectedAssetsGate({ runDir });
  assert.equal(result.passed, true);
});

test('selected assets gate rejects low-resolution raster assets', async () => {
  const runDir = await makeRun();
  await mkdir(path.join(runDir, 'agent-2-5-output/selected-design/assets'), { recursive: true });
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/image-slots.md'),
    '# Image Slots\n\n- hero: independent GPT generated homepage illustration\n',
  );
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/asset-generation-prompt.md'),
    'Generate independent standalone assets. Do not crop or extract from the option screenshot.',
  );
  await writeFile(path.join(runDir, 'agent-2-5-output/selected-design/assets/hero.png'), pngBuffer(300, 160));
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/fallback-illustration-report.md'),
    '# Fallback Illustration Report\n\nDecision: PASS\n',
  );
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/asset-manifest.json'),
    JSON.stringify(
      {
        imageSlots: [
          {
            id: 'hero',
            file: 'assets/hero.png',
            source: 'fallback-illustration',
            renderedWidth: 240,
            renderedHeight: 120,
          },
        ],
      },
      null,
      2,
    ),
  );

  const result = await runSelectedAssetsGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /below 2x rendered/);
});
