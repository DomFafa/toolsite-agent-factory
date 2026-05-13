import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createDesktopRun, DESKTOP_RUN_CREATED } from './create-run.mjs';
import {
  AGENT2_COMPLETE,
  DEPLOY_REQUIRES_APPROVAL,
  HUMAN_REVIEW_REQUIRED,
  NO_STAGE_RUNNER_CONFIGURED,
  readDesktopState,
  runDesktopStage,
  SPEC_REVIEW_OPEN,
} from './run.mjs';
import {
  continueDesktopRun,
  REVIEW_RESOLVED,
  SPEC_NOT_CONFIRMED,
} from './continue.mjs';

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function makeInput(root) {
  const inputPath = path.join(root, 'input.md');
  await writeFile(
    inputPath,
    [
      '# Desktop Input',
      '',
      '## Pre-Agent2 required user inputs',
      '',
      '- Keyword / 关键词: word counter',
      '- Target Domain / 目标域名: wordcounter-desktop.test',
      '- UI Reference / UI 参考: Stripe',
      '- UX Reference / UX 参考: wordcounter.net',
      '- Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点: 第一屏是工具；实时展示 words、characters、sentences、paragraphs、reading time、speaking time；本地处理；不要登录。',
      '',
    ].join('\n'),
  );
  return inputPath;
}

async function readEvents(runDir) {
  const text = await readFile(path.join(runDir, 'human-review-events.jsonl'), 'utf8');
  return text.trim()
    ? text.trim().split(/\n/).filter(Boolean).map((line) => JSON.parse(line))
    : [];
}

test('desktop create-run creates expected run structure', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-create-'));
  const inputPath = await makeInput(root);
  const assetDir = path.join(root, 'assets');
  await mkdir(assetDir);
  await writeFile(path.join(assetDir, 'reference.png'), 'fake image bytes');

  const result = await createDesktopRun({
    rootDir: root,
    siteId: 'wordcounter-desktop',
    inputPath,
    assetDir,
    now: () => '2026-05-13T00:00:00.000Z',
  });

  assert.equal(result.code, DESKTOP_RUN_CREATED);
  const runDir = path.join(root, 'runs', 'wordcounter-desktop');
  for (const filePath of [
    'input.md',
    'run-meta.json',
    'human-review-events.jsonl',
    'desktop-run-state.json',
    'input-assets',
    'pre-agent2-output',
    'agent-2-output',
    'agent-2-5-output',
    'agent-3-output',
    'agent-4-output',
    'site',
    'agent-5-output',
    'gate-results',
    'deployment-output',
  ]) {
    assert.equal(await exists(path.join(runDir, filePath)), true, `${filePath} should exist`);
  }
  const meta = JSON.parse(await readFile(path.join(runDir, 'run-meta.json'), 'utf8'));
  assert.equal(meta.run_type, 'production');
  assert.equal(meta.deployable, true);
  assert.equal(meta.mode, 'desktop');
  assert.equal(meta.site_id, 'wordcounter-desktop');
  assert.equal(meta.target_domain, 'wordcounter-desktop.test');
  assert.equal(meta.status, 'active');
  assert.equal(meta.input_assets.length, 1);
});

test('desktop run stops at SPEC review', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-run-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });

  const result = await runDesktopStage({ runDir: created.runDir });
  const state = await readDesktopState(created.runDir);
  const events = await readEvents(created.runDir);

  assert.equal(result.code, SPEC_REVIEW_OPEN);
  assert.equal(state.stage, 'spec-review');
  assert.equal(await exists(path.join(created.runDir, 'toolsite-spec.md')), true);
  const review = events.find((event) => event.review_type === 'spec-confirmation' && event.status === 'open');
  assert.ok(review);
  assert.match(review.message, /Toolsite 需求确认/);
});

test('desktop continue refuses to skip unconfirmed SPEC', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-no-skip-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });
  await runDesktopStage({ runDir: created.runDir });

  const result = await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: 'A',
  });

  assert.equal(result.code, SPEC_NOT_CONFIRMED);
  assert.equal((await readDesktopState(created.runDir)).stage, 'spec-review');
});

test('desktop:agent2 writes Agent2 outputs, runs compliance, and stops before Agent2.5', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent2-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });
  await runDesktopStage({ runDir: created.runDir });

  const continued = await continueDesktopRun({
    runDir: created.runDir,
    review: 'spec-confirmation',
    reply: '确认 SPEC',
  });
  assert.equal(continued.code, REVIEW_RESOLVED);
  assert.equal((await readDesktopState(created.runDir)).stage, 'agent2');

  const result = await runDesktopStage({ runDir: created.runDir });
  assert.equal(result.code, AGENT2_COMPLETE);
  assert.equal(result.stage, 'agent25');
  assert.equal((await readDesktopState(created.runDir)).stage, 'agent25');

  for (const filePath of [
    'agent-2-output/site-brief.md',
    'agent-2-output/tool-spec.md',
    'agent-2-output/content-plan.md',
    'agent-2-output/seo-plan.md',
    'agent-2-output/page-plan.md',
    'agent-2-output/ui-reference-dossier.md',
    'agent-2-output/design-generation-input.md',
    'agent-2-output/brief-compliance-summary.md',
    'gate-results/pre-agent2-toolsite-spec.json',
    'gate-results/page-plan.json',
    'gate-results/agent2-brief-compliance.json',
  ]) {
    assert.equal(await exists(path.join(created.runDir, filePath)), true, `${filePath} should exist`);
  }

  const compliance = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent2-brief-compliance.json'), 'utf8'));
  assert.equal(compliance.passed, true);
  assert.equal(compliance.can_proceed_to_agent25, true);
});

test('desktop:agent2 refuses to run before SPEC confirmation', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent2-unconfirmed-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });
  await runDesktopStage({ runDir: created.runDir });

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent2' });

  assert.equal(result.code, HUMAN_REVIEW_REQUIRED);
  assert.equal(result.stage, 'spec-review');
  assert.equal(await exists(path.join(created.runDir, 'agent-2-output/site-brief.md')), false);
});

test('desktop deploy refuses without pre_deploy_approval', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'deploy' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, DEPLOY_REQUIRES_APPROVAL);
  assert.equal(state.stage, 'deploy-review');
  assert.equal(state.blocking_reason, 'pre-deploy-approval');
});

test('missing stage runner returns NO_STAGE_RUNNER_CONFIGURED', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-missing-runner-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent25' });

  assert.equal(result.code, NO_STAGE_RUNNER_CONFIGURED);
  assert.equal(result.stage, 'agent25');
});

test('desktop flow scripts do not use Hermes, Telegram senders, or remote worker', async () => {
  const files = [
    'scripts/desktop/create-run.mjs',
    'scripts/desktop/run.mjs',
    'scripts/desktop/continue.mjs',
    'scripts/desktop/gate-repair-loop.mjs',
  ];
  const combined = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  assert.doesNotMatch(combined, /toolsite-inbox|Hermes|sendTelegramMessage|remote-toolsite-worker|remote:toolsite-worker/i);
});
