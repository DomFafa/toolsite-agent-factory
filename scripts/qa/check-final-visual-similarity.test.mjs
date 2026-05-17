import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  FINAL_VISUAL_TARGET_DIMENSION_MISMATCH,
  FINAL_VISUAL_TARGET_MISSING,
  runFinalVisualSimilarityGate,
} from './check-final-visual-similarity.mjs';

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

async function writeRunFile(runDir, relPath, content) {
  const absolutePath = path.join(runDir, relPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

async function sha256RunFile(runDir, relPath) {
  return crypto.createHash('sha256').update(await readFile(path.join(runDir, relPath))).digest('hex');
}

async function writeFinalTargetManifest(runDir) {
  const desktopPath = 'agent-5-output/final-visual-target/desktop.png';
  const mobilePath = 'agent-5-output/final-visual-target/mobile.png';
  const hashes = {
    [desktopPath]: await sha256RunFile(runDir, desktopPath),
    [mobilePath]: await sha256RunFile(runDir, mobilePath),
  };
  await writeRunFile(
    runDir,
    'agent-5-output/final-visual-target/final-visual-target-manifest.json',
    JSON.stringify(
      {
        schema_version: 'final-visual-target-manifest.v1',
        selected_option: 'B',
        source_selected_design_package: 'agent-2-5-output/selected-assets/selected-design-package.md',
        source_selected_targets: {
          desktop: { path: 'agent-2-5-output/selected-assets/selected-target-desktop.png' },
          mobile: { path: 'agent-2-5-output/selected-assets/selected-target-mobile.png' },
        },
        external_action_receipt: 'agent-2-5-output/external-design-evidence/action-receipt.json',
        generation_method: 'approved-external-final-visual-target-generator',
        output_paths: {
          desktop: desktopPath,
          mobile: mobilePath,
        },
        sha256_hashes: hashes,
      },
      null,
      2,
    ),
  );
  await writeRunFile(
    runDir,
    'agent-5-output/final-visual-target/source-map.json',
    JSON.stringify(
      {
        schema_version: 'final-visual-target-source-map.v1',
        output_targets: {
          desktop: desktopPath,
          mobile: mobilePath,
        },
        target_hashes: hashes,
      },
      null,
      2,
    ),
  );
}

async function makeFinalVisualRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'final-visual-target-'));
  const runDir = path.join(root, 'runs', 'sample');
  await mkdir(runDir, { recursive: true });
  await writeRunFile(runDir, 'agent-2-5-output/selected-design/target/desktop.png', pngHeader(558, 941, 'selected-crop'));
  await writeRunFile(runDir, 'agent-2-5-output/selected-design/target/mobile.png', pngHeader(558, 941, 'selected-crop'));
  await writeRunFile(runDir, 'agent-5-output/final-visual-lock/desktop.png', pngHeader(1440, 900, 'final-desktop'));
  await writeRunFile(runDir, 'agent-5-output/final-visual-lock/mobile.png', pngHeader(390, 844, 'final-mobile'));
  return runDir;
}

test('final visual similarity requires viewport-sized final targets instead of selected option crops', async () => {
  const runDir = await makeFinalVisualRun();
  let compared = false;

  const result = await runFinalVisualSimilarityGate({
    runDir,
    compareImages: async () => {
      compared = true;
      return { results: [], overall: 0 };
    },
  });

  assert.equal(result.passed, false);
  assert.equal(compared, false);
  assert.match(result.failures.join('\n'), new RegExp(FINAL_VISUAL_TARGET_MISSING));
  assert.doesNotMatch(result.failures.join('\n'), /similarity \d+% below 90%/);
  assert.equal(result.evidence.comparedPairs[0].target, 'agent-5-output/final-visual-target/desktop.png');
});

test('final visual similarity blocks dimension mismatch before similarity scoring', async () => {
  const runDir = await makeFinalVisualRun();
  await writeRunFile(runDir, 'agent-5-output/final-visual-target/desktop.png', pngHeader(558, 941, 'selected-crop'));
  await writeRunFile(runDir, 'agent-5-output/final-visual-target/mobile.png', pngHeader(558, 941, 'selected-crop'));
  let compared = false;

  const result = await runFinalVisualSimilarityGate({
    runDir,
    compareImages: async () => {
      compared = true;
      return { results: [], overall: 0 };
    },
  });

  assert.equal(result.passed, false);
  assert.equal(compared, false);
  assert.match(result.failures.join('\n'), new RegExp(FINAL_VISUAL_TARGET_DIMENSION_MISMATCH));
  assert.match(result.failures.join('\n'), /desktop: final screenshot dimensions 1440x900 differ from final visual target 558x941/);
  assert.doesNotMatch(result.failures.join('\n'), /similarity \d+% below 90%/);
});

test('final visual similarity compares only after viewport-sized final targets exist', async () => {
  const runDir = await makeFinalVisualRun();
  await writeRunFile(runDir, 'agent-5-output/final-visual-target/desktop.png', pngHeader(1440, 900, 'target-desktop'));
  await writeRunFile(runDir, 'agent-5-output/final-visual-target/mobile.png', pngHeader(390, 844, 'target-mobile'));
  await writeFinalTargetManifest(runDir);
  let compared = false;

  const result = await runFinalVisualSimilarityGate({
    runDir,
    compareImages: async ({ sourcePairs }) => {
      compared = true;
      assert.match(sourcePairs[0].targetPath, /agent-5-output\/final-visual-target\/desktop\.png$/);
      assert.match(sourcePairs[1].targetPath, /agent-5-output\/final-visual-target\/mobile\.png$/);
      return {
        results: [
          { name: 'desktop', width: 1440, height: 900, finalWidth: 1440, finalHeight: 900, similarity: 0.95 },
          { name: 'mobile', width: 390, height: 844, finalWidth: 390, finalHeight: 844, similarity: 0.94 },
        ],
        overall: 0.945,
      };
    },
  });

  assert.equal(compared, true);
  assert.equal(result.passed, true);
});

test('final visual similarity keeps the 90 percent threshold after target prechecks pass', async () => {
  const runDir = await makeFinalVisualRun();
  await writeRunFile(runDir, 'agent-5-output/final-visual-target/desktop.png', pngHeader(1440, 900, 'target-desktop'));
  await writeRunFile(runDir, 'agent-5-output/final-visual-target/mobile.png', pngHeader(390, 844, 'target-mobile'));
  await writeFinalTargetManifest(runDir);

  const result = await runFinalVisualSimilarityGate({
    runDir,
    compareImages: async () => ({
      results: [
        { name: 'desktop', width: 1440, height: 900, finalWidth: 1440, finalHeight: 900, similarity: 0.89 },
        { name: 'mobile', width: 390, height: 844, finalWidth: 390, finalHeight: 844, similarity: 0.91 },
      ],
      overall: 0.9,
    }),
  });

  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /desktop: similarity 89% below 90%/);
});
