import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  classifyAsset,
  extractUiAssetRefs,
  inspectImageBuffer,
  runAssetQualityGate,
  validateImageAsset,
} from './asset-quality-gate.mjs';

function fakePng(width, height) {
  const buffer = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

test('classifies UI asset roles by filename', () => {
  assert.equal(classifyAsset('group-rice.svg'), 'ingredientHero');
  assert.equal(classifyAsset('preset-bowl.png'), 'presetThumbnail');
  assert.equal(classifyAsset('format-burrito.png'), 'formatIcon');
  assert.equal(classifyAsset('compare-rice.png'), 'compareImage');
});

test('extracts referenced ui assets from Astro and CSS source', () => {
  const refs = extractUiAssetRefs(`
    const art = "/ui-assets/group-rice.svg";
    <img src="/ui-assets/preset-bowl.png">
    background: url('/ui-assets/compare-rice.png');
  `);
  assert.deepEqual(refs, [
    '/ui-assets/compare-rice.png',
    '/ui-assets/group-rice.svg',
    '/ui-assets/preset-bowl.png',
  ]);
});

test('rejects low-resolution ingredient hero assets', () => {
  const metadata = inspectImageBuffer(fakePng(150, 62), 'group-rice.png');
  const errors = validateImageAsset('/ui-assets/group-rice.png', metadata, 'ingredientHero');
  assert.match(errors.join('\n'), /below required 1000x360/);
});

test('rejects SVG thumbnails with embedded text or raster images', () => {
  const svg = Buffer.from('<svg viewBox="0 0 360 240"><image href="x.png"/><text>Lean bowl</text></svg>');
  const metadata = inspectImageBuffer(svg, 'preset-bowl.svg');
  const errors = validateImageAsset('/ui-assets/preset-bowl.svg', metadata, 'presetThumbnail');
  assert.match(errors.join('\n'), /must not contain <text>/);
  assert.match(errors.join('\n'), /must not embed raster <image>/);
});

test('passes the Chipotle run referenced UI assets', async () => {
  const runDir = path.resolve('runs/chipotle-nutrition-calculator');
  const result = await runAssetQualityGate({ runDir });
  assert.equal(result.errors.join('\n'), '');
  assert.ok(result.checked.length >= 10);
});

test('fails a run when a referenced large asset is too small', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'asset-gate-'));
  const runDir = path.join(root, 'run');
  await mkdir(path.join(runDir, 'site/src/pages'), { recursive: true });
  await mkdir(path.join(runDir, 'site/src/styles'), { recursive: true });
  await mkdir(path.join(runDir, 'site/public/ui-assets'), { recursive: true });
  await writeFile(path.join(runDir, 'site/src/pages/index.astro'), 'const art = "/ui-assets/group-rice.png";');
  await writeFile(path.join(runDir, 'site/src/styles/global.css'), '');
  await writeFile(path.join(runDir, 'site/public/ui-assets/group-rice.png'), fakePng(150, 62));

  const result = await runAssetQualityGate({ runDir });
  assert.match(result.errors.join('\n'), /below required 1000x360/);
});
