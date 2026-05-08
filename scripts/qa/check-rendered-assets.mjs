#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { resultFromFailures, writeGateResult } from '../run/gate-result-utils.mjs';

function parseArgs(argv) {
  const args = { write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') {
      args.write = true;
    } else if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    } else if (arg === '--url') {
      args.url = argv[index + 1];
      index += 1;
    }
  }
  if (!args.runDir || !args.url) {
    throw new Error('Usage: node scripts/qa/check-rendered-assets.mjs --run-dir runs/<site-id> --url <local-url> [--write]');
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
  const line = stdout.split('\n').find((entry) => entry.startsWith('[js] '));
  if (!line) throw new Error('missing browse js output');
  return JSON.parse(line.slice(5));
}

const assetAuditExpression = `(() => {
  const rectInfo = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      area: Math.round(rect.width * rect.height),
      display: style.display,
      visibility: style.visibility,
      opacity: Number(style.opacity)
    };
  };

  const isVisible = (info) => (
    info.area > 0 &&
    info.display !== 'none' &&
    info.visibility !== 'hidden' &&
    info.opacity > 0.01
  );

  const images = [...document.images].map((img) => {
    const info = rectInfo(img);
    return {
      kind: 'img',
      src: img.currentSrc || img.src || '',
      alt: img.alt || '',
      required: img.matches('[data-critical-asset], [data-asset-required], .hero img, .tool-card img, .tool-detail img'),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      visible: isVisible(info),
      rect: info
    };
  });

  const backgroundAssets = [...document.querySelectorAll('*')]
    .map((element) => {
      const style = getComputedStyle(element);
      const backgroundImage = style.backgroundImage;
      if (!backgroundImage || backgroundImage === 'none' || !backgroundImage.includes('url(')) return null;
      const info = rectInfo(element);
      return {
        kind: 'background',
        selector: element.id ? '#' + element.id : element.className ? '.' + String(element.className).trim().split(/\\s+/).slice(0, 3).join('.') : element.tagName.toLowerCase(),
        src: backgroundImage,
        required: element.matches('[data-critical-asset], [data-asset-required], .hero, .tool-card, .tool-detail'),
        visible: isVisible(info),
        rect: info
      };
    })
    .filter(Boolean);

  const failures = [];

  for (const image of images) {
    if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      failures.push('broken image: ' + image.src);
    }
    if (image.required && !image.visible) {
      failures.push('required image not visible: ' + image.src);
    }
  }

  for (const asset of backgroundAssets) {
    if (asset.required && !asset.visible) {
      failures.push('required background asset not visible: ' + asset.selector);
    }
  }

  return JSON.stringify({
    viewport: { width: innerWidth, height: innerHeight },
    imageCount: images.length,
    backgroundAssetCount: backgroundAssets.length,
    images,
    backgroundAssets,
    failures,
    scrollWidth: document.documentElement.scrollWidth
  });
})()`;

export async function runRenderedAssetsGate({ runDir, url }) {
  const absoluteRunDir = path.resolve(runDir);
  const viewports = [
    ['desktop', '1440x900'],
    ['mobile', '390x844'],
  ];
  const failures = [];
  const details = {};

  for (const [name, viewport] of viewports) {
    const stdout = runBrowse([
      ['viewport', viewport],
      ['goto', url],
      ['wait', '--networkidle'],
      ['js', assetAuditExpression],
    ]);
    const result = parseJsOutput(stdout);
    details[name] = result;
    for (const failure of result.failures) failures.push(`${name}: ${failure}`);
  }

  return resultFromFailures({
    gate: 'rendered-assets',
    runDir: absoluteRunDir,
    failures,
    details,
    evidence: { url },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runRenderedAssetsGate({ runDir: args.runDir, url: args.url });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'rendered-assets.json', result);
  console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} rendered assets`);
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
