#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { resultFromFailures, writeGateResult } from '../run/gate-result-utils.mjs';
import { reportHasPassDecision } from '../run/check-gates.mjs';

function parseArgs(argv) {
  const args = { write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') {
      args.write = true;
    } else if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    }
  }
  if (!args.runDir) throw new Error('Usage: node scripts/qa/check-selected-assets.mjs --run-dir runs/<site-id> [--write]');
  return args;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(filePath, encoding = 'utf8') {
  try {
    return await readFile(filePath, encoding === null ? undefined : encoding);
  } catch {
    return null;
  }
}

async function readJsonOptional(filePath) {
  const text = await readOptional(filePath, 'utf8');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function explicitNoImageSlots(text, manifest) {
  const manifestNoSlots = Array.isArray(manifest?.imageSlots) && manifest.imageSlots.length === 0;
  return (
    /required\s+image\s+slots\s*:\s*none/i.test(text || '') ||
    /no\s+image\s+assets?\s+(?:are\s+)?required/i.test(text || '') ||
    (manifestNoSlots && /requiredImageSlots"\s*:\s*"none"|requiredImageSlots['"]?\s*:\s*none/i.test(JSON.stringify(manifest || {})))
  );
}

function manifestSlots(manifest) {
  if (Array.isArray(manifest?.imageSlots)) return manifest.imageSlots;
  if (Array.isArray(manifest?.assets)) return manifest.assets;
  if (manifest?.imageSlots && typeof manifest.imageSlots === 'object') {
    return Object.entries(manifest.imageSlots).map(([id, slot]) => ({ id, ...slot }));
  }
  return [];
}

function slotId(slot, index) {
  return String(slot.id || slot.name || slot.slot || `slot-${index + 1}`).trim();
}

function slotFile(slot) {
  return String(slot.file || slot.path || slot.asset || slot.src || '').trim();
}

function slotSource(slot) {
  return String(slot.source || slot.provenance || slot.generationSource || slot.method || '').trim();
}

function renderedSize(slot) {
  const rendered = slot.rendered || slot.renderedSize || {};
  const width = Number(slot.renderedWidth || rendered.width || slot.widthRendered || slot.targetRenderedWidth);
  const height = Number(slot.renderedHeight || rendered.height || slot.heightRendered || slot.targetRenderedHeight);
  return {
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
  };
}

function rasterDimensions(buffer) {
  if (!buffer || buffer.length < 24) return null;
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer.toString('ascii', 12, 16) === 'IHDR'
  ) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          width: buffer.readUInt16BE(offset + 7),
          height: buffer.readUInt16BE(offset + 5),
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}

function isSvg(filePath) {
  return path.extname(filePath).toLowerCase() === '.svg';
}

