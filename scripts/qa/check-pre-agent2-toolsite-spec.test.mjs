import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkRunGates } from '../run/check-gates.mjs';
import {
  PRE_AGENT2_BLOCK_MESSAGE,
  SPEC_GENERIC_BLOCK_MESSAGE,
  runPreAgent2ToolsiteSpecGate,
} from './check-pre-agent2-toolsite-spec.mjs';

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
  keyword = 'typing test online',
  targetDomain = 'typingtestonline.example',
  uiReference = 'open exploration / follow tool-site best practices',
  uxReference = 'open exploration / follow tool-site best practices',
  extraIdeas = 'mimic focused typing practice, avoid dashboards',
  confirmed = true,
  omit = '',
} = {}) {
  const fiveElements = [
    '# Toolsite SPEC',
    '',
    '## User-Provided Five Elements',
    '',
    omit === 'keyword' ? '- Keyword / 关键词:' : `- Keyword / 关键词: ${keyword}`,
    `- Target Domain / 目标域名: ${targetDomain}`,
    omit === 'ui-reference' ? '- UI Reference / UI 参考:' : `- UI Reference / UI 参考: ${uiReference}`,
    omit === 'ux-reference' ? '- UX Reference / UX 参考:' : `- UX Reference / UX 参考: ${uxReference}`,
    `- Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点: ${extraIdeas}`,
    '',
    '## Lightweight Q&A Record',
    '',
    `- Question rounds: ${rounds}`,
    `- Complex tool: ${complex ? 'yes' : 'no'}`,
    `- Early SPEC reason: ${early ? '六个用户决策区已清楚，用户同意提前输出 SPEC。' : ''}`,
    '',
  ].join('\n');

  const sections = [
    ['Tool Purpose', `Let users measure typing speed and accuracy for ${keyword} on ${targetDomain}, while preserving ${extraIdeas}.`],
    ['First Viewport UX', `The first viewport for ${keyword} must show the typing prompt, input area, and live stats before any SEO content.`],
    ['Input / Output Model', `Input is typed text for ${keyword}. Output is WPM, accuracy, mistakes, and completion state.`],
    ['Result Experience', `After completing the ${keyword} task, show clear performance metrics and retry action.`],
    ['UI / UX Direction', `UI reference: ${uiReference}. UX reference: ${uxReference}. Use a calm practice surface with readable text and strong focus states.`],
    ['Non-goals', `No login, leaderboard, account, dashboard, API, or blog for ${keyword}; keep ${extraIdeas}.`],
    ['Technical Constraints', `Static frontend only for ${keyword}. No backend, database, login, or API keys.`],
    ['Page Boundary', `Required pages for ${targetDomain} are /, /privacy, /terms, /sitemap.xml, and /robots.txt.`],
    ['Agent Workflow Boundary', `Agent 2 starts only after this ${keyword} SPEC gate passes.`],
    ['SEO Baseline', `${keyword} must drive title, description, H1, and page intent for ${targetDomain}.`],
    ['Success Criteria Baseline', `The real ${keyword} tool is visible first and behavior matches this SPEC.`],
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

function genericWordCounterSpec({
  confirmed = true,
  uiReference = 'Stripe 风格',
  uxReference = 'wordcounter.net',
} = {}) {
  return [
    '# Toolsite SPEC',
    '',
    '## User-Provided Five Elements',
    '',
    '- Keyword / 关键词: word counter',
    '- Target Domain / 目标域名: wordcounter-test.local',
    `- UI Reference / UI 参考: ${uiReference}`,
    `- UX Reference / UX 参考: ${uxReference}`,
    '- Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点: 第一屏必须是工具，不要登录，不要复杂功能',
    '',
    '## Lightweight Q&A Record',
    '',
    '- Question rounds: 12',
    '- Complex tool: no',
    '- Early SPEC reason:',
    '',
    '## Tool Purpose',
    '',
    '快速完成明确计算、转换或检查任务。',
    '',
    '## First Viewport UX',
    '',
    '核心数字或结果最醒目，用户打开页面后完成任务。',
    '',
    '## Input / Output Model',
    '',
    '用户输入内容后得到结果。',
    '',
    '## Result Experience',
    '',
    '结果清晰、快速、可信。',
    '',
    '## UI / UX Direction',
    '',
    '使用仓库标准约束，保持简洁工具站体验。',
    '',
    '## Non-goals',
    '',
    '不做复杂功能。',
    '',
    '## Technical Constraints',
    '',
    'Use the repository standard static frontend tool constraints unless a later approved brief changes them.',
    '',
    '## Page Boundary',
    '',
    'Build one focused tool page.',
    '',
    '## Agent Workflow Boundary',
    '',
    'Agent 2 starts only after this SPEC gate passes.',
    '',
    '## SEO Baseline',
    '',
    'Primary keyword drives title, description, H1, and page intent.',
    '',
    '## Success Criteria Baseline',
    '',
    '用户打开页面后完成任务。',
    '',
    '## User Confirmation',
    '',
    `- [${confirmed ? 'x' : ' '}] User confirmed this Toolsite SPEC before Agent2 starts.`,
    '- Confirmation text: Confirmed, proceed to Agent2.',
    '- Confirmed by: dom',
    '- Confirmed at: 2026-05-11T10:00:00+08:00',
    '',
  ].join('\n');
}

function wordCounterSpec({ omitTerm = '' } = {}) {
  const metrics = ['words', 'characters', 'sentences', 'paragraphs', 'reading time', 'speaking time']
    .filter((term) => term !== omitTerm)
    .join('、');
  const nonGoals = [
    '登录',
    '账户',
    '数据库',
    'AI rewrite',
    '拼写检查',
    '语法检查',
    '历史记录',
  ]
    .filter((term) => term !== omitTerm)
    .join('、');
  return [
    '# Toolsite SPEC',
    '',
    '## User-Provided Five Elements',
    '',
    '- Keyword / 关键词: word counter',
    '- Target Domain / 目标域名: wordcounter-test.local',
    '- UI Reference / UI 参考: Stripe 风格',
    '- UX Reference / UX 参考: wordcounter.net',
    '- Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点: 第一屏必须是工具，不要登录，不要复杂功能',
    '',
    '## Lightweight Q&A Record',
    '',
    '- Question rounds: 12',
    '- Complex tool: no',
    '- Early SPEC reason:',
    '',
    '## Tool Purpose',
    '',
    '这是一个浏览器本地运行的 word counter。用户粘贴或输入纯文本后，实时统计文本结果。',
    '',
    '## First Viewport UX',
    '',
    '第一屏必须是 Stripe 风格的干净工具区：上方简短标题和说明，中间大文本输入框，下方或右侧显示核心统计卡片。保留用户限制：第一屏必须是工具，不要登录，不要复杂功能。',
    '',
    '## Input / Output Model',
    '',
    '输入是纯文本，输出是实时统计结果，不需要点击提交按钮即可更新。文本必须在浏览器本地处理。',
    '',
    '## Result Experience',
    '',
    `第一屏默认展示 ${metrics}。`,
    '',
    '## UI / UX Direction',
    '',
    'UI 参考 Stripe 风格的干净、专业、留白和卡片感。UX 参考 wordcounter.net 的即时统计体验，但不要照搬布局。',
    '',
    '## Non-goals',
    '',
    `不做${nonGoals}。keyword density 不放在第一屏核心功能里。`,
    '',
    '## Privacy',
    '',
    '文本在浏览器本地处理，不上传服务器，不保存用户输入。',
    '',
    '## Technical Constraints',
    '',
    'Static frontend only. No backend, database, login, account, API keys, or server-side text processing.',
    '',
    '## Page Boundary',
    '',
    'Required pages are /, /privacy, /terms, /sitemap.xml, and /robots.txt. The / page is the word counter tool page.',
    '',
    '## Agent Workflow Boundary',
    '',
    'Agent 2 starts only after this word counter SPEC gate passes.',
    '',
    '## SEO Baseline',
    '',
    'word counter drives title, description, H1, and page intent for wordcounter-test.local.',
    '',
    '## Success Criteria Baseline',
    '',
    '用户打开页面后 3 秒内知道怎么用，粘贴文本后立即看到核心指标，移动端可用，长文本不溢出。',
    '',
    '## User Confirmation',
    '',
    '- [x] User confirmed this Toolsite SPEC before Agent2 starts.',
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

test('fails when keyword is missing', async () => {
  const runDir = await makeRun();
  await writeSpec(runDir, spec({ omit: 'keyword' }));

  const result = await runPreAgent2ToolsiteSpecGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /Keyword/);
});

test('fails when UX reference is missing', async () => {
  const runDir = await makeRun();
  await writeSpec(runDir, spec({ omit: 'ux-reference' }));

  const result = await runPreAgent2ToolsiteSpecGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /UX Reference/);
});

test('blocks a generic word counter SPEC', async () => {
  const runDir = await makeRun();
  await writeSpec(runDir, genericWordCounterSpec());

  const result = await runPreAgent2ToolsiteSpecGate({ runDir });
  assert.equal(result.passed, false);
  assert.equal(result.details.specificityPassed, false);
  assert.match(result.failures.join('\n'), /specificity:/);
});

test('blocks a word counter SPEC missing core metrics', async () => {
  const runDir = await makeRun();
  await writeSpec(runDir, wordCounterSpec({ omitTerm: 'speaking time' }));

  const result = await runPreAgent2ToolsiteSpecGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /word counter SPEC is missing speaking time/);
});

test('passes a specific word counter SPEC', async () => {
  const runDir = await makeRun();
  await writeSpec(runDir, wordCounterSpec());

  const result = await runPreAgent2ToolsiteSpecGate({ runDir });
  assert.equal(result.passed, true);
  assert.equal(result.details.specificityPassed, true);
});

test('blocks when SPEC drops a key Pre-Agent2 Q&A decision', async () => {
  const runDir = await makeRun();
  await writeSpec(runDir);
  await writeFile(
    path.join(runDir, 'pre-agent2-qa.md'),
    [
      '# Pre-Agent2 Q&A Record',
      '',
      '### Q1. Tool Purpose',
      '',
      'Decision: The tool must show a distraction-free timed typing drill with typo highlighting.',
      '',
    ].join('\n'),
  );

  const result = await runPreAgent2ToolsiteSpecGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /does not preserve Pre-Agent2 Q&A decision/);
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

test('CLI emits generic block message when SPEC is too generic', async () => {
  const runDir = await makeRun();
  await writeSpec(runDir, genericWordCounterSpec());
  const result = spawnSync(
    process.execPath,
    ['scripts/qa/check-pre-agent2-toolsite-spec.mjs', '--run-dir', runDir, '--write'],
    {
      cwd: path.resolve('.'),
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 1);
  assert.match(result.stdout, new RegExp(SPEC_GENERIC_BLOCK_MESSAGE));
  const written = JSON.parse(await readFile(path.join(runDir, 'gate-results/pre-agent2-toolsite-spec.json'), 'utf8'));
  assert.equal(written.passed, false);
  assert.equal(written.details.specificityPassed, false);
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
