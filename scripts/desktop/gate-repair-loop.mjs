#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const GATE_REPAIR_PASSED = 'GATE_REPAIR_PASSED';
export const NEEDS_HUMAN_DECISION = 'NEEDS_HUMAN_DECISION';

const MAX_REPAIR_ATTEMPTS = 5;

function parseArgs(argv) {
  const args = { maxAttempts: MAX_REPAIR_ATTEMPTS };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    } else if (arg === '--gate') {
      args.gate = argv[index + 1];
      index += 1;
    } else if (arg === '--command') {
      args.command = argv[index + 1];
      index += 1;
    } else if (arg === '--max-attempts') {
      args.maxAttempts = Number(argv[index + 1]);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.help && (!args.runDir || !args.gate)) {
    throw new Error('Usage: node scripts/desktop/gate-repair-loop.mjs --run-dir runs/<site-id> --gate <gate-name> [--command <gate command>]');
  }
  return args;
}

async function runShellCommand(command, cwd) {
  if (!command) return { passed: false, failures: ['NO_GATE_COMMAND_CONFIGURED'] };
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      resolve({
        passed: code === 0,
        failures: code === 0 ? [] : [`${command} exited ${code}`, stderr.trim(), stdout.trim()].filter(Boolean),
      });
    });
  });
}

async function defaultRepairRunner() {
  return { repaired: false, note: 'NO_AUTOMATED_REPAIR_CONFIGURED' };
}

async function readGateResultsSnapshot(runDir) {
  const gateDir = path.join(runDir, 'gate-results');
  const snapshot = {};
  try {
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(gateDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) snapshot[entry.name] = await readFile(path.join(gateDir, entry.name), 'utf8');
    }
  } catch {
    // Missing gate-results is allowed for the snapshot check.
  }
  return snapshot;
}

function snapshotsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function runGateRepairLoop({
  runDir,
  gate,
  gateRunner = () => runShellCommand('', process.cwd()),
  repairRunner = defaultRepairRunner,
  maxAttempts = MAX_REPAIR_ATTEMPTS,
  now = () => new Date().toISOString(),
} = {}) {
  const beforeSnapshot = await readGateResultsSnapshot(runDir);
  const attempts = [];
  let lastGateResult = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastGateResult = await gateRunner({ runDir, gate, attempt });
    if (lastGateResult?.passed === true) {
      const afterSnapshot = await readGateResultsSnapshot(runDir);
      return {
        ok: true,
        code: GATE_REPAIR_PASSED,
        gate,
        attempts,
        gateResultsUntouched: snapshotsEqual(beforeSnapshot, afterSnapshot),
      };
    }
    const repair = await repairRunner({ runDir, gate, attempt, failure: lastGateResult });
    attempts.push({ attempt, failure: lastGateResult?.failures || [], repair });
  }

  const report = [
    '# Gate Repair Blocking Report',
    '',
    `Status: ${NEEDS_HUMAN_DECISION}`,
    `Gate: ${gate}`,
    `Attempts: ${attempts.length}`,
    '',
    '## Current Failure',
    '',
    ...((lastGateResult?.failures || ['unknown failure']).map((failure) => `- ${failure}`)),
    '',
    '## Needed User Decision',
    '',
    '- Decide whether to adjust product/design requirements, provide missing credentials/assets, or stop the run.',
    '',
    `Generated at: ${now()}`,
    '',
  ].join('\n');
  const outputPath = path.join(runDir, 'agent-5-output', 'gate-repair-blocking-report.md');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, report, 'utf8');
  const afterSnapshot = await readGateResultsSnapshot(runDir);
  return {
    ok: false,
    code: NEEDS_HUMAN_DECISION,
    gate,
    attempts,
    reportPath: outputPath,
    gateResultsUntouched: snapshotsEqual(beforeSnapshot, afterSnapshot),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/desktop/gate-repair-loop.mjs --run-dir runs/<site-id> --gate <gate-name> [--command <gate command>]');
    return;
  }
  const result = await runGateRepairLoop({
    runDir: args.runDir,
    gate: args.gate,
    maxAttempts: args.maxAttempts,
    gateRunner: () => runShellCommand(args.command || '', process.cwd()),
  });
  console.log(result.code);
  if (result.reportPath) console.log(`report: ${result.reportPath}`);
  process.exitCode = result.ok ? 0 : 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}