function isRaster(filePath) {
  return ['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(filePath).toLowerCase());
}

export async function runSelectedAssetsGate({ runDir }) {
  const absoluteRunDir = path.resolve(runDir);
  const selectedDir = path.join(absoluteRunDir, 'agent-2-5-output/selected-design');
  const imageSlotsPath = path.join(selectedDir, 'image-slots.md');
  const manifestPath = path.join(selectedDir, 'asset-manifest.json');
  const assetContractPath = path.join(selectedDir, 'asset-quality-contract.md');
  const assetReportPath = path.join(absoluteRunDir, 'agent-2-5-output/asset-acquisition-report.md');
  const assetPromptPath = path.join(selectedDir, 'asset-generation-prompt.md');
  const fallbackReportPath = path.join(selectedDir, 'fallback-illustration-report.md');
  const selectedZipPath = path.join(selectedDir, 'downloads/selected-option-assets.zip');

  const failures = [];
  const imageSlotsText = await readOptional(imageSlotsPath, 'utf8');
  const assetContract = await readOptional(assetContractPath, 'utf8');
  const assetReport = await readOptional(assetReportPath, 'utf8');
  const assetPrompt = await readOptional(assetPromptPath, 'utf8');
  const fallbackReport = await readOptional(fallbackReportPath, 'utf8');
  const manifest = await readJsonOptional(manifestPath);

  if (!imageSlotsText) failures.push('missing agent-2-5-output/selected-design/image-slots.md');
  if (!manifest) failures.push('missing or invalid agent-2-5-output/selected-design/asset-manifest.json');
  if (!assetContract) failures.push('missing agent-2-5-output/selected-design/asset-quality-contract.md');
  if (!assetReport) failures.push('missing agent-2-5-output/asset-acquisition-report.md');

  const slots = manifestSlots(manifest);
  const noImageSlots = explicitNoImageSlots(imageSlotsText || '', manifest);

  if (noImageSlots) {
    if (slots.length > 0) failures.push('image-slots.md declares no image assets, but asset-manifest.json lists image slots');
    if (assetContract && !/required\s+image\s+slots\s*:\s*none|no\s+image\s+assets/i.test(assetContract)) {
      failures.push('asset-quality-contract.md must explicitly record the no-image-slots decision');
    }
    if (assetReport && !/required\s+image\s+slots\s*:\s*none|no\s+image\s+assets/i.test(assetReport)) {
      failures.push('asset-acquisition-report.md must explicitly record the no-image-slots decision');
    }
  } else if (slots.length === 0) {
    failures.push('asset-manifest.json must list every selected-design image slot or image-slots.md must explicitly declare no image assets');
  }

  const fallbackUsed = slots.some((slot) => /fallback|illustration/i.test(slotSource(slot)));
  const independentSourcePattern = /gpt|chatgpt|design\s*model|generated|uploaded|external|original|fallback|illustration/i;
  const forbiddenSourcePattern = /crop|cropped|screenshot|target\s*screenshot|from\s*target|desktop\.png|mobile\.png/i;

  if (slots.length > 0) {
    if (!(await exists(selectedZipPath)) && !fallbackReport) {
      failures.push('missing selected-design/downloads/selected-option-assets.zip or fallback-illustration-report.md');
    }
    if (!assetPrompt) {
      failures.push('missing selected-design/asset-generation-prompt.md for post-selection GPT asset request');
    }
    if (assetPrompt && !/independent|standalone|separate/i.test(assetPrompt)) {
      failures.push('asset-generation-prompt.md must request independent/standalone assets');
    }
    if (assetPrompt && !/do\s+not\s+crop|do not extract|not\s+crop|not\s+from\s+the\s+target/i.test(assetPrompt)) {
      failures.push('asset-generation-prompt.md must forbid cropping assets from the option screenshot');
    }
  }

  if (fallbackUsed) {
    if (!fallbackReport) {
      failures.push('fallback assets used but selected-design/fallback-illustration-report.md is missing');
    } else if (!reportHasPassDecision(fallbackReport)) {
      failures.push('fallback-illustration-report.md must include Decision: PASS');
    }
  }

  const details = {
    noImageSlots,
    slotCount: slots.length,
    checkedSlots: [],
  };

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const id = slotId(slot, index);
    const file = slotFile(slot);
    const source = slotSource(slot);
    const rendered = renderedSize(slot);
    details.checkedSlots.push({ id, file, source });

    if (!file) {
      failures.push(`${id}: missing asset file path in asset-manifest.json`);
      continue;
    }
    if (/^https?:\/\//i.test(file)) {
      failures.push(`${id}: asset must be stored locally, not referenced by URL`);
      continue;
    }
    if (/(^|\/)(target|screenshots|final-screenshots|qa-screenshots)\//i.test(file)) {
      failures.push(`${id}: asset path cannot point to target or screenshot folders: ${file}`);
    }
    if (!source || !independentSourcePattern.test(source)) {
      failures.push(`${id}: asset source/provenance must show independent GPT/generated/original/fallback source`);
    }
    if (forbiddenSourcePattern.test(source) || forbiddenSourcePattern.test(file)) {
      failures.push(`${id}: asset source/path indicates cropped screenshot or target-derived material`);
    }
    if (imageSlotsText && !new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(imageSlotsText)) {
      failures.push(`${id}: image-slots.md does not document this slot`);
    }

    const absoluteFile = path.join(selectedDir, file);
    if (!(await exists(absoluteFile))) {
      failures.push(`${id}: asset file does not exist at selected-design/${file}`);
      continue;
    }

    const buffer = await readOptional(absoluteFile, null);
    if (!buffer || buffer.length === 0) {
      failures.push(`${id}: asset file is empty`);
      continue;
    }

    if (isSvg(absoluteFile)) {
      const svgText = buffer.toString('utf8');
      if (/<image\b/i.test(svgText)) failures.push(`${id}: SVG asset embeds raster <image> content`);
      if (/<text\b/i.test(svgText)) failures.push(`${id}: SVG asset contains embedded text labels`);
    } else if (isRaster(absoluteFile)) {
      const dimensions = rasterDimensions(buffer);
      if (!dimensions) {
        failures.push(`${id}: raster asset dimensions could not be read`);
      } else {
        details.checkedSlots[details.checkedSlots.length - 1].sourceWidth = dimensions.width;
        details.checkedSlots[details.checkedSlots.length - 1].sourceHeight = dimensions.height;
        if (!rendered.width || !rendered.height) {
          failures.push(`${id}: renderedWidth/renderedHeight are required for raster asset quality checks`);
        } else {
          if (dimensions.width < rendered.width * 2) {
            failures.push(`${id}: source width ${dimensions.width}px is below 2x rendered width ${rendered.width}px`);
          }
          if (dimensions.height < rendered.height * 2) {
            failures.push(`${id}: source height ${dimensions.height}px is below 2x rendered height ${rendered.height}px`);
          }
        }
      }
    }
  }

  return resultFromFailures({
    gate: 'selected-assets',
    runDir: absoluteRunDir,
    failures,
    details,
    evidence: {
      imageSlots: 'agent-2-5-output/selected-design/image-slots.md',
      manifest: 'agent-2-5-output/selected-design/asset-manifest.json',
      assetGenerationPrompt: 'agent-2-5-output/selected-design/asset-generation-prompt.md',
      fallbackReport: 'agent-2-5-output/selected-design/fallback-illustration-report.md',
      assetReport: 'agent-2-5-output/asset-acquisition-report.md',
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runSelectedAssetsGate({ runDir: args.runDir });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'selected-assets.json', result);
  console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} selected assets`);
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
