#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resultFromFailures, writeGateResult } from '../run/gate-result-utils.mjs';

export const FINAL_VISUAL_TARGET_MISSING = 'FINAL_VISUAL_TARGET_MISSING';
export const FINAL_VISUAL_TARGET_DIMENSION_MISMATCH = 'FINAL_VISUAL_TARGET_DIMENSION_MISMATCH';

const FINAL_VISUAL_TARGET_DESKTOP_PATH = 'agent-5-output/final-visual-target/desktop.png';
const FINAL_VISUAL_TARGET_MOBILE_PATH = 'agent-5-output/final-visual-target/mobile.png';
const FINAL_VISUAL_TARGET_MANIFEST_PATH = 'agent-5-output/final-visual-target/final-visual-target-manifest.json';
const FINAL_VISUAL_TARGET_SOURCE_MAP_PATH = 'agent-5-output/final-visual-target/source-map.json';
const SELECTED_DESIGN_PACKAGE_PATH = 'agent-2-5-output/selected-assets/selected-design-package.md';
const ACTION_RECEIPT_PATH = 'agent-2-5-output/external-design-evidence/action-receipt.json';

function parseArgs(argv) {
  const args = { write: false, threshold: 0.9 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') {
      args.write = true;
    } else if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    } else if (arg === '--threshold') {
      args.threshold = Number(argv[index + 1]);
      index += 1;
    }
  }
  if (!args.runDir) {
    throw new Error('Usage: node scripts/qa/check-final-visual-similarity.mjs --run-dir runs/<site-id> [--threshold 0.9] [--write]');
  }
  if (!Number.isFinite(args.threshold) || args.threshold <= 0 || args.threshold > 1) {
    throw new Error('--threshold must be a number in (0, 1]');
  }
  return args;
}

