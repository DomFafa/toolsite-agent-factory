import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createDesktopRun, DESKTOP_RUN_CREATED } from './create-run.mjs';
import {
  AGENT2_COMPLIANCE_FAILED,
  AGENT2_COMPLETE,
  AGENT2_COMPLIANCE_REQUIRED,
  AGENT2_OUTPUT_MISSING,
  AGENT25_COMPLETE,
  AGENT25_EXECUTOR_FAILED,
  DEPLOY_REQUIRES_APPROVAL,
  DESKTOP_PRECONDITION_FAILED,
  HUMAN_REVIEW_REQUIRED,
  INVALID_DESKTOP_STAGE,
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

function pngBuffer(seed = 'a') {
  const header = Buffer.alloc(33);
  header.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(1440, 16);
  header.writeUInt32BE(900, 20);
  header[24] = 8;
  header[25] = 2;
  header[26] = 0;
  header[27] = 0;
  header[28] = 0;
  return Buffer.concat([header, Buffer.from(seed.repeat(10_100))]);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function writePng(runDir, relPath, seed) {
  const buffer = pngBuffer(seed);
  await mkdir(path.dirname(path.join(runDir, relPath)), { recursive: true });
  await writeFile(path.join(runDir, relPath), buffer);
  return sha256(buffer);
}

async function writeAgent25ExecutorFixture(runDir) {
  const externalResponsePath = 'agent-2-5-output/external-design-evidence/external-response.md';
  const conversationPath = 'agent-2-5-output/external-design-evidence/conversation-screenshot.png';
  const sourceProvenancePath = 'agent-2-5-output/external-design-evidence/source-provenance.md';
  const selectedLineagePath = 'agent-2-5-output/external-design-evidence/selected-design-lineage.md';
  const optionsBoardPath = 'agent-2-5-output/chat-delivery/options-board.png';
  const optionSelectionPath = 'agent-2-5-output/chat-delivery/option-selection.md';
  const desktopPath = 'agent-2-5-output/selected-design/target/desktop.png';
  const mobilePath = 'agent-2-5-output/selected-design/target/mobile.png';
  const optionPaths = {
    'option-a': 'agent-2-5-output/generated-designs/option-a/target/desktop.png',
    'option-b': 'agent-2-5-output/generated-designs/option-b/target/desktop.png',
    'option-c': 'agent-2-5-output/generated-designs/option-c/target/desktop.png',
  };

  const optionASha = await writePng(runDir, optionPaths['option-a'], 'a');
  const optionBSha = await writePng(runDir, optionPaths['option-b'], 'b');
  const optionCSha = await writePng(runDir, optionPaths['option-c'], 'c');
  const conversationSha = await writePng(runDir, conversationPath, 'conversation');
  const boardSha = await writePng(runDir, optionsBoardPath, 'board');
  const desktopSha = await writePng(runDir, desktopPath, 'b');
  const mobileSha = await writePng(runDir, mobilePath, 'mobile-b');

  const externalResponse = [
    'ChatGPT raw external response export',
    'Assistant:',
    'Option A: Dense word counter workbench with live metrics, desktop target, mobile target, and practical states.',
    'Option B: Friendly word counter with clear text input, live words, characters, sentences, paragraphs, and timers.',
    'Option C: Minimal progress-first word counter with accessible controls, result cards, and complete interaction states.',
    'The target domain is wordcounter-desktop.test and the design is for Astro HTML CSS vanilla JS restoration.',
  ].join('\n');
  await mkdir(path.dirname(path.join(runDir, externalResponsePath)), { recursive: true });
  await writeFile(path.join(runDir, externalResponsePath), externalResponse);
  const externalResponseSha = sha256(Buffer.from(externalResponse));

  await writeFile(
    path.join(runDir, sourceProvenancePath),
    [
      '# Source Provenance',
      '',
      'Decision: PASS',
      `Option A: GPT response Option A mapped to source image ${optionPaths['option-a']} sha ${optionASha}.`,
      `Option B: GPT response Option B mapped to source image ${optionPaths['option-b']} sha ${optionBSha}.`,
      `Option C: GPT response Option C mapped to source image ${optionPaths['option-c']} sha ${optionCSha}.`,
      'Selected option: Option B from GPT response Option B.',
      `Desktop target: ${desktopPath} maps to GPT response Option B and source image sha ${optionBSha}.`,
      `Mobile target: ${mobilePath} maps to GPT response Option B mobile target and source image sha ${optionBSha}.`,
    ].join('\n'),
  );
  await writeFile(
    path.join(runDir, selectedLineagePath),
    [
      '# Selected Design Lineage',
      '',
      'Decision: PASS',
      'Selected Option B came from the ChatGPT approved external option response and its source image.',
    ].join('\n'),
  );
  await mkdir(path.dirname(path.join(runDir, optionSelectionPath)), { recursive: true });
  await writeFile(
    path.join(runDir, optionSelectionPath),
    [
      '# Option Selection',
      '',
      'Decision: PASS',
      'Option A, Option B, and Option C were shown in chat as a dry-run option board.',
      'Defaulted after 3 minutes to Option B for this dry-run only.',
    ].join('\n'),
  );

  await writeFile(
    path.join(runDir, 'agent-2-5-output/external-design-evidence/external-design-proof.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        mode: 'dry-run',
        approvedDesignSurface: 'ChatGPT approved design surface',
        externalResponse: {
          path: externalResponsePath,
          kind: 'raw exported model response',
          sha256: externalResponseSha,
        },
        conversationScreenshot: {
          path: conversationPath,
          surface: 'ChatGPT web UI approved design surface',
          sha256: conversationSha,
        },
        options: [
          { id: 'option-a', label: 'Option A', source: 'GPT generated option source image', imagePath: optionPaths['option-a'], sha256: optionASha },
          { id: 'option-b', label: 'Option B', source: 'GPT generated option source image', imagePath: optionPaths['option-b'], sha256: optionBSha },
          { id: 'option-c', label: 'Option C', source: 'GPT generated option source image', imagePath: optionPaths['option-c'], sha256: optionCSha },
        ],
        optionsBoard: {
          path: optionsBoardPath,
          source: 'assembled from GPT option source images',
          containsOptionImageHashes: [optionASha, optionBSha, optionCSha],
          sha256: boardSha,
        },
        selection: {
          source: 'dry-run executor default after generated board capture',
          selectedOption: 'option-b',
        },
        targets: {
          desktop: {
            path: desktopPath,
            source: 'derived from GPT external option source',
            sourceOption: 'option-b',
            sha256: desktopSha,
          },
          mobile: {
            path: mobilePath,
            source: 'derived from GPT external option source',
            sourceOption: 'option-b',
            sha256: mobileSha,
          },
        },
        selectedDesignPackage: {
          source: 'GPT external option package',
          sourceOption: 'option-b',
          codexLocalCreation: false,
        },
      },
      null,
      2,
    ),
  );

  const promptPath = 'agent-2-output/design-generation-input.md';
  const artifactPaths = [
    externalResponsePath,
    conversationPath,
    optionsBoardPath,
    ...Object.values(optionPaths),
    desktopPath,
    mobilePath,
  ];
  const artifact_hashes = {};
  for (const relPath of artifactPaths) artifact_hashes[relPath] = sha256(await readFile(path.join(runDir, relPath)));
  const promptSha = sha256(await readFile(path.join(runDir, promptPath)));
  await writeFile(
    path.join(runDir, 'agent-2-5-output/external-design-evidence/action-receipt.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        action: 'design-options',
        run_dir: path.relative(process.cwd(), runDir).replace(/\\/g, '/'),
        started_at: '2026-05-16T00:00:00.000Z',
        completed_at: '2026-05-16T00:00:05.000Z',
        tool: {
          name: 'web-access',
          surface: 'ChatGPT web UI',
          command: 'web-access/scripts/check-deps.sh',
        },
        prompt_path: promptPath,
        prompt_sha256: promptSha,
        uploaded_assets: [],
        screenshots: [{ path: conversationPath, sha256: artifact_hashes[conversationPath], kind: 'conversation' }],
        raw_response: { path: externalResponsePath, sha256: artifact_hashes[externalResponsePath], kind: 'raw exported model response' },
        downloads: [],
        artifact_hashes,
        status: 'pass',
        error: null,
        runner_version: 'agent25-external-action-evidence/1',
      },
      null,
      2,
    ),
  );
}

