#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { checkRunGates } from './check-gates.mjs';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    } else if (arg === '--before') {
      args.before = argv[index + 1];
      index += 1;
    } else if (arg === '--url') {
      args.url = argv[index + 1];
      index += 1;
    }
  }
  if (!args.runDir || !args.before) {
    throw new Error('Usage: node scripts/run/verify-run.mjs --run-dir runs/<site-id> --before <agent> [--url <local-url>]');
  }
  return args;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
}

function beforeOrder(before) {
  const value = String(before).toLowerCase();
  if (['agent-2', 'agent2'].includes(value)) return 2;
  if (['agent-2.5', 'agent2.5', 'agent-2-5', 'agent25'].includes(value)) return 2.5;
  if (['agent-3', 'agent3'].includes(value)) return 3;
  if (['agent-4', 'agent4'].includes(value)) return 4;
  if (['agent-5-final', 'final-qa'].includes(value)) return 5.9;
  if (['agent-6', 'agent6'].includes(value)) return 6;
  return 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDir = path.resolve(args.runDir);
  const order = beforeOrder(args.before);

  if (order >= 2) {
    runCommand('node', ['scripts/qa/check-pre-agent2-toolsite-spec.mjs', '--run-dir', runDir, '--write']);
  }

  if (order >= 2.5) {
    runCommand('node', ['scripts/qa/check-page-plan.mjs', '--run-dir', runDir, '--write']);
    runCommand('node', ['scripts/run/check-web-access.mjs', '--run-dir', runDir, '--write']);
  }

  if (order >= 3) {
    runCommand('node', ['scripts/run/check-agent25-external-design-proof.mjs', '--run-dir', runDir, '--write']);
    runCommand('node', ['scripts/run/check-agent25-lineage.mjs', '--run-dir', runDir, '--write']);
    runCommand('node', ['scripts/qa/check-selected-assets.mjs', '--run-dir', runDir, '--write']);
    runCommand('node', ['scripts/qa/check-toolsite-design-review.mjs', '--run-dir', runDir, '--write']);
  }

  if (order >= 4) {
    runCommand('node', ['scripts/qa/check-visual-restoration-similarity.mjs', '--run-dir', runDir, '--write']);
  }

  if (order >= 6) {
    if (!args.url) {
      throw new Error('--url is required before Agent 6 so browser-backed QA gates can run');
    }
    runCommand('node', ['scripts/qa/check-final-visual-lock.mjs', '--run-dir', runDir, '--url', args.url, '--write']);
    runCommand('node', ['scripts/qa/check-final-visual-similarity.mjs', '--run-dir', runDir, '--write']);
    runCommand('node', ['scripts/qa/check-rendered-assets.mjs', '--run-dir', runDir, '--url', args.url, '--write']);
    runCommand('node', ['scripts/qa/check-tool-spec.mjs', '--run-dir', runDir, '--write']);
    runCommand('node', ['scripts/qa/check-page-plan.mjs', '--run-dir', runDir, '--write']);
    runCommand('node', ['scripts/qa/check-final-qa-evidence.mjs', '--run-dir', runDir, '--write']);
  }

  const gateResult = await checkRunGates({ runDir, before: args.before });
  console.log(JSON.stringify(gateResult, null, 2));
  process.exitCode = gateResult.allowed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
