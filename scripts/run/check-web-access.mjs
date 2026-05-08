#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { resultFromFailures, writeGateResult } from './gate-result-utils.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');

function parseArgs(argv) {
  const args = { write: false, root: REPO_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') {
      args.write = true;
    } else if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    } else if (arg === '--root') {
      args.root = argv[index + 1];
      index += 1;
    }
  }
  if (args.write && !args.runDir) {
    throw new Error('Usage: node scripts/run/check-web-access.mjs [--root <repo-root>] [--run-dir runs/<site-id> --write]');
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

async function readOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

export async function runWebAccessPreflight({ root = REPO_ROOT, runDir = null } = {}) {
  const absoluteRoot = path.resolve(root);
  const webAccessRoot = path.join(absoluteRoot, 'web-access');
  const requiredFiles = [
    'SKILL.md',
    'README.md',
    'scripts/check-deps.sh',
    'scripts/cdp-proxy.mjs',
    'scripts/match-site.sh',
    'references/cdp-api.md',
  ];
  const failures = [];

  for (const file of requiredFiles) {
    if (!(await exists(path.join(webAccessRoot, file)))) failures.push(`missing web-access/${file}`);
  }

  const docsToScan = [
    'SKILL.md',
    'README.md',
    'references/cdp-api.md',
  ];
  const forbiddenPathPattern = /~\/\.claude\/skills\/web-access|\/\.claude\/skills\/web-access/g;
  const requiredRepoPathPattern = /(?:^|\s)(?:bash|node)\s+web-access\/scripts\/(?:check-deps\.sh|cdp-proxy\.mjs)|web-access\/scripts\/check-deps\.sh|web-access\/scripts\/cdp-proxy\.mjs/;
  const pathScan = {};

  for (const file of docsToScan) {
    const text = await readOptional(path.join(webAccessRoot, file));
    const forbiddenMatches = text.match(forbiddenPathPattern) || [];
    pathScan[file] = {
      hasRepoRelativePath: requiredRepoPathPattern.test(text),
      forbiddenPathMatches: forbiddenMatches.length,
    };
    if (forbiddenMatches.length > 0) {
      failures.push(`web-access/${file} still references ~/.claude/skills/web-access`);
    }
  }

  const skill = await readOptional(path.join(webAccessRoot, 'SKILL.md'));
  if (skill && !/^name:\s*web-access\b/m.test(skill)) failures.push('web-access/SKILL.md missing name: web-access frontmatter');
  if (skill && !/scripts\/check-deps\.sh/.test(skill)) failures.push('web-access/SKILL.md missing check-deps.sh instructions');
  if (skill && !/scripts\/cdp-proxy\.mjs/.test(skill)) failures.push('web-access/SKILL.md missing cdp-proxy.mjs instructions');

  const checkDeps = await readOptional(path.join(webAccessRoot, 'scripts/check-deps.sh'));
  if (checkDeps && !/SCRIPT_DIR=/.test(checkDeps)) {
    failures.push('web-access/scripts/check-deps.sh must resolve paths relative to its own directory');
  }
  if (checkDeps && !/cdp-proxy\.mjs/.test(checkDeps)) {
    failures.push('web-access/scripts/check-deps.sh must start cdp-proxy.mjs');
  }

  return resultFromFailures({
    gate: 'web-access-preflight',
    runDir: runDir ? path.resolve(runDir) : absoluteRoot,
    failures,
    details: {
      webAccessRoot: path.relative(absoluteRoot, webAccessRoot),
      requiredFiles,
      pathScan,
    },
    evidence: {
      skill: 'web-access/SKILL.md',
      checkDeps: 'web-access/scripts/check-deps.sh',
      cdpProxy: 'web-access/scripts/cdp-proxy.mjs',
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runWebAccessPreflight({ root: args.root, runDir: args.runDir });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'web-access-preflight.json', result);
  console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} web-access preflight`);
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