async function makeAgent25ReadyRun(root, { withAssets = false } = {}) {
  const inputPath = await makeInput(root);
  const args = { rootDir: root, siteId: 'wordcounter-desktop', inputPath };
  if (withAssets) {
    const assetDir = path.join(root, 'assets');
    await mkdir(assetDir);
    await writeFile(path.join(assetDir, 'reference.png'), 'fake image bytes');
    args.assetDir = assetDir;
  }
  const created = await createDesktopRun(args);
  await runDesktopStage({ runDir: created.runDir });
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'spec-confirmation',
    reply: '确认 SPEC',
  });
  const agent2 = await runDesktopStage({ runDir: created.runDir, stage: 'agent2' });
  assert.equal(agent2.code, AGENT2_COMPLETE);
  return created;
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
  const state = await readDesktopState(created.runDir);
  assert.equal(state.stage, 'agent25');
  assert.equal(state.last_completed_stage, 'agent2');
  assert.equal(state.next_action, 'run desktop:agent25');
  assert.equal(state.blocking_reason, null);

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

  const preAgent2SpecGate = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/pre-agent2-toolsite-spec.json'), 'utf8'));
  assert.equal(preAgent2SpecGate.gate, 'pre-agent2-toolsite-spec');
  assert.equal(preAgent2SpecGate.passed, true);

  const pagePlanGate = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/page-plan.json'), 'utf8'));
  assert.equal(pagePlanGate.gate, 'page-plan');
  assert.equal(pagePlanGate.passed, true);

  const compliance = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent2-brief-compliance.json'), 'utf8'));
  assert.equal(compliance.gate, 'agent2-brief-compliance');
  assert.equal(compliance.passed, true);
  assert.equal(compliance.can_proceed_to_agent25, true);

  assert.deepEqual(await readdir(path.join(created.runDir, 'agent-2-5-output')), []);
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
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

