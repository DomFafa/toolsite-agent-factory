#!/usr/bin/env node
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readTextOptional, resultFromFailures, writeGateResult } from './gate-result-utils.mjs';
import { reportHasPassDecision } from './check-gates.mjs';

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
  if (!args.runDir) throw new Error('Usage: node scripts/run/check-agent25-lineage.mjs --run-dir runs/<site-id> [--write]');
  return args;
}

function selectedOptionFromManifest(manifest) {
  return manifest.match(/selected option\s*:\s*(.+)/i)?.[1]?.trim()
    || manifest.match(/selected design\s*:\s*(.+)/i)?.[1]?.trim()
    || '';
}

export async function runAgent25LineageGate({ runDir }) {
  const absoluteRunDir = path.resolve(runDir);
  const evidenceDir = path.join(absoluteRunDir, 'agent-2-5-output/external-design-evidence');
  const selectedDir = path.join(absoluteRunDir, 'agent-2-5-output/selected-design');
  const stateText = await readTextOptional(path.join(absoluteRunDir, 'state.json'));
  const state = stateText ? JSON.parse(stateText) : {};
  const domain = state.domain || '';

  const externalResponse = await readTextOptional(path.join(evidenceDir, 'external-response.md'));
  const sourceProvenance = await readTextOptional(path.join(evidenceDir, 'source-provenance.md'));
  const selectedLineage = await readTextOptional(path.join(evidenceDir, 'selected-design-lineage.md'));
  const manifest = await readTextOptional(path.join(absoluteRunDir, 'agent-2-5-output/design-manifest.md'));
  const selectedOption = selectedOptionFromManifest(manifest);

  const failures = [];
  const requiredFiles = [
    'agent-2-5-output/external-design-evidence/external-response.md',
    'agent-2-5-output/external-design-evidence/conversation-screenshot.png',
    'agent-2-5-output/external-design-evidence/source-provenance.md',
    'agent-2-5-output/external-design-evidence/selected-design-lineage.md',
    'agent-2-5-output/design-manifest.md',
    'agent-2-5-output/selected-design/target/desktop.png',
    'agent-2-5-output/selected-design/target/mobile.png',
    'agent-2-5-output/selected-design/code/index.html',
    'agent-2-5-output/selected-design/code/style.css',
  ];

  for (const file of requiredFiles) {
    if (!(await exists(path.join(absoluteRunDir, file)))) failures.push(`missing ${file}`);
  }

  if (domain && !new RegExp(domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(externalResponse)) {
    failures.push(`external response does not mention domain ${domain}`);
  }

  if (!selectedOption) {
    failures.push('design-manifest.md does not identify the selected option');
  } else {
    const optionWords = selectedOption
      .replace(/[—–-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3);
    const mentioned = optionWords.some((word) => new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(externalResponse));
    if (!mentioned) failures.push(`external response does not appear to mention selected option "${selectedOption}"`);
  }

  if (sourceProvenance && !reportHasPassDecision(sourceProvenance)) {
    failures.push('source-provenance.md is not Decision: PASS');
  }

  if (selectedLineage && !reportHasPassDecision(selectedLineage)) {
    failures.push('selected-design-lineage.md is not Decision: PASS');
  }

  for (const screenshot of ['target/desktop.png', 'target/mobile.png']) {
    const filePath = path.join(selectedDir, screenshot);
    if (await exists(filePath)) {
      const fileStat = await stat(filePath);
      if (fileStat.size < 10_000) failures.push(`${screenshot} is too small to be a real screenshot`);
    }
  }

  return resultFromFailures({
    gate: 'agent25-lineage',
    runDir: absoluteRunDir,
    failures,
    details: { domain, selectedOption },
    evidence: {
      externalResponse: 'agent-2-5-output/external-design-evidence/external-response.md',
      selectedLineage: 'agent-2-5-output/external-design-evidence/selected-design-lineage.md',
      selectedDesktop: 'agent-2-5-output/selected-design/target/desktop.png',
      selectedMobile: 'agent-2-5-output/selected-design/target/mobile.png',
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runAgent25LineageGate({ runDir: args.runDir });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'agent25-lineage.json', result);
  console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} agent25 lineage`);
  if (result.failures.length) {
    for (const failure of result.failures) console.log(`- ${failure}`);
  }
  process.exitCode = result.passed ? 0 : 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
