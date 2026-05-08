#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resultFromFailures, writeGateResult } from '../run/gate-result-utils.mjs';

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
    throw new Error('Usage: node scripts/qa/check-visual-restoration-similarity.mjs --run-dir runs/<site-id> [--threshold 0.9] [--write]');
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

function compareHtml(pairs) {
  return `<!doctype html>
<meta charset="utf-8">
<title>Visual restoration similarity gate</title>
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
  const restored = await loadImage(pair.restoredSrc);
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
  context.drawImage(restored, 0, 0, width, height);
  const restoredData = context.getImageData(0, 0, width, height).data;

  let diff = 0;
  for (let index = 0; index < targetData.length; index += 4) {
    diff += Math.abs(targetData[index] - restoredData[index]);
    diff += Math.abs(targetData[index + 1] - restoredData[index + 1]);
    diff += Math.abs(targetData[index + 2] - restoredData[index + 2]);
  }

  const pixelCount = width * height;
  const maxDiff = pixelCount * 3 * 255;
  return {
    name: pair.name,
    width,
    height,
    restoredWidth: restored.naturalWidth,
    restoredHeight: restored.naturalHeight,
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

export async function runVisualRestorationSimilarityGate({ runDir, threshold = 0.9 }) {
  const absoluteRunDir = path.resolve(runDir);
  const outputDir = path.join(absoluteRunDir, 'agent-5-output/visual-restoration-similarity');
  await mkdir(outputDir, { recursive: true });

  const sourcePairs = [
    {
      name: 'desktop',
      targetPath: path.join(absoluteRunDir, 'agent-2-5-output/selected-design/target/desktop.png'),
      restoredPath: path.join(absoluteRunDir, 'agent-3-output/final-screenshots/desktop.png'),
    },
    {
      name: 'mobile',
      targetPath: path.join(absoluteRunDir, 'agent-2-5-output/selected-design/target/mobile.png'),
      restoredPath: path.join(absoluteRunDir, 'agent-3-output/final-screenshots/mobile.png'),
    },
  ];

  const failures = [];
  const evidence = {
    threshold,
    comparedPairs: sourcePairs.map((pair) => ({
      name: pair.name,
      target: path.relative(absoluteRunDir, pair.targetPath),
      restored: path.relative(absoluteRunDir, pair.restoredPath),
    })),
  };

  let details = { results: [], overall: 0 };
  try {
    const pairs = [];
    for (const pair of sourcePairs) {
      pairs.push({
        name: pair.name,
        targetSrc: await imageDataUri(pair.targetPath),
        restoredSrc: await imageDataUri(pair.restoredPath),
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
    details = parseJsOutput(stdout);
  } catch (error) {
    failures.push(`visual restoration similarity comparison failed: ${error.message}`);
  }

  for (const result of details.results || []) {
    if (result.similarity < threshold) {
      failures.push(`${result.name}: similarity ${Math.round(result.similarity * 100)}% below ${Math.round(threshold * 100)}%`);
    }
    if (result.width !== result.restoredWidth || result.height !== result.restoredHeight) {
      failures.push(
        `${result.name}: restored screenshot dimensions ${result.restoredWidth}x${result.restoredHeight} differ from target ${result.width}x${result.height}`,
      );
    }
  }
  if ((details.results || []).length !== sourcePairs.length) {
    failures.push(`expected ${sourcePairs.length} screenshot comparisons, found ${(details.results || []).length}`);
  }

  return resultFromFailures({
    gate: 'visual-restoration-similarity',
    runDir: absoluteRunDir,
    failures,
    details,
    evidence,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runVisualRestorationSimilarityGate({ runDir: args.runDir, threshold: args.threshold });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'visual-restoration-similarity.json', result);
  console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} visual restoration similarity`);
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