test('desktop:agent2 refuses non-desktop production run metadata', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent2-meta-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });
  await runDesktopStage({ runDir: created.runDir });
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'spec-confirmation',
    reply: '确认 SPEC',
  });
  await writeFile(
    path.join(created.runDir, 'run-meta.json'),
    JSON.stringify({ mode: 'desktop', run_type: 'smoke', deployable: false }, null, 2),
  );

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent2' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, DESKTOP_PRECONDITION_FAILED);
  assert.equal(state.stage, 'agent2');
  assert.equal(state.blocking_reason, 'desktop-production-run-required');
  assert.equal(await exists(path.join(created.runDir, 'agent-2-output/site-brief.md')), false);
});

test('desktop:agent2 writes pre-agent2 SPEC gate result when SPEC file is missing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent2-missing-spec-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });
  await runDesktopStage({ runDir: created.runDir });
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'spec-confirmation',
    reply: '确认 SPEC',
  });
  await rm(path.join(created.runDir, 'toolsite-spec.md'));

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent2' });
  const state = await readDesktopState(created.runDir);
  const preAgent2SpecGate = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/pre-agent2-toolsite-spec.json'), 'utf8'));

  assert.equal(result.code, AGENT2_COMPLIANCE_FAILED);
  assert.equal(state.stage, 'agent2');
  assert.equal(state.blocking_reason, 'pre-agent2-toolsite-spec');
  assert.equal(preAgent2SpecGate.passed, false);
  assert.match(preAgent2SpecGate.failures.join('\n'), /missing toolsite-spec\.md/);
  assert.equal(await exists(path.join(created.runDir, 'agent-2-output/site-brief.md')), false);
});

