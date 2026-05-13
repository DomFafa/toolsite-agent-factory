import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createDesktopIntakeRun,
  DESKTOP_INTAKE_CREATED,
  INCOMPLETE_INTAKE,
  MISSING_INPUT_ASSET,
  RUN_ALREADY_EXISTS,
} from './intake.mjs';

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function intakeMarkdown(extra = '') {
  return [
    '# Intake',
    '',
    '- 关键词: 401K Calculator',
    '- 目标域名: 401k-calculator.net',
    '- UI 参考: usa.gov',
    '- UX 参考: calculator.net 401K Calculator',
    `- 额外想法 / 限制 / 模仿点: ${extra || '对老人家友好；第一屏就是计算器；不要登录。'}`,
    '',
  ].join('\n');
}

test('complete five elements creates run', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-intake-complete-'));
  const inputPath = path.join(root, 'intake.md');
  await writeFile(inputPath, intakeMarkdown());

  const result = await createDesktopIntakeRun({
    rootDir: root,
    inputPath,
    now: () => '2026-05-13T00:00:00.000Z',
  });

  assert.equal(result.code, DESKTOP_INTAKE_CREATED);
  assert.equal(result.siteId, '401k-calculator');
  assert.equal(await exists(path.join(result.runDir, 'input.md')), true);
  assert.equal(await exists(path.join(result.runDir, 'run-meta.json')), true);
  assert.equal(await exists(path.join(result.runDir, 'desktop-run-state.json')), true);
  assert.equal(await exists(path.join(result.runDir, 'human-review-events.jsonl')), true);

  const meta = JSON.parse(await readFile(path.join(result.runDir, 'run-meta.json'), 'utf8'));
  assert.equal(meta.mode, 'desktop');
  assert.equal(meta.run_type, 'production');
  assert.equal(meta.deployable, true);
  assert.equal(meta.keyword, '401K Calculator');
  assert.equal(meta.target_domain, '401k-calculator.net');
  assert.equal(meta.source, 'desktop-intake');
});

test('missing five elements returns INCOMPLETE_INTAKE', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-intake-missing-'));
  const inputPath = path.join(root, 'intake.md');
  await writeFile(inputPath, [
    '- 关键词: 401K Calculator',
    '- 目标域名: 401k-calculator.net',
  ].join('\n'));

  const result = await createDesktopIntakeRun({ rootDir: root, inputPath });

  assert.equal(result.code, INCOMPLETE_INTAKE);
  assert.deepEqual(result.missing, ['UI 参考', 'UX 参考', '额外想法 / 限制 / 模仿点']);
  assert.equal(await exists(path.join(root, 'runs/401k-calculator')), false);
});

test('optional image absent is allowed when not referenced', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-intake-no-image-'));
  const result = await createDesktopIntakeRun({
    rootDir: root,
    siteId: 'simple-tool',
    keyword: 'word counter',
    target_domain: 'word-counter.test',
    ui_reference: 'Stripe',
    ux_reference: 'wordcounter.net',
    extra_notes: '第一屏就是工具；不要登录。',
  });

  assert.equal(result.code, DESKTOP_INTAKE_CREATED);
  const meta = JSON.parse(await readFile(path.join(result.runDir, 'run-meta.json'), 'utf8'));
  assert.deepEqual(meta.assets, []);
});

test('referenced image missing returns MISSING_INPUT_ASSET', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-intake-missing-asset-'));
  const result = await createDesktopIntakeRun({
    rootDir: root,
    siteId: 'image-tool',
    keyword: '401K Calculator',
    target_domain: '401k-calculator.net',
    ui_reference: 'usa.gov',
    ux_reference: 'calculator.net 401K Calculator',
    extra_notes: '参考图做页面点缀；第一屏就是计算器。',
  });

  assert.equal(result.code, MISSING_INPUT_ASSET);
  assert.equal(await exists(path.join(root, 'runs/image-tool')), false);
});

test('provided image is copied to input-assets', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-intake-asset-'));
  const assetPath = path.join(root, 'person sketch.png');
  await writeFile(assetPath, 'fake image bytes');

  const result = await createDesktopIntakeRun({
    rootDir: root,
    siteId: '401k-calculator',
    keyword: '401K Calculator',
    target_domain: '401k-calculator.net',
    ui_reference: 'usa.gov',
    ux_reference: 'calculator.net 401K Calculator',
    extra_notes: '参考我发的图做页面点缀；黑白人物插画；第一屏就是计算器。',
    assets: [assetPath],
  });

  assert.equal(result.code, DESKTOP_INTAKE_CREATED);
  assert.equal(result.assets.length, 1);
  assert.equal(await exists(path.join(result.runDir, result.assets[0].run_path)), true);
  const input = await readFile(path.join(result.runDir, 'input.md'), 'utf8');
  assert.match(input, /input-assets\/01-person-sketch\.png/);
  assert.match(input, /illustration_reference/);
});

test('run-meta records design_reference / illustration_reference', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-intake-meta-'));
  const assetDir = path.join(root, 'assets');
  await mkdir(assetDir);
  await writeFile(path.join(assetDir, 'reference.jpg'), 'fake image bytes');

  const result = await createDesktopIntakeRun({
    rootDir: root,
    siteId: 'visual-tool',
    keyword: 'visual tool',
    target_domain: 'visual-tool.test',
    ui_reference: 'reference site',
    ux_reference: 'reference ux',
    extra_notes: '插画参考作为页面点缀。',
    assets: [assetDir],
  });

  const meta = JSON.parse(await readFile(path.join(result.runDir, 'run-meta.json'), 'utf8'));
  assert.equal(meta.assets[0].purpose, 'illustration_reference');
  assert.equal(meta.input_assets[0].purpose, 'illustration_reference');
});

test('existing run returns RUN_ALREADY_EXISTS', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-intake-existing-'));
  const args = {
    rootDir: root,
    siteId: 'existing-site',
    keyword: 'word counter',
    target_domain: 'existing-site.test',
    ui_reference: 'Stripe',
    ux_reference: 'wordcounter.net',
    extra_notes: '第一屏就是工具。',
  };
  assert.equal((await createDesktopIntakeRun(args)).code, DESKTOP_INTAKE_CREATED);
  assert.equal((await createDesktopIntakeRun(args)).code, RUN_ALREADY_EXISTS);
});

test('desktop-run-state starts at pre-agent2', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-intake-state-'));
  const result = await createDesktopIntakeRun({
    rootDir: root,
    siteId: 'state-site',
    keyword: 'word counter',
    target_domain: 'state-site.test',
    ui_reference: 'Stripe',
    ux_reference: 'wordcounter.net',
    extra_notes: '第一屏就是工具。',
  });

  const state = JSON.parse(await readFile(path.join(result.runDir, 'desktop-run-state.json'), 'utf8'));
  assert.equal(state.mode, 'desktop');
  assert.equal(state.stage, 'pre-agent2');
  assert.equal(state.last_completed_stage, 'intake');
  assert.equal(state.next_action, 'run desktop:pre-agent2');
  assert.equal(state.blocking_reason, null);
});

test('docs/help path does not require Hermes / Telegram', async () => {
  const intakeScript = await readFile('scripts/desktop/intake.mjs', 'utf8');
  const docs = await readFile('docs/desktop-first-flow.md', 'utf8');
  const combined = `${intakeScript}\n${docs}`;
  assert.doesNotMatch(intakeScript, /toolsite-inbox|sendTelegramMessage|remote-toolsite-worker|remote:toolsite-worker/i);
  assert.match(docs, /desktop:intake/);
  assert.match(combined, /Hermes.*optional|optional.*Hermes/i);
});