function runBrowse(chain) {
  const browseBin = process.env.GSTACK_BROWSE
    || path.join(os.homedir(), '.codex/skills/gstack/browse/dist/browse');
  const result = spawnSync(browseBin, ['chain'], {
    input: JSON.stringify(chain),
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${result.stdout}\n${result.stderr}`.trim());
  }
  return result.stdout;
}

function parseJsOutput(stdout) {
  const lines = stdout.split('\n');
  const start = lines.findIndex((entry) => entry.startsWith('[js] '));
  if (start < 0) throw new Error('missing browse js output');
  const jsonLines = [lines[start].slice(5)];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\[[^\]]+\]/.test(lines[index])) break;
    jsonLines.push(lines[index]);
  }
  return JSON.parse(jsonLines.join('\n').trim());
}

async function imageDataUri(filePath) {
  const data = await readFile(filePath);
  return `data:image/png;base64,${data.toString('base64')}`;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function pngInfo(filePath) {
  const buffer = await readFile(filePath);
  const signature = '89504e470d0a1a0a';
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== signature) {
    throw new Error(`${filePath} is not a PNG`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    size: buffer.length,
  };
}

async function readJsonOptional(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function sha256File(filePath) {
  return crypto.createHash('sha256').update(await readFile(filePath)).digest('hex');
}

function manifestHash(manifest, relPath) {
  return String(
    manifest?.sha256_hashes?.[relPath] ||
    manifest?.sha256Hashes?.[relPath] ||
    manifest?.target_hashes?.[relPath] ||
    manifest?.targetHashes?.[relPath] ||
    '',
  ).trim();
}

function sourceMapHash(sourceMap, relPath) {
  return String(
    sourceMap?.target_hashes?.[relPath] ||
    sourceMap?.targetHashes?.[relPath] ||
    sourceMap?.sha256_hashes?.[relPath] ||
    sourceMap?.sha256Hashes?.[relPath] ||
    '',
  ).trim();
}

function outputPathFor(record, name) {
  return String(record?.output_paths?.[name] || record?.outputPaths?.[name] || record?.output_targets?.[name] || record?.outputTargets?.[name] || '').trim();
}

async function validateFinalVisualTargetManifest({ absoluteRunDir, sourcePairs, failures }) {
  const manifestPath = path.join(absoluteRunDir, FINAL_VISUAL_TARGET_MANIFEST_PATH);
  const sourceMapPath = path.join(absoluteRunDir, FINAL_VISUAL_TARGET_SOURCE_MAP_PATH);
  const manifest = await readJsonOptional(manifestPath);
  const sourceMap = await readJsonOptional(sourceMapPath);

  if (!manifest) failures.push(`${FINAL_VISUAL_TARGET_MISSING}: missing ${FINAL_VISUAL_TARGET_MANIFEST_PATH}`);
  if (!sourceMap) failures.push(`${FINAL_VISUAL_TARGET_MISSING}: missing ${FINAL_VISUAL_TARGET_SOURCE_MAP_PATH}`);
  if (!manifest || !sourceMap) return;

  if (String(manifest.source_selected_design_package || '').trim() !== SELECTED_DESIGN_PACKAGE_PATH) {
    failures.push(`${FINAL_VISUAL_TARGET_MISSING}: final visual target manifest must reference ${SELECTED_DESIGN_PACKAGE_PATH}`);
  }
  if (String(manifest.external_action_receipt || '').trim() !== ACTION_RECEIPT_PATH) {
    failures.push(`${FINAL_VISUAL_TARGET_MISSING}: final visual target manifest must reference ${ACTION_RECEIPT_PATH}`);
  }
  if (!manifest.generation_method && !manifest.generationMethod) {
    failures.push(`${FINAL_VISUAL_TARGET_MISSING}: final visual target manifest must record generation method`);
  }
  if (!manifest.source_selected_targets && !manifest.sourceSelectedTargets) {
    failures.push(`${FINAL_VISUAL_TARGET_MISSING}: final visual target manifest must record source selected targets`);
  }

  for (const pair of sourcePairs) {
    const relPath = path.relative(absoluteRunDir, pair.targetPath);
    if (outputPathFor(manifest, pair.name) !== relPath) {
      failures.push(`${FINAL_VISUAL_TARGET_MISSING}: final visual target manifest output path for ${pair.name} must be ${relPath}`);
    }
    if (outputPathFor(sourceMap, pair.name) !== relPath) {
      failures.push(`${FINAL_VISUAL_TARGET_MISSING}: final visual target source-map output path for ${pair.name} must be ${relPath}`);
    }
    const actualHash = await sha256File(pair.targetPath);
    const expectedManifestHash = manifestHash(manifest, relPath);
    const expectedSourceMapHash = sourceMapHash(sourceMap, relPath);
    if (!/^[a-f0-9]{64}$/i.test(expectedManifestHash)) {
      failures.push(`${FINAL_VISUAL_TARGET_MISSING}: final visual target manifest hash missing for ${relPath}`);
    } else if (expectedManifestHash !== actualHash) {
      failures.push(`${FINAL_VISUAL_TARGET_MISSING}: final visual target manifest hash for ${relPath} does not match actual file`);
    }
    if (!/^[a-f0-9]{64}$/i.test(expectedSourceMapHash)) {
      failures.push(`${FINAL_VISUAL_TARGET_MISSING}: final visual target source-map hash missing for ${relPath}`);
    } else if (expectedSourceMapHash !== actualHash) {
      failures.push(`${FINAL_VISUAL_TARGET_MISSING}: final visual target source-map hash for ${relPath} does not match actual file`);
    }
  }
}

async function defaultCompareImages({ outputDir, sourcePairs, evidence, absoluteRunDir }) {
  const pairs = [];
  for (const pair of sourcePairs) {
    pairs.push({
      name: pair.name,
      target: path.relative(absoluteRunDir, pair.targetPath),
      final: path.relative(absoluteRunDir, pair.finalPath),
      targetSrc: await imageDataUri(pair.targetPath),
      finalSrc: await imageDataUri(pair.finalPath),
    });
  }

  const htmlPath = path.join(outputDir, 'compare.html');
  await writeFile(htmlPath, compareHtml(pairs));
  evidence.comparePage = path.relative(absoluteRunDir, htmlPath);

  const stdout = runBrowse([
    ['goto', pathToFileURL(htmlPath).href],
    ['wait', '--networkidle'],
    ['js', 'await window.__compareImages()'],
  ]);
  return parseJsOutput(stdout);
}

function compareHtml(pairs) {
  return `<!doctype html>
<meta charset="utf-8">
<title>Final visual similarity gate</title>
<script>
window.__pairs = ${JSON.stringify(pairs)};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load image'));
    img.src = src;
  });
}

async function comparePair(pair) {
  const target = await loadImage(pair.targetSrc);
  const final = await loadImage(pair.finalSrc);
  const width = target.naturalWidth;
  const height = target.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  context.clearRect(0, 0, width, height);
  context.drawImage(target, 0, 0, width, height);
  const targetData = context.getImageData(0, 0, width, height).data;

  context.clearRect(0, 0, width, height);
  context.drawImage(final, 0, 0, width, height);
  const finalData = context.getImageData(0, 0, width, height).data;

  let diff = 0;
  for (let index = 0; index < targetData.length; index += 4) {
    diff += Math.abs(targetData[index] - finalData[index]);
    diff += Math.abs(targetData[index + 1] - finalData[index + 1]);
    diff += Math.abs(targetData[index + 2] - finalData[index + 2]);
  }

  const pixelCount = width * height;
  const maxDiff = pixelCount * 3 * 255;
  return {
    name: pair.name,
    width,
    height,
    finalWidth: final.naturalWidth,
    finalHeight: final.naturalHeight,
    similarity: Number((1 - diff / maxDiff).toFixed(4)),
  };
}

