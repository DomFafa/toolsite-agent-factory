#!/usr/bin/env node
// Thin external-action runner for Agent2.5. It centralizes evidence hashing so
// downstream gates do not have to trust Codex-authored markdown alone.
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const ACTION_RECEIPT_PATH = 'agent-2-5-output/external-design-evidence/action-receipt.json';
export const EXTERNAL_ACTION_FAILED = 'EXTERNAL_ACTION_FAILED';
export const RUNNER_VERSION = 'agent25-external-action/1';

const VALID_ACTIONS = new Set(['design-options', 'selected-assets']);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');

function parseArgs(argv) {
  const args = {
    artifacts: [],
    downloads: [],
    screenshots: [],
    uploadedAssets: [],
    receiptPath: ACTION_RECEIPT_PATH,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    } else if (arg === '--action') {
      args.action = argv[index + 1];
      index += 1;
    } else if (arg === '--prompt') {
      args.prompt = argv[index + 1];
      index += 1;
    } else if (arg === '--raw-response') {
      args.rawResponse = argv[index + 1];
      index += 1;
    } else if (arg === '--screenshot') {
      args.screenshots.push(argv[index + 1]);
      index += 1;
    } else if (arg === '--artifact') {
      args.artifacts.push(argv[index + 1]);
      index += 1;
    } else if (arg === '--download') {
      args.downloads.push(argv[index + 1]);
      index += 1;
    } else if (arg === '--uploaded-asset') {
      args.uploadedAssets.push(argv[index + 1]);
      index += 1;
    } else if (arg === '--receipt-path') {
      args.receiptPath = argv[index + 1];
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (args.help) return args;
  if (!args.runDir || !args.action || !args.prompt) throw new Error(usage());
  if (!VALID_ACTIONS.has(args.action)) throw new Error(`Invalid --action: ${args.action}`);
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

export function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function sha256File(filePath) {
  return sha256Buffer(await readFile(filePath));
}

function insideRunDir(runDir, absolutePath) {
  const relPath = path.relative(runDir, absolutePath);
  return relPath && !relPath.startsWith('..') && !path.isAbsolute(relPath);
}

async function resolveRunRelative(runDir, value, label) {
  if (!value) throw new Error(`Missing ${label}`);
  const candidates = path.isAbsolute(value)
    ? [path.resolve(value)]
    : [path.resolve(runDir, value), path.resolve(value)];
  for (const candidate of candidates) {
    if (insideRunDir(runDir, candidate) && await exists(candidate)) {
      return {
        absolutePath: candidate,
        relPath: path.relative(runDir, candidate).replace(/\\/g, '/'),
      };
    }
  }
  const display = path.isAbsolute(value) ? value : path.join(runDir, value);
  throw new Error(`${label} must exist under run dir: ${display}`);
}

async function fileRecord(runDir, value, label) {
  const resolved = await resolveRunRelative(runDir, value, label);
  const fileStat = await stat(resolved.absolutePath);
  if (!fileStat.isFile()) throw new Error(`${label} must be a file: ${resolved.relPath}`);
  return {
    path: resolved.relPath,
    sha256: await sha256File(resolved.absolutePath),
    size: fileStat.size,
  };
}

async function buildReceipt({ runDir, args, status, error = null, startedAt, completedAt = new Date().toISOString() }) {
  const prompt = await fileRecord(runDir, args.prompt, 'prompt');
  const rawResponse = args.rawResponse ? await fileRecord(runDir, args.rawResponse, 'raw response') : null;
  const screenshots = [];
  for (const screenshot of args.screenshots) {
    screenshots.push({ ...(await fileRecord(runDir, screenshot, 'screenshot')), kind: 'conversation' });
  }
  const downloads = [];
  for (const download of args.downloads) downloads.push(await fileRecord(runDir, download, 'download'));
  const uploadedAssets = [];
  for (const asset of args.uploadedAssets) uploadedAssets.push(await fileRecord(runDir, asset, 'uploaded asset'));
  const artifactRecords = [];
  for (const artifact of args.artifacts) artifactRecords.push(await fileRecord(runDir, artifact, 'artifact'));

  const artifactHashes = {};
  for (const record of [
    prompt,
    rawResponse,
    ...screenshots,
    ...downloads,
    ...uploadedAssets,
    ...artifactRecords,
  ].filter(Boolean)) {
    artifactHashes[record.path] = record.sha256;
  }

  return {
    schemaVersion: 1,
    action: args.action,
    run_dir: path.relative(process.cwd(), runDir).replace(/\\/g, '/'),
    started_at: startedAt,
    completed_at: completedAt,
    tool: {
      name: 'web-access',
      surface: args.action === 'selected-assets' ? 'ChatGPT asset generation surface' : 'ChatGPT web UI',
      command: 'web-access/scripts/check-deps.sh',
    },
    prompt_path: prompt.path,
    prompt_sha256: prompt.sha256,
    uploaded_assets: uploadedAssets,
    screenshots,
    raw_response: rawResponse,
    downloads,
    artifact_hashes: artifactHashes,
    status,
    error,
    runner_version: RUNNER_VERSION,
  };
}

async function writeReceipt(runDir, receiptPath, receipt) {
  const resolved = path.isAbsolute(receiptPath)
    ? receiptPath
    : path.join(runDir, receiptPath);
  if (!insideRunDir(runDir, resolved)) throw new Error(`receipt path must be under run dir: ${receiptPath}`);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return resolved;
}

function runWebAccessPreflight() {
  const script = path.join(REPO_ROOT, 'web-access/scripts/check-deps.sh');
  const result = spawnSync('bash', [script], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
    signal: result.signal,
  };
}

function evidenceIsComplete(args) {
  return Boolean(args.rawResponse && args.screenshots.length > 0 && (args.artifacts.length > 0 || args.downloads.length > 0));
}

function usage() {
  return [
    'Usage:',
    '  node scripts/run/run-agent25-external-action.mjs --run-dir runs/<site-id> --action design-options|selected-assets --prompt <path> \\',
    '    --raw-response <path> --screenshot <path> --artifact <path> [--artifact <path>...] [--download <path>...]',
    '',
    `Writes ${ACTION_RECEIPT_PATH} by default.`,
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const runDir = path.resolve(args.runDir);
  const startedAt = new Date().toISOString();

  const preflight = runWebAccessPreflight();
  if (!preflight.ok) {
    const receipt = await buildReceipt({
      runDir,
      args,
      status: 'failed',
      error: [
        'web-access preflight failed',
        preflight.stdout.trim(),
        preflight.stderr.trim(),
      ].filter(Boolean).join('\n'),
      startedAt,
    });
    await writeReceipt(runDir, args.receiptPath, receipt);
    console.log(EXTERNAL_ACTION_FAILED);
    console.log(receipt.error);
    process.exitCode = 1;
    return;
  }

  if (!evidenceIsComplete(args)) {
    const receipt = await buildReceipt({
      runDir,
      args,
      status: 'failed',
      error: 'external action evidence is incomplete: raw response, screenshot, and artifact/download are required',
      startedAt,
    });
    await writeReceipt(runDir, args.receiptPath, receipt);
    console.log(EXTERNAL_ACTION_FAILED);
    console.log(receipt.error);
    process.exitCode = 1;
    return;
  }

  const receipt = await buildReceipt({ runDir, args, status: 'pass', startedAt });
  const outputPath = await writeReceipt(runDir, args.receiptPath, receipt);
  console.log(`PASS Agent2.5 external action receipt: ${path.relative(process.cwd(), outputPath)}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 2;
  });
}
