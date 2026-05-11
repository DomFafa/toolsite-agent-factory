import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  renderComplianceSummary,
  runAgent2BriefComplianceCheck,
} from './check-agent2-brief-compliance.mjs';

async function makeRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'agent2-compliance-'));
  const runDir = path.join(root, 'runs', 'sample-site');
  await mkdir(path.join(runDir, 'agent-2-output'), { recursive: true });
  await mkdir(path.join(runDir, 'gate-results'), { recursive: true });
  await writeFile(
    path.join(runDir, 'toolsite-spec.md'),
    [
      '# Toolsite SPEC: sample-site',
      '',
      '## Required Inputs',
      '',
      '- Keyword: sample counter',
      '- Target Domain: sample.com',
      '- UI Reference: Stripe style',
      '- UX Reference: wordcounter.net',
      '- Extra Ideas / Constraints / Mimic Points: First viewport must be the tool; no login or history.',
      '',
      '## UI / UX Direction',
      '',
      '- Use Stripe style clarity and wordcounter.net directness.',
      '',
      '## Non-goals',
      '',
      '- No login, account, dashboard, pricing, API, upload, history, or AI rewrite.',
    ].join('\n'),
  );
  await writeAgent2Outputs(runDir);
  await writeGateResult(runDir, 'page-plan.json', { passed: true });
  return { root, runDir };
}

async function writeGateResult(runDir, filename, { passed = true, status = passed ? 'pass' : 'fail' } = {}) {
  await mkdir(path.join(runDir, 'gate-results'), { recursive: true });
  await writeFile(
    path.join(runDir, 'gate-results', filename),
    `${JSON.stringify(
      {
        gate: filename.replace(/\.json$/, ''),
        runDir,
        status,
        passed,
        failures: passed ? [] : [`${filename} failed`],
        details: {},
        evidence: {},
        generatedAt: '2026-05-11T00:00:00.000Z',
      },
      null,
      2,
    )}\n`,
  );
}

function basePagePlan(extraRows = []) {
  return [
    '| page | type | status | reason | implementation owner |',
    '| --- | --- | --- | --- | --- |',
    '| / | tool | required | Primary sample counter route. | Agent3 |',
    '| /privacy | legal | required | Required privacy page. | Agent3 |',
    '| /terms | legal | required | Required terms page. | Agent3 |',
    '| /sitemap.xml | system | required | Required sitemap. | Agent3 |',
    '| /robots.txt | system | required | Required robots policy. | Agent3 |',
    '| /faq | support | optional-recommended | Helps answer sample counter questions. | Agent3 |',
    '| /login | account | rejected | Login is excluded by the confirmed SPEC. | Agent3 |',
    '| /dashboard | account | rejected | Dashboard is excluded by the confirmed SPEC. | Agent3 |',
    ...extraRows,
  ].join('\n');
}

async function writeAgent2Outputs(runDir, overrides = {}) {
  const dir = path.join(runDir, 'agent-2-output');
  await mkdir(dir, { recursive: true });
  const common = [
    'sample counter',
    'sample.com',
    'Stripe style',
    'wordcounter.net',
    'No login, account, dashboard, pricing, API, upload, history, or AI rewrite.',
  ].join('\n');
  const files = {
    'site-brief.md': `# Site Brief\n\n${common}\n`,
    'tool-spec.md': `# Tool Spec\n\n${common}\n`,
    'content-plan.md': `# Content Plan\n\n${common}\n\n## Page Plan\n\n${basePagePlan(overrides.extraPageRows || [])}\n`,
    'seo-plan.md': `# SEO Plan\n\n${common}\n`,
    'ui-reference-dossier.md': `# UI Reference Dossier\n\n${common}\n`,
    'design-generation-input.md': `# Design Input\n\n${common}\n`,
    ...overrides.files,
  };
  for (const [file, text] of Object.entries(files)) {
    await writeFile(path.join(dir, file), text);
  }
}

