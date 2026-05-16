#!/usr/bin/env node
import { access, copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parseRunInput } from '../run/pre-agent2-local-spec.mjs';
import { writeDesktopState } from './run.mjs';

export const RUN_ALREADY_EXISTS = 'RUN_ALREADY_EXISTS';
export const DESKTOP_RUN_CREATED = 'DESKTOP_RUN_CREATED';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');

const RUN_DIRS = [
  'input-assets',
  'pre-agent2-output',
  'agent-1-output',
  'agent-2-output',
  'agent-2-5-output',
  'agent-3-output',
  'agent-4-output',
  'agent-5-output',
  'agent-6-output',
  'assets',
  'gate-results',
  'deployment-output',
  'site',
];

function parseArgs(argv) {
  const args = { rootDir: REPO_ROOT, assetDir: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--site-id') {
      args.siteId = argv[index + 1];
      index += 1;
    } else if (arg === '--input') {
      args.inputPath = argv[index + 1];
      index += 1;
    } else if (arg === '--assets') {
      args.assetDir = argv[index + 1];
      index += 1;
    } else if (arg === '--root-dir') {
      args.rootDir = argv[index + 1];
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.help && (!args.siteId || !args.inputPath)) {
    throw new Error('Usage: node scripts/desktop/create-run.mjs --site-id <site-id> --input <input.md> [--assets <asset-dir>]');
  }
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

async function copyInputAssets({ assetDir, runDir }) {
  if (!assetDir) return [];
  const absoluteAssetDir = path.resolve(assetDir);
  if (!(await exists(absoluteAssetDir))) return [];
  const entries = await readdir(absoluteAssetDir, { withFileTypes: true });
  const copied = [];
  let imageIndex = 1;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const sourcePath = path.join(absoluteAssetDir, entry.name);
    const info = await stat(sourcePath);
    if (!info.size) continue;
    const ext = path.extname(entry.name) || '.asset';
    const fileName = `${String(imageIndex).padStart(2, '0')}-${entry.name.replace(/[^a-z0-9._-]+/gi, '-').toLowerCase()}`;
    const runPath = path.join('input-assets', fileName);
    await copyFile(sourcePath, path.join(runDir, runPath));
    copied.push({
      kind: 'image',
      purpose: 'design_reference',
      source_local_path: sourcePath,
      run_path: runPath,
      file_name: fileName,
      size: info.size,
      extension: ext,
    });
    imageIndex += 1;
  }
  return copied;
}

function appendAssetLines(inputText, assets) {
  if (assets.length === 0) return inputText;
  const lines = [
    inputText.trimEnd(),
    '',
    '## Input assets',
    '',
    ...assets.map((asset) => `- image: ${asset.run_path} (purpose: ${asset.purpose}, source: ${asset.source_local_path})`),
    '',
  ];
  return lines.join('\n');
}

export async function createDesktopRun({
  rootDir = REPO_ROOT,
  siteId,
  inputPath,
  assetDir = '',
  now = () => new Date().toISOString(),
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const runDir = path.join(absoluteRoot, 'runs', siteId);
  if (await exists(runDir)) {
    return { ok: false, code: RUN_ALREADY_EXISTS, runDir, siteId };
  }

  await mkdir(runDir, { recursive: true });
  for (const dir of RUN_DIRS) await mkdir(path.join(runDir, dir), { recursive: true });

  const rawInput = await readFile(path.resolve(inputPath), 'utf8');
  const assets = await copyInputAssets({ assetDir, runDir });
  const inputText = appendAssetLines(rawInput, assets);
  await writeFile(path.join(runDir, 'input.md'), inputText, 'utf8');
  await writeFile(path.join(runDir, 'human-review-events.jsonl'), '', 'utf8');

  const intake = parseRunInput(inputText);
  const createdAt = now();
  const runMeta = {
    run_type: 'production',
    deployable: true,
    mode: 'desktop',
    site_id: siteId,
    target_domain: intake.target_domain || '',
    created_at: createdAt,
    status: 'active',
    source: 'desktop-input',
    input_path: path.resolve(inputPath),
    input_assets: assets,
  };
  await writeFile(path.join(runDir, 'run-meta.json'), `${JSON.stringify(runMeta, null, 2)}\n`, 'utf8');
  await writeDesktopState(runDir, {
    mode: 'desktop',
    stage: 'pre-agent2',
    last_completed_stage: null,
    next_action: 'Run desktop:run to generate a local SPEC review.',
    blocking_reason: null,
    repair_attempts: {},
    updated_at: createdAt,
  });

  return { ok: true, code: DESKTOP_RUN_CREATED, runDir, siteId, runMeta };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/desktop/create-run.mjs --site-id <site-id> --input <input.md> [--assets <asset-dir>]');
    return;
  }
  const result = await createDesktopRun(args);
  console.log(result.code);
  if (result.runDir) console.log(`run_dir: ${result.runDir}`);
  process.exitCode = result.ok ? 0 : 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
