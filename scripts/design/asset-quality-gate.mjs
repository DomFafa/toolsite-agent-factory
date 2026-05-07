import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROLE_POLICIES = {
  ingredientHero: {
    label: 'ingredient hero',
    minWidth: 1000,
    minHeight: 360,
    minAspect: 2.2,
    maxAspect: 3.4,
    allowVector: true,
    forbidSvgText: true,
    forbidSvgRasterEmbedding: true,
  },
  presetThumbnail: {
    label: 'preset thumbnail',
    minWidth: 300,
    minHeight: 190,
    minAspect: 1.2,
    maxAspect: 2.2,
    allowVector: true,
    forbidSvgText: true,
    forbidSvgRasterEmbedding: true,
  },
  formatIcon: {
    label: 'meal format icon',
    minWidth: 100,
    minHeight: 40,
    minAspect: 1.2,
    maxAspect: 3.8,
    allowVector: true,
    forbidSvgText: true,
    forbidSvgRasterEmbedding: true,
  },
  compareImage: {
    label: 'comparison image',
    minWidth: 72,
    minHeight: 72,
    minAspect: 0.75,
    maxAspect: 1.4,
    allowVector: true,
    forbidSvgText: true,
    forbidSvgRasterEmbedding: true,
  },
};

export function classifyAsset(filename) {
  const base = path.basename(filename).toLowerCase();
  if (base.startsWith('group-')) return 'ingredientHero';
  if (base.startsWith('preset-')) return 'presetThumbnail';
  if (base.startsWith('format-')) return 'formatIcon';
  if (base.startsWith('compare-')) return 'compareImage';
  return null;
}

export function extractUiAssetRefs(source) {
  return [...source.matchAll(/["'(`](\/ui-assets\/[^"'()`\s]+\.(?:png|jpe?g|webp|svg))["'`)]/gi)]
    .map((match) => match[1])
    .filter((asset, index, all) => all.indexOf(asset) === index)
    .sort();
}

function parseSvgNumber(value) {
  if (!value) return null;
  const match = value.match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}

export function inspectImageBuffer(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') {
    const pngSignature = '89504e470d0a1a0a';
    if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
      throw new Error(`${filename} is not a valid PNG`);
    }
    return {
      type: 'raster',
      format: 'png',
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      vector: false,
    };
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    return inspectJpegBuffer(buffer, filename);
  }

  if (ext === '.svg') {
    const svg = buffer.toString('utf8');
    const viewBox = svg.match(/\bviewBox=["']\s*([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)\s*["']/i);
    const width = viewBox ? Number(viewBox[3]) : parseSvgNumber(svg.match(/\bwidth=["']([^"']+)["']/i)?.[1]);
    const height = viewBox ? Number(viewBox[4]) : parseSvgNumber(svg.match(/\bheight=["']([^"']+)["']/i)?.[1]);
    return {
      type: 'vector',
      format: 'svg',
      width,
      height,
      vector: true,
      hasText: /<text[\s>]/i.test(svg),
      embedsRaster: /<image[\s>]/i.test(svg),
    };
  }

  throw new Error(`${filename} has unsupported image extension ${ext}`);
}

function inspectJpegBuffer(buffer, filename) {
  let offset = 2;
  if (buffer.readUInt16BE(0) !== 0xffd8) {
    throw new Error(`${filename} is not a valid JPEG`);
  }
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return {
        type: 'raster',
        format: 'jpeg',
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
        vector: false,
      };
    }
    offset += 2 + length;
  }
  throw new Error(`${filename} JPEG dimensions could not be read`);
}

export function validateImageAsset(assetPath, metadata, role) {
  const policy = ROLE_POLICIES[role];
  const errors = [];
  if (!policy) return errors;

  if (!Number.isFinite(metadata.width) || !Number.isFinite(metadata.height)) {
    errors.push(`${assetPath}: dimensions could not be determined`);
    return errors;
  }

  if (metadata.width < policy.minWidth || metadata.height < policy.minHeight) {
    errors.push(`${assetPath}: ${policy.label} is ${metadata.width}x${metadata.height}, below required ${policy.minWidth}x${policy.minHeight}`);
  }

  const aspect = metadata.width / metadata.height;
  if (aspect < policy.minAspect || aspect > policy.maxAspect) {
    errors.push(`${assetPath}: ${policy.label} aspect ratio ${aspect.toFixed(2)} is outside ${policy.minAspect}-${policy.maxAspect}`);
  }

  if (metadata.vector && !policy.allowVector) {
    errors.push(`${assetPath}: SVG/vector assets are not allowed for ${policy.label}`);
  }

  if (metadata.vector && policy.forbidSvgText && metadata.hasText) {
    errors.push(`${assetPath}: SVG ${policy.label} must not contain <text>; render labels as HTML`);
  }

  if (metadata.vector && policy.forbidSvgRasterEmbedding && metadata.embedsRaster) {
    errors.push(`${assetPath}: SVG ${policy.label} must not embed raster <image> files; use original vector or high-resolution raster`);
  }

  return errors;
}

async function readReferencedAssets(runDir) {
  const sourceFiles = [
    path.join(runDir, 'site/src/pages/index.astro'),
    path.join(runDir, 'site/src/styles/global.css'),
  ];
  const refs = new Set();
  for (const file of sourceFiles) {
    try {
      const source = await readFile(file, 'utf8');
      extractUiAssetRefs(source).forEach((asset) => refs.add(asset));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return [...refs].sort();
}

export async function runAssetQualityGate({ runDir }) {
  const refs = await readReferencedAssets(runDir);
  const checked = [];
  const errors = [];

  for (const ref of refs) {
    const filename = ref.replace('/ui-assets/', '');
    const role = classifyAsset(filename);
    if (!role) continue;
    const filePath = path.join(runDir, 'site/public/ui-assets', filename);
    try {
      const metadata = inspectImageBuffer(await readFile(filePath), filename);
      checked.push({ ref, role, ...metadata });
      errors.push(...validateImageAsset(ref, metadata, role));
    } catch (error) {
      errors.push(`${ref}: ${error.message}`);
    }
  }

  return { checked, errors };
}

function parseArgs(argv) {
  const args = { runDir: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.runDir) {
    console.error('Usage: node scripts/design/asset-quality-gate.mjs --run-dir runs/<site-id>');
    process.exitCode = 2;
    return;
  }

  const result = await runAssetQualityGate({ runDir: path.resolve(args.runDir) });
  for (const asset of result.checked) {
    console.log(`checked ${asset.ref} (${asset.role}) ${asset.width}x${asset.height} ${asset.format}`);
  }

  if (result.errors.length) {
    console.error('\nAsset Quality Gate failed:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Asset Quality Gate passed: ${result.checked.length} referenced UI assets checked.`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