test('passes aligned Agent2 outputs and writes JSON plus summary through CLI --write', async () => {
  const { runDir } = await makeRun();

  const result = await runAgent2BriefComplianceCheck({ runDir });
  assert.equal(result.passed, true);
  assert.equal(result.status, 'pass');
  assert.equal(result.spec_aligned, true);
  assert.equal(result.unapproved_features_found, false);
  assert.equal(result.unapproved_pages_found, false);
  assert.equal(result.ui_ux_direction_preserved, true);
  assert.equal(result.page_plan_passed, true);
  assert.equal(result.can_proceed_to_agent25, true);
  assert.deepEqual(result.deviations, []);

  const cli = spawnSync(
    process.execPath,
    ['scripts/run/check-agent2-brief-compliance.mjs', '--run-dir', runDir, '--write'],
    { encoding: 'utf8' },
  );
  assert.equal(cli.status, 0, cli.stderr);

  const written = JSON.parse(await readFile(path.join(runDir, 'gate-results/agent2-brief-compliance.json'), 'utf8'));
  const summary = await readFile(path.join(runDir, 'agent-2-output/brief-compliance-summary.md'), 'utf8');
  assert.equal(written.passed, true);
  assert.match(summary, /Agent2 Brief Compliance Summary/);
  assert.match(summary, /是否可以进入 Agent2\.5：是/);
});

test('fails when required Agent2 outputs are missing', async () => {
  const { runDir } = await makeRun();
  await rm(path.join(runDir, 'agent-2-output/tool-spec.md'));

  const result = await runAgent2BriefComplianceCheck({ runDir });

  assert.equal(result.passed, false);
  assert.equal(result.status, 'fail');
  assert.match(result.deviations.join('\n'), /missing Agent2 output: agent-2-output\/tool-spec\.md/);
});

test('fails when Page Plan Gate is missing or failing', async () => {
  const { runDir } = await makeRun();
  await writeGateResult(runDir, 'page-plan.json', { passed: false });

  const result = await runAgent2BriefComplianceCheck({ runDir });

  assert.equal(result.passed, false);
  assert.equal(result.page_plan_passed, false);
  assert.match(result.deviations.join('\n'), /Page Plan Gate/);
});

test('fails on unapproved feature additions', async () => {
  const { runDir } = await makeRun();
  await writeFile(
    path.join(runDir, 'agent-2-output/site-brief.md'),
    [
      '# Site Brief',
      '',
      'sample counter',
      'sample.com',
      'Stripe style',
      'wordcounter.net',
      'The product adds a dashboard where users can save history.',
    ].join('\n'),
  );

  const result = await runAgent2BriefComplianceCheck({ runDir });

  assert.equal(result.passed, false);
  assert.equal(result.unapproved_features_found, true);
  assert.match(result.deviations.join('\n'), /dashboard/);
});

test('fails on unapproved approved pages', async () => {
  const { runDir } = await makeRun();
  await writeAgent2Outputs(runDir, {
    extraPageRows: ['| /dashboard | account | required | Needed for saved results. | Agent3 |'],
  });

  const result = await runAgent2BriefComplianceCheck({ runDir });

  assert.equal(result.passed, false);
  assert.equal(result.unapproved_pages_found, true);
  assert.match(result.deviations.join('\n'), /unapproved page.*dashboard/);
});

test('is uncertain when UI or UX direction cannot be confirmed', async () => {
  const { runDir } = await makeRun();
  await writeFile(
    path.join(runDir, 'toolsite-spec.md'),
    [
      '# Toolsite SPEC: sample-site',
      '',
      '## Required Inputs',
      '',
      '- Keyword: sample counter',
      '- Target Domain: sample.com',
      '- UI Reference: Neon glass dashboard',
      '- UX Reference: workflowbench.example',
      '- Extra Ideas / Constraints / Mimic Points: First viewport must be the tool.',
    ].join('\n'),
  );

  const result = await runAgent2BriefComplianceCheck({ runDir });

  assert.equal(result.passed, false);
  assert.equal(result.status, 'uncertain');
  assert.equal(result.can_proceed_to_agent25, false);
  assert.match(result.deviations.join('\n'), /UI reference|UX reference/);
});

test('summary uses short checklist format for exception review messages', () => {
  const summary = renderComplianceSummary({
    status: 'fail',
    spec_aligned: false,
    unapproved_features_found: true,
    unapproved_pages_found: false,
    ui_ux_direction_preserved: true,
    page_plan_passed: true,
    can_proceed_to_agent25: false,
    deviations: ['unapproved feature reference (dashboard): Adds dashboard.'],
  });

  assert.match(summary, /Agent2 Brief Compliance Summary/);
  assert.match(summary, /是否新增未批准功能：是/);
  assert.match(summary, /偏离点：\n- unapproved feature/);
});
