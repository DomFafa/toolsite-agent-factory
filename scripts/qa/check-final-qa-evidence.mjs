#!/usr/bin/env node
import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  gatePasses,
  readJsonOptional,
  readTextOptional,
  resultFromFailures,
  writeGateResult,
} from '../run/gate-result-utils.mjs';
import { reportHasPassDecision } from '../run/check-gates.mjs';

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

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
  if (!args.runDir) throw new Error('Usage: node scripts/qa/check-final-qa-evidence.mjs --run-dir runs/<site-id> [--write]');
  return args;
}

export async function runFinalQaEvidenceGate({ runDir }) {
  const absoluteRunDir = path.resolve(runDir);
  const failures = [];
  const requiredGateResults = [
    ['web-access-preflight.json', 'repo-local web-access preflight'],
    ['agent25-lineage.json', 'Agent 2.5 lineage'],
    ['final-visual-lock.json', 'final visual lock'],
    ['final-visual-similarity.json', 'final target-vs-page visual similarity'],
    ['rendered-assets.json', 'rendered asset renderability'],
    ['tool-spec.json', 'tool spec implementation'],
  ];

  const gateResults = {};
  for (const [filename, label] of requiredGateResults) {
    const result = await readJsonOptional(path.join(absoluteRunDir, 'gate-results', filename));
    gateResults[filename] = result;
    if (!gatePasses(result)) failures.push(`missing or failing ${label} gate result: gate-results/${filename}`);
  }

  const qaReport = await readTextOptional(path.join(absoluteRunDir, 'agent-5-output/qa-report.md'));
  if (!reportHasPassDecision(qaReport)) failures.push('agent-5-output/qa-report.md is missing Decision: PASS');

  const chatDelivery = await readTextOptional(path.join(absoluteRunDir, 'agent-5-output/chat-delivery/final-screenshot-delivery.md'));
  if (!reportHasPassDecision(chatDelivery)) {
    failures.push('final GPT target and final page screenshots have not been recorded as delivered to the chat');
  }

  const requiredScreenshots = [
    'agent-5-output/final-visual-lock/desktop.png',
    'agent-5-output/final-visual-lock/mobile.png',
    'agent-5-output/final-visual-lock/wide.png',
  ];
  for (const file of requiredScreenshots) {
    if (!(await exists(path.join(absoluteRunDir, file)))) failures.push(`missing ${file}`);
  }

  return resultFromFailures({
    gate: 'final-qa-evidence',
    runDir: absoluteRunDir,
    failures,
    details: { gateResults: Object.keys(gateResults) },
    evidence: {
      qaReport: 'agent-5-output/qa-report.md',
      chatDelivery: 'agent-5-output/chat-delivery/final-screenshot-delivery.md',
      gateResults: 'gate-results/',
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runFinalQaEvidenceGate({ runDir: args.runDir });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'final-qa-evidence.json', result);
  console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} final QA evidence`);
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
