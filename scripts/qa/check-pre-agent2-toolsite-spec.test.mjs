import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkRunGates } from '../run/check-gates.mjs';
import { PRE_AGENT2_BLOCK_MESSAGE, runPreAgent2ToolsiteSpecGate } from './check-pre-agent2-toolsite-spec.mjs';

async function makeRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'pre-agent2-spec-'));
  const runDir = path.join(root, 'runs', 'sample-site');
  await mkdir(runDir, { recursive: true });
  return runDir;
}

function spec({
  rounds = 12,
  complex = false,
  early = false,
  uiReference = 'open exploration / follow tool-site best practices',
  uxReference = 'open exploration / follow tool-site best practices',
  confirmed = true,
  omit = '',
} = {}) {
  const fiveElements = [
    '# Toolsite SPEC',
    '',
    '## User-Provided Five Elements',
    '',
    '- Keyword / 关键词: typing test online',
    '- Target Domain / 目标域名: typingtestonline.example',
    omit === 'ui-reference' ? '- UI Reference / UI 参考:' : `- UI Reference / UI 参考: ${uiReference}`,
    `- UX Reference / UX 参考: ${uxReference}`,
    '- Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点: mimic focused typing practice, avoid dashboards',
    '',
    '## Lightweight Q&A Record',
    '',
    `- Question rounds: ${rounds}`,
    `- Complex tool: ${complex ? 'yes' : 'no'}`,
    `- Early SPEC reason: ${early ? '六个用户决策区已清楚，用户同意提前输出 SPEC。' : ''}`,
    '',
  ].join('\n');

  const sections = [
    ['Tool Purpose', 'Let users measure typing speed and accuracy in a focused browser tool.'],
    ['First Viewport UX', 'The first viewport must show the typing prompt, input area, and live stats.'],
    ['Input / Output Model', 'Input is typed text. Output is WPM, accuracy, mistakes, and completion state.'],
    ['Result Experience', 'After completion, show clear performance metrics and retry action.'],
    ['UI / UX Direction', 'Use a calm practice surface with readable text and strong focus states.'],
    ['Non-goals', 'No login, leaderboard, account, dashboard, API, or blog.'],
    ['Technical Constraints', 'Static frontend only. No backend, database, login, or API keys.'],
    ['Page Boundary', 'Required pages are /, /privacy, /terms, /sitemap.xml, and /robots.txt.'],
    ['Agent Workflow Boundary', 'Agent 2 starts only after this SPEC gate passes.'],
    ['SEO Baseline', 'Primary keyword drives title, description, H1, and page intent.'],
    ['Success Criteria Baseline', 'The real tool is visible first and behavior matches this SPEC.'],
  ]
    .filter(([heading]) => heading !== omit)
    .map(([heading, body]) => `## ${heading}\n\n${body}\n`)
    .join('\n');

  return [
    fiveElements,
    sections,
    '## User Confirmation',
    '',
    `- [${confirmed ? 'x' : ' '}] User confirmed this Toolsite SPEC before Agent2 starts.`,
    '- Confirmation text: Confirmed, proceed to Agent2.',
    '- Confirmed by: dom',
    '- Confirmed at: 2026-05-11T10:00:00+08:00',
    '',
  ].join('\n');
}

async function writeSpec(runDir, text = spec()) {
  await writeFile(path.join(runDir, 'toolsite-spec.md'), text);
}

test('passes a confirmed SPEC with all required fields and 12 question rounds', async () => {
  const runDir = await makeRun();
  await writeSpec(runDir);

  const result = await runPreAgent2ToolsiteSpecGate({ runDir });
  assert.equal(result.passed, true);
  assert.equal(result.details.questionRounds, 12);
});

test('accepts UI and UX references that explicitly choose open exploration instead of URLs', async () => {
  const runDir = await makeRun();
  await writeSpec(
    runDir,
    spec({
      uiReference: '无明确参考 / open exploration / 按工具站最佳实践',
      uxReference: '无明确参考 / open exploration / 按工具站最佳实践',
    }),
  );

  const result = await runPreAgent2ToolsiteSpecGate({ runDir });
  assert.equal(result.passed, true);
});