test('desktop:agent2 preserves image design_reference in design-generation-input', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent2-asset-'));
  const inputPath = await makeInput(root);
  const assetDir = path.join(root, 'assets');
  await mkdir(assetDir);
  await writeFile(path.join(assetDir, 'reference.png'), 'fake image bytes');
  const created = await createDesktopRun({
    rootDir: root,
    siteId: 'wordcounter-desktop',
    inputPath,
    assetDir,
  });
  await runDesktopStage({ runDir: created.runDir });
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'spec-confirmation',
    reply: '确认 SPEC',
  });

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent2' });
  assert.equal(result.code, AGENT2_COMPLETE);

  const designInput = await readFile(path.join(created.runDir, 'agent-2-output/design-generation-input.md'), 'utf8');
  assert.match(designInput, /input-assets\/01-reference\.png/);
  assert.match(designInput, /design_reference/);
});

test('desktop:agent2 stays at agent2 when a gate fails', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent2-gate-fail-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });
  await runDesktopStage({ runDir: created.runDir });
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'spec-confirmation',
    reply: '确认 SPEC',
  });
  await mkdir(path.join(created.runDir, 'site/src/pages'), { recursive: true });
  await writeFile(path.join(created.runDir, 'site/src/pages/login.astro'), '<h1>Login</h1>');

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent2' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, AGENT2_COMPLIANCE_FAILED);
  assert.equal(state.stage, 'agent2');
  assert.equal(state.blocking_reason, 'page-plan');

  const pagePlanGate = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/page-plan.json'), 'utf8'));
  assert.equal(pagePlanGate.passed, false);
  const compliance = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent2-brief-compliance.json'), 'utf8'));
  assert.equal(compliance.passed, false);
  assert.equal(await exists(path.join(created.runDir, 'agent-2-5-output/design-generation-prompt.md')), false);
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
});

test('desktop:agent25 refuses before Agent2 completed', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-before-agent2-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent25' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, INVALID_DESKTOP_STAGE);
  assert.equal(state.stage, 'pre-agent2');
  assert.equal(await exists(path.join(created.runDir, 'agent-2-5-output/chat-delivery/options-board.png')), false);
});

test('desktop:agent25 refuses without design-generation-input', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-missing-input-'));
  const created = await makeAgent25ReadyRun(root);
  await rm(path.join(created.runDir, 'agent-2-output/design-generation-input.md'));

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent25' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, AGENT2_OUTPUT_MISSING);
  assert.equal(state.stage, 'agent25');
  assert.equal(state.blocking_reason, 'agent-2-output/design-generation-input.md');
});

test('desktop:agent25 refuses without passing Agent2 compliance', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-compliance-'));
  const created = await makeAgent25ReadyRun(root);
  await writeFile(
    path.join(created.runDir, 'gate-results/agent2-brief-compliance.json'),
    JSON.stringify({ gate: 'agent2-brief-compliance', status: 'fail', passed: false }, null, 2),
  );

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent25' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, AGENT2_COMPLIANCE_REQUIRED);
  assert.equal(state.stage, 'agent25');
  assert.equal(state.blocking_reason, 'agent2-brief-compliance');
});

test('desktop:agent25 invokes execute-agent25-design-options', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-invoke-'));
  const created = await makeAgent25ReadyRun(root, { withAssets: true });
  const calls = [];

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'agent25',
    executeAgent25DesignOptions: async (args) => {
      calls.push(args);
      await writeAgent25ExecutorFixture(args.runDir);
      return { status: 0, stdout: 'PASS Agent2.5 design-options executor' };
    },
  });

  assert.equal(result.code, AGENT25_COMPLETE);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].runDir, created.runDir);
  assert.equal(calls[0].promptPath, path.join(created.runDir, 'agent-2-output/design-generation-input.md'));
  assert.deepEqual(calls[0].argv, [
    'scripts/run/execute-agent25-design-options.mjs',
    '--run-dir',
    created.runDir,
    '--prompt',
    path.join(created.runDir, 'agent-2-output/design-generation-input.md'),
  ]);
});

test('desktop:agent25 executor failure keeps stage agent25 and records blocking_reason', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-executor-fail-'));
  const created = await makeAgent25ReadyRun(root);

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'agent25',
    executeAgent25DesignOptions: async () => ({
      status: 1,
      stdout: 'NO_APPROVED_UI_GENERATION_AVAILABLE\nChatGPT surface unavailable\n',
      stderr: '',
    }),
  });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, AGENT25_EXECUTOR_FAILED);
  assert.equal(state.stage, 'agent25');
  assert.equal(state.blocking_reason, 'NO_APPROVED_UI_GENERATION_AVAILABLE');
  assert.equal(await exists(path.join(created.runDir, 'agent-2-5-output/chat-delivery/options-board.png')), false);
});