window.__compareImages = async () => {
  const results = [];
  for (const pair of window.__pairs) {
    results.push(await comparePair(pair));
  }
  return {
    results,
    overall: Number((results.reduce((sum, item) => sum + item.similarity, 0) / results.length).toFixed(4)),
  };
};
</script>`;
}

export async function runFinalVisualSimilarityGate({ runDir, threshold = 0.9, compareImages = defaultCompareImages }) {
  const absoluteRunDir = path.resolve(runDir);
  const outputDir = path.join(absoluteRunDir, 'agent-5-output/final-visual-similarity');
  await mkdir(outputDir, { recursive: true });

  const sourcePairs = [
    {
      name: 'desktop',
      targetPath: path.join(absoluteRunDir, FINAL_VISUAL_TARGET_DESKTOP_PATH),
      finalPath: path.join(absoluteRunDir, 'agent-5-output/final-visual-lock/desktop.png'),
    },
    {
      name: 'mobile',
      targetPath: path.join(absoluteRunDir, FINAL_VISUAL_TARGET_MOBILE_PATH),
      finalPath: path.join(absoluteRunDir, 'agent-5-output/final-visual-lock/mobile.png'),
    },
  ];

  const failures = [];
  const evidence = {
    threshold,
    comparedPairs: sourcePairs.map((pair) => ({
      name: pair.name,
      target: path.relative(absoluteRunDir, pair.targetPath),
      final: path.relative(absoluteRunDir, pair.finalPath),
    })),
  };

  let details = { results: [], overall: 0 };
  try {
    for (const pair of sourcePairs) {
      if (!(await exists(pair.targetPath))) {
        failures.push(`${FINAL_VISUAL_TARGET_MISSING}: ${pair.name} final visual target missing: ${path.relative(absoluteRunDir, pair.targetPath)}`);
        continue;
      }
      if (!(await exists(pair.finalPath))) {
        failures.push(`${pair.name} final screenshot missing: ${path.relative(absoluteRunDir, pair.finalPath)}`);
        continue;
      }
      const target = await pngInfo(pair.targetPath);
      const final = await pngInfo(pair.finalPath);
      const targetSha = await sha256File(pair.targetPath);
      const finalSha = await sha256File(pair.finalPath);
      if (targetSha === finalSha) {
        failures.push(`${FINAL_VISUAL_TARGET_MISSING}: ${pair.name} final visual target must not copy current final screenshot`);
      }
      if (target.width !== final.width || target.height !== final.height) {
        failures.push(
          `${FINAL_VISUAL_TARGET_DIMENSION_MISMATCH}: ${pair.name}: final screenshot dimensions ${final.width}x${final.height} differ from final visual target ${target.width}x${target.height}`,
        );
      }
    }
    if (failures.length === 0) {
      await validateFinalVisualTargetManifest({ absoluteRunDir, sourcePairs, failures });
    }
    if (failures.length === 0) {
      details = await compareImages({ outputDir, sourcePairs, evidence, absoluteRunDir });
    }
  } catch (error) {
    failures.push(`visual similarity comparison failed: ${error.message}`);
  }

  for (const result of details.results || []) {
    if (result.similarity < threshold) {
      failures.push(`${result.name}: similarity ${Math.round(result.similarity * 100)}% below ${Math.round(threshold * 100)}%`);
    }
    if (result.width !== result.finalWidth || result.height !== result.finalHeight) {
      failures.push(
        `${FINAL_VISUAL_TARGET_DIMENSION_MISMATCH}: ${result.name}: final screenshot dimensions ${result.finalWidth}x${result.finalHeight} differ from final visual target ${result.width}x${result.height}`,
      );
    }
  }
  if (failures.length === 0 && (details.results || []).length !== sourcePairs.length) {
    failures.push(`expected ${sourcePairs.length} screenshot comparisons, found ${(details.results || []).length}`);
  }

  return resultFromFailures({
    gate: 'final-visual-similarity',
    runDir: absoluteRunDir,
    failures,
    details,
    evidence,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runFinalVisualSimilarityGate({ runDir: args.runDir, threshold: args.threshold });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'final-visual-similarity.json', result);
  console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} final visual similarity`);
  if (result.details?.overall) console.log(`overall similarity: ${Math.round(result.details.overall * 100)}%`);
  if (result.failures.length) {
    for (const failure of result.failures) console.log(`- ${failure}`);
  }
  process.exitCode = result.passed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