test('passes fewer than 12 question rounds only with early SPEC consent sentence', async () => {
  const runDir = await makeRun();
  await writeSpec(runDir, spec({ rounds: 8, early: true }));

  const result = await runPreAgent2ToolsiteSpecGate({ runDir });
  assert.equal(result.passed, true);
  assert.equal(result.details.earlySpecConsent, true);
});

test('fails fewer than 12 question rounds without early SPEC consent sentence', async () => {
  const runDir = await makeRun();
  await writeSpec(runDir, spec({ rounds: 8, early: false }));

  const result = await runPreAgent2ToolsiteSpecGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /fewer than 12 question rounds/);
});

test('allows 21-30 rounds only for complex tools', async () => {
  const simpleRun = await makeRun();
  await writeSpec(simpleRun, spec({ rounds: 24, complex: false }));
  const simpleResult = await runPreAgent2ToolsiteSpecGate({ runDir: simpleRun });
  assert.equal(simpleResult.passed, false);
  assert.match(simpleResult.failures.join('\n'), /more than 20 question rounds/);

  const complexRun = await makeRun();
  await writeSpec(complexRun, spec({ rounds: 24, complex: true }));
  const complexResult = await runPreAgent2ToolsiteSpecGate({ runDir: complexRun });
  assert.equal(complexResult.passed, true);
});

test('fails when a five-element field is missing', async () => {
  const runDir = await makeRun();
  await writeSpec(runDir, spec({ omit: 'ui-reference' }));

  const result = await runPreAgent2ToolsiteSpecGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /UI Reference/);
});

test('fails when a user decision section is missing', async () => {
  const runDir = await makeRun();
  await writeSpec(runDir, spec({ omit: 'Result Experience' }));

  const result = await runPreAgent2ToolsiteSpecGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /Result Experience/);
});

test('fails when user confirmation is not checked', async () => {
  const runDir = await makeRun();
  await writeSpec(runDir, spec({ confirmed: false }));

  const result = await runPreAgent2ToolsiteSpecGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /checkbox must be checked/);
});

test('CLI writes gate result and emits fixed block message on failure', async () => {
  const runDir = await makeRun();
  const result = spawnSync(
    process.execPath,
    ['scripts/qa/check-pre-agent2-toolsite-spec.mjs', '--run-dir', runDir, '--write'],
    {
      cwd: path.resolve('.'),
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 1);
  assert.match(result.stdout, new RegExp(PRE_AGENT2_BLOCK_MESSAGE));
  const written = JSON.parse(await readFile(path.join(runDir, 'gate-results/pre-agent2-toolsite-spec.json'), 'utf8'));
  assert.equal(written.gate, 'pre-agent2-toolsite-spec');
  assert.equal(written.passed, false);
});

test('check-gates blocks --before agent-2 when Pre-Agent2 gate result is missing', async () => {
  const runDir = await makeRun();

  const result = await checkRunGates({ runDir, before: 'agent-2' });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.missing, [PRE_AGENT2_BLOCK_MESSAGE]);
  assert.equal(result.allowedNextStep, 'Complete Pre-Agent2 Toolsite SPEC Gate');
});

test('check-gates allows --before agent-2 when Pre-Agent2 gate result passed', async () => {
  const runDir = await makeRun();
  await mkdir(path.join(runDir, 'gate-results'), { recursive: true });
  await writeFile(
    path.join(runDir, 'gate-results/pre-agent2-toolsite-spec.json'),
    JSON.stringify(
      {
        gate: 'pre-agent2-toolsite-spec',
        runDir,
        status: 'pass',
        passed: true,
        failures: [],
        details: {},
        evidence: {},
        generatedAt: '2026-05-11T00:00:00.000Z',
      },
      null,
      2,
    ),
  );

  const result = await checkRunGates({ runDir, before: 'agent-2' });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.missing, []);
});