test('desktop:agent25 successful executor writes option review, gates, and stops at ui-review', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-success-'));
  const created = await makeAgent25ReadyRun(root, { withAssets: true });

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'agent25',
    executeAgent25DesignOptions: async ({ runDir }) => {
      await writeAgent25ExecutorFixture(runDir);
      return { status: 0, stdout: 'PASS Agent2.5 design-options executor' };
    },
  });
  const state = await readDesktopState(created.runDir);
  const events = await readEvents(created.runDir);
  const review = events.find((event) => event.id === 'agent25-option-selection' && event.status === 'open');

  assert.equal(result.code, AGENT25_COMPLETE);
  assert.equal(state.stage, 'ui-review');
  assert.equal(state.last_completed_stage, 'agent25');
  assert.equal(state.next_action, 'review Agent2.5 options and run desktop:select-ui');
  assert.equal(state.blocking_reason, 'ui-option-selection');
  assert.ok(review);
  assert.equal(review.review_type, 'agent25_option_selection');
  assert.equal(review.blocking, true);
  assert.equal(review.blocks, 'agent-3');
  assert.match(review.message, /本地 UI A\/B\/C 选择/);
  assert.deepEqual(review.attachments, [
    {
      label: 'Agent2.5 options board',
      path: 'agent-2-5-output/chat-delivery/options-board.png',
      kind: 'image',
      required: true,
    },
  ]);

  for (const filePath of [
    'agent-2-5-output/external-design-evidence/action-receipt.json',
    'agent-2-5-output/external-design-evidence/conversation-screenshot.png',
    'agent-2-5-output/external-design-evidence/external-response.md',
    'agent-2-5-output/chat-delivery/options-board.png',
    'gate-results/agent25-option-images.json',
    'gate-results/agent25-external-design-proof.json',
  ]) {
    assert.equal(await exists(path.join(created.runDir, filePath)), true, `${filePath} should exist`);
  }

  const optionImages = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent25-option-images.json'), 'utf8'));
  assert.equal(optionImages.passed, true);
  const externalProof = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent25-external-design-proof.json'), 'utf8'));
  assert.equal(externalProof.passed, true);

  assert.deepEqual(await readdir(path.join(created.runDir, 'agent-3-output')), []);
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
});

test('desktop:select-ui can resolve the local Agent2.5 option review', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-select-ui-'));
  const created = await makeAgent25ReadyRun(root);
  await runDesktopStage({
    runDir: created.runDir,
    stage: 'agent25',
    executeAgent25DesignOptions: async ({ runDir }) => {
      await writeAgent25ExecutorFixture(runDir);
      return { status: 0, stdout: 'PASS Agent2.5 design-options executor' };
    },
  });

  const selected = await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: 'A',
  });
  const state = await readDesktopState(created.runDir);
  const events = await readEvents(created.runDir);
  const resolved = events.find((event) => event.id === 'agent25-option-selection' && event.status === 'resolved');

  assert.equal(selected.code, REVIEW_RESOLVED);
  assert.equal(state.stage, 'implement');
  assert.equal(resolved.selected_option, 'A');
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

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'implement' });

  assert.equal(result.code, NO_STAGE_RUNNER_CONFIGURED);
  assert.equal(result.stage, 'implement');
});

test('desktop flow scripts use only local desktop review state', async () => {
  const files = [
    'scripts/desktop/create-run.mjs',
    'scripts/desktop/run.mjs',
    'scripts/desktop/continue.mjs',
    'scripts/desktop/gate-repair-loop.mjs',
  ];
  const combined = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  const retiredLogPattern = new RegExp(`${['toolsite', 'in' + 'box'].join('-')}|send[A-Z][A-Za-z]*Message|Telegram|Hermes|remote|${'work' + 'er'}`, 'i');
  assert.doesNotMatch(combined, retiredLogPattern);
});
