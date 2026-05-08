#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { checkRunGates } from './check-gates.mjs';

function parseArgs(argv) {
  const args = { before: 'agent-6' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    } else if (arg === '--before') {
      args.before = argv[index + 1];
      index += 1;
    }
  }
  if (!args.runDir) throw new Error('Usage: node scripts/run/generate-ledger.mjs --run-dir runs/<site-id> [--before agent-6]');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDir = path.resolve(args.runDir);
  const result = await checkRunGates({ runDir, before: args.before });
  const lines = [
    `# Gate Ledger - ${path.basename(runDir)}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'This file is generated from mechanical gate checks. Do not hand-edit `[passed]` entries.',
    '',
    `Before: ${args.before}`,
    `Allowed: ${result.allowed ? 'yes' : 'no'}`,
    `Allowed next step: ${result.allowedNextStep}`,
    '',
    '## Failures',
  ];
  if (result.missing.length === 0) {
    lines.push('', '- none');
  } else {
    lines.push('', ...result.missing.map((item) => `- ${item}`));
  }
  lines.push('', '## Raw Result', '', '```json', JSON.stringify(result, null, 2), '```', '');
  await writeFile(path.join(runDir, 'gate-ledger.md'), lines.join('\n'));
  console.log(`Generated ${path.join(args.runDir, 'gate-ledger.md')}`);
  process.exitCode = result.allowed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
