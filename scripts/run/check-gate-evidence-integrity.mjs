#!/usr/bin/env node
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { gatePasses, readJsonOptional } from './gate-result-utils.mjs';

const CRITICAL_GATE_RESULTS = [
  'visual-restoration-similarity.json',
  'final-visual-lock.json',
  'final-visual-similarity.json',
  'tool-spec.json',
  'page-plan.json',
  'selected-assets.json',
  'agent25-lineage.json',
  'agent25-external-design-proof.json',
  'final-qa-evidence.json',
];

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
    }
  }
  if (!args.runDir || !args.before) {
    throw new Error('Usage: node scripts/run/check-gate-evidence-integrity.mjs --run-dir runs/<site-id> --before agent-6');
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

async function fileStat(filePath) {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}

async function readTextOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function walkFiles(root, { skipGenerated = true } = {}) {
  const files = [];
  async function walk(current) {
    let entries = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (skipGenerated && ['node_modules', 'dist', '.astro', '.npm-cache'].includes(entry.name)) continue;
        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  await walk(root);
  return files;
}

function rel(runDir, filePath) {
  return path.relative(runDir, filePath).replace(/\\/g, '/');
}

async function requireFile({ runDir, relPath, failures, label = relPath, minBytes = 1, png = false }) {
  if (!relPath || path.isAbsolute(relPath) || relPath.includes('..')) {
    failures.push(`${label}: invalid run-relative path`);
    return null;
  }
  const absolutePath = path.join(runDir, relPath);
  const currentStat = await fileStat(absolutePath);
  if (!currentStat || !currentStat.isFile()) {
    failures.push(`${label}: missing ${relPath}`);
    return null;
  }
  if (currentStat.size < minBytes) failures.push(`${label}: ${relPath} is empty or too small`);
  if (png) {
    const buffer = await readFile(absolutePath);
    if (!isPng(buffer)) failures.push(`${label}: ${relPath} is not a PNG`);
  }
  return absolutePath;
}

function isPng(buffer) {
  return (
    buffer &&
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

async function pngDimensions(filePath) {
  const buffer = await readFile(filePath);
  if (!isPng(buffer)) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function readGateResult(runDir, filename, failures) {
  const resultPath = path.join(runDir, 'gate-results', filename);
  const result = await readJsonOptional(resultPath);
  if (!gatePasses(result)) {
    failures.push(`gate-results/${filename} is missing or not passing`);
    return { result: null, resultPath };
  }
  return { result, resultPath };
}

async function assertNoNewerFiles({ runDir, gateResultPath, roots, failures, label }) {
  const gateStat = await fileStat(gateResultPath);
  if (!gateStat) {
    failures.push(`${label}: missing gate result file`);
    return;
  }
  for (const root of roots) {
    const rootPath = path.join(runDir, root);
    const files = await walkFiles(rootPath);
    for (const file of files) {
      const currentStat = await fileStat(file);
      if (currentStat && currentStat.mtimeMs > gateStat.mtimeMs + 10) {
        failures.push(`${label}: stale gate result; ${rel(runDir, file)} is newer than ${rel(runDir, gateResultPath)}`);
      }
    }
  }
}

async function siteSourceFiles(runDir) {
  const roots = [
    'site/src',
    'site/public',
  ];
  const files = [];
  for (const root of roots) files.push(...(await walkFiles(path.join(runDir, root))));
  for (const file of ['site/package.json', 'site/astro.config.mjs', 'site/tsconfig.json']) {
    const absolutePath = path.join(runDir, file);
    if (await exists(absolutePath)) files.push(absolutePath);
  }
  return files;
}

async function checkVisualRestorationSimilarity(runDir, failures) {
  const { result, resultPath } = await readGateResult(runDir, 'visual-restoration-similarity.json', failures);
  if (!result) return;
  const pairs = result.evidence?.comparedPairs || [
    { target: 'agent-2-5-output/selected-design/target/desktop.png', restored: 'agent-3-output/final-screenshots/desktop.png' },
    { target: 'agent-2-5-output/selected-design/target/mobile.png', restored: 'agent-3-output/final-screenshots/mobile.png' },
  ];
  for (const pair of pairs) {
    await requireFile({ runDir, relPath: pair.target, failures, label: 'visual-restoration target screenshot', png: true });
    await requireFile({ runDir, relPath: pair.restored, failures, label: 'visual-restoration restored screenshot', png: true });
  }
  if (result.evidence?.comparePage) {
    await requireFile({ runDir, relPath: result.evidence.comparePage, failures, label: 'visual-restoration comparison file' });
  }
  await assertNoNewerFiles({ runDir, gateResultPath: resultPath, roots: ['agent-3-output'], failures, label: 'visual-restoration-similarity' });
}

async function checkFinalVisualLock(runDir, failures) {
  const { result, resultPath } = await readGateResult(runDir, 'final-visual-lock.json', failures);
  if (!result) return;
  const screenshots = Object.values(result.evidence?.screenshots || {
    desktop: 'agent-5-output/final-visual-lock/desktop.png',
    mobile: 'agent-5-output/final-visual-lock/mobile.png',
    wide: 'agent-5-output/final-visual-lock/wide.png',
  });
  for (const screenshot of screenshots) {
    await requireFile({ runDir, relPath: screenshot, failures, label: 'final visual lock screenshot', png: true });
  }
  await assertNoNewerFiles({ runDir, gateResultPath: resultPath, roots: ['site/src', 'site/public'], failures, label: 'final-visual-lock' });
}

async function checkFinalVisualSimilarity(runDir, failures) {
  const { result, resultPath } = await readGateResult(runDir, 'final-visual-similarity.json', failures);
  if (!result) return;
  const pairs = result.evidence?.comparedPairs || [
    { target: 'agent-2-5-output/selected-design/target/desktop.png', final: 'agent-5-output/final-visual-lock/desktop.png' },
    { target: 'agent-2-5-output/selected-design/target/mobile.png', final: 'agent-5-output/final-visual-lock/mobile.png' },
  ];
  for (const pair of pairs) {
    const targetPath = await requireFile({ runDir, relPath: pair.target, failures, label: 'final visual target screenshot', png: true });
    const finalPath = await requireFile({ runDir, relPath: pair.final, failures, label: 'final page screenshot', png: true });
    if (targetPath && finalPath) {
      const target = await pngDimensions(targetPath);
      const final = await pngDimensions(finalPath);
      if (!target || !final || target.width !== final.width || target.height !== final.height) {
        failures.push(`final-visual-similarity: screenshot dimensions differ for ${pair.target} and ${pair.final}`);
      }
    }
  }
  if (result.evidence?.comparePage) {
    await requireFile({ runDir, relPath: result.evidence.comparePage, failures, label: 'final visual similarity comparison file' });
  }
  await assertNoNewerFiles({ runDir, gateResultPath: resultPath, roots: ['site/src', 'site/public'], failures, label: 'final-visual-similarity' });
}

async function checkToolSpec(runDir, failures) {
  const { resultPath } = await readGateResult(runDir, 'tool-spec.json', failures);
  const siteDir = path.join(runDir, 'site');
  if (!(await exists(siteDir))) {
    failures.push('tool-spec: site/ is missing');
    return;
  }
  const files = await siteSourceFiles(runDir);
  const source = (await Promise.all(files.map((file) => readTextOptional(file)))).join('\n').toLowerCase();
  for (const token of ['words', 'characters', 'sentences', 'paragraphs', 'reading time', 'speaking time']) {
    if (!source.includes(token)) failures.push(`tool-spec: site source missing core tool evidence "${token}"`);
  }
  await assertNoNewerFiles({ runDir, gateResultPath: resultPath, roots: ['site/src', 'site/public'], failures, label: 'tool-spec' });
}

async function routeExists(runDir, route) {
  const sourceCandidates = {
    '/': ['site/src/pages/index.astro', 'site/src/pages/index.md', 'site/dist/index.html'],
    '/privacy': ['site/src/pages/privacy.astro', 'site/src/pages/privacy.md', 'site/dist/privacy/index.html'],
    '/terms': ['site/src/pages/terms.astro', 'site/src/pages/terms.md', 'site/dist/terms/index.html'],
    '/sitemap.xml': ['site/src/pages/sitemap.xml.ts', 'site/src/pages/sitemap.xml.js', 'site/public/sitemap.xml', 'site/dist/sitemap.xml'],
    '/robots.txt': ['site/src/pages/robots.txt.ts', 'site/src/pages/robots.txt.js', 'site/public/robots.txt', 'site/dist/robots.txt'],
  }[route] || [];
  for (const candidate of sourceCandidates) {
    if (await exists(path.join(runDir, candidate))) return true;
  }
  return false;
}

async function checkPagePlan(runDir, failures) {
  const { resultPath } = await readGateResult(runDir, 'page-plan.json', failures);
  for (const route of ['/', '/privacy', '/terms', '/sitemap.xml', '/robots.txt']) {
    if (!(await routeExists(runDir, route))) failures.push(`page-plan: required route is missing real implementation: ${route}`);
  }
  await assertNoNewerFiles({ runDir, gateResultPath: resultPath, roots: ['site/src', 'site/public'], failures, label: 'page-plan' });
}

function latestResolvedOption(eventsText) {
  const events = eventsText
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return events
    .filter((event) => event.type === 'human_review' && event.id === 'agent25-option-selection' && event.status === 'resolved')
    .at(-1);
}

async function checkSelectedDesignEvidence(runDir, failures) {
  const gateFiles = ['selected-assets.json', 'agent25-lineage.json', 'agent25-external-design-proof.json'];
  const gatePaths = [];
  for (const gateFile of gateFiles) {
    const { resultPath } = await readGateResult(runDir, gateFile, failures);
    gatePaths.push({ gateFile, resultPath });
  }
  await requireFile({
    runDir,
    relPath: 'agent-2-5-output/chat-delivery/options-board.png',
    failures,
    label: 'Agent2.5 options board',
    minBytes: 1,
    png: true,
  });
  const eventPath = path.join(runDir, 'human-review-events.jsonl');
  const eventsText = await readTextOptional(eventPath);
  const resolved = latestResolvedOption(eventsText);
  if (!resolved) {
    failures.push('selected design evidence: missing resolved agent25-option-selection event');
    return;
  }
  const selectedOption = String(resolved.selected_option || resolved.selectedOption || resolved.selected_design || resolved.resolution_text || '').trim();
  if (!selectedOption) failures.push('selected design evidence: resolved option event has no selected_option');
  await requireFile({
    runDir,
    relPath: 'agent-3-output/implementation-handoff.md',
    failures,
    label: 'Agent3 implementation handoff',
  });
  if (!(await exists(path.join(runDir, 'agent-3-output')))) failures.push('selected design evidence: agent-3-output/ is missing');

  const downstreamFiles = await walkFiles(path.join(runDir, 'agent-3-output'));
  downstreamFiles.push(...(await walkFiles(path.join(runDir, 'agent-4-output'))));
  const downstreamText = (await Promise.all(downstreamFiles.map((file) => readTextOptional(file)))).join('\n');
  if (/^a$/i.test(selectedOption) || /option\s*a/i.test(selectedOption)) {
    if (!/(Option\s+A|selected_option\s*=\s*A|selected_design\s*=\s*Option\s+A|Selected option:\s*Option\s+A)/i.test(downstreamText)) {
      failures.push('selected design evidence: downstream Agent3/Agent4 docs do not preserve Option A selection');
    }
  }

  const eventStat = await fileStat(eventPath);
  for (const { gateFile, resultPath } of gatePaths.filter((item) => ['selected-assets.json', 'agent25-lineage.json'].includes(item.gateFile))) {
    const resultStat = await fileStat(resultPath);
    if (eventStat && resultStat && eventStat.mtimeMs > resultStat.mtimeMs + 10) {
      failures.push(`${gateFile}: stale gate result; human-review-events.jsonl is newer than ${rel(runDir, resultPath)}`);
    }
  }
}

async function checkFinalQaEvidence(runDir, failures) {
  const { resultPath } = await readGateResult(runDir, 'final-qa-evidence.json', failures);
  await requireFile({ runDir, relPath: 'agent-5-output/final-qa-report.md', failures, label: 'final QA report' });
  await requireFile({ runDir, relPath: 'agent-5-output/launch-readiness.md', failures, label: 'launch readiness report' });
  await assertNoNewerFiles({ runDir, gateResultPath: resultPath, roots: ['site/src', 'site/public'], failures, label: 'final-qa-evidence' });
}

export async function runGateEvidenceIntegrityCheck({ runDir, before }) {
  const absoluteRunDir = path.resolve(runDir);
  const normalizedBefore = String(before || '').trim().toLowerCase();
  const failures = [];

  if (!['agent-6', 'agent6'].includes(normalizedBefore)) {
    return { passed: true, status: 'pass', failures: [], runDir: absoluteRunDir, before };
  }

  for (const filename of CRITICAL_GATE_RESULTS) {
    const result = await readJsonOptional(path.join(absoluteRunDir, 'gate-results', filename));
    if (!gatePasses(result)) failures.push(`gate-results/${filename} is missing or not passing`);
  }

  await checkVisualRestorationSimilarity(absoluteRunDir, failures);
  await checkFinalVisualLock(absoluteRunDir, failures);
  await checkFinalVisualSimilarity(absoluteRunDir, failures);
  await checkToolSpec(absoluteRunDir, failures);
  await checkPagePlan(absoluteRunDir, failures);
  await checkSelectedDesignEvidence(absoluteRunDir, failures);
  await checkFinalQaEvidence(absoluteRunDir, failures);

  return {
    passed: failures.length === 0,
    status: failures.length === 0 ? 'pass' : 'fail',
    failures: [...new Set(failures)],
    runDir: absoluteRunDir,
    before,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runGateEvidenceIntegrityCheck({ runDir: args.runDir, before: args.before });
  if (result.passed) {
    console.log('PASS: gate evidence integrity passed.');
  } else {
    for (const failure of result.failures) console.log(`FAIL: ${failure}`);
  }
  process.exitCode = result.passed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 2;
  });
}
