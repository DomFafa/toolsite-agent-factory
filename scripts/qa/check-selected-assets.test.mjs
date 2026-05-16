import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runSelectedAssetsGate } from './check-selected-assets.mjs';

async function makeRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'selected-assets-gate-'));
  const runDir = path.join(root, 'runs', 'sample');
  await mkdir(path.join(runDir, 'agent-2-5-output/selected-design'), { recursive: true });
  await writeSelectedTargetEvidence(runDir);
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

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function writePng(runDir, relPath, buffer) {
  await mkdir(path.dirname(path.join(runDir, relPath)), { recursive: true });
  await writeFile(path.join(runDir, relPath), buffer);
  return sha256(buffer);
}

async function writeSelectedTargetEvidence(
  runDir,
  {
    selectedOption = 'B',
    board = Buffer.concat([pngBuffer(1440, 900), Buffer.from('board')]),
    desktop = Buffer.concat([pngBuffer(480, 900), Buffer.from('option-b-desktop')]),
    mobile = Buffer.concat([pngBuffer(480, 900), Buffer.from('option-b-mobile')]),
  } = {},
) {
  const boardPath = 'agent-2-5-output/chat-delivery/options-board.png';
  const desktopPath = 'agent-2-5-output/selected-assets/selected-target-desktop.png';
  const mobilePath = 'agent-2-5-output/selected-assets/selected-target-mobile.png';
  const boardSha = await writePng(runDir, boardPath, board);
  const desktopSha = await writePng(runDir, desktopPath, desktop);
  const mobileSha = await writePng(runDir, mobilePath, mobile);
  await mkdir(path.join(runDir, 'agent-2-5-output/selected-design'), { recursive: true });
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/selected-option.json'),
    `${JSON.stringify({
      selected_option: selectedOption,
      selected_design: `Option ${selectedOption}`,
      source_options_board: boardPath,
      external_action_receipt: 'agent-2-5-output/external-design-evidence/action-receipt.json',
    }, null, 2)}\n`,
  );
  await mkdir(path.join(runDir, 'agent-2-5-output/selected-assets'), { recursive: true });
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-assets/selected-design-lineage.md'),
    `# Selected Assets Lineage\n\nSelected option: Option ${selectedOption}.\n`,
  );
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-assets/source-map.json'),
    `${JSON.stringify({
      selected_option: selectedOption,
      selected_design: `Option ${selectedOption}`,
      source_options_board: boardPath,
      source_options_board_sha256: boardSha,
      derivation: {
        method: 'options-board-crop',
        selected_option: selectedOption,
        crop_region: { x: 480, y: 0, width: 480, height: 900, unit: 'px' },
      },
      output_targets: {
        desktop: desktopPath,
        mobile: mobilePath,
      },
      target_hashes: {
        [desktopPath]: desktopSha,
        [mobilePath]: mobileSha,
      },
    }, null, 2)}\n`,
  );
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

test('selected assets gate rejects selected targets that equal the full options board', async () => {
  const board = Buffer.concat([pngBuffer(1440, 900), Buffer.from('same-board')]);
  const runDir = await makeRun();
  await writeSelectedTargetEvidence(runDir, {
    selectedOption: 'B',
    board,
    desktop: board,
    mobile: board,
  });
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/image-slots.md'),
    '# Image Slots\n\nRequired image slots: none.\n',
  );
  await writeFile(
    path.join(runDir, 'agent-2-5-output/selected-design/asset-manifest.json'),
    JSON.stringify({ imageSlots: [], requiredImageSlots: 'none' }, null, 2),
  );

  const result = await runSelectedAssetsGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /selected-target-desktop\.png must not equal the full options-board\.png/);
  assert.match(result.failures.join('\n'), /selected-target-mobile\.png must not equal the full options-board\.png/);
});

test('selected assets gate accepts Option B targets with source-map derivation', async () => {
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
  assert.equal(result.details.selectedOption, 'B');
  assert.equal(result.details.selectedTargets.desktop.derivation.method, 'options-board-crop');
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
