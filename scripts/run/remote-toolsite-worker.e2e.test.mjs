import assert from 'node:assert/strict';
import { access, appendFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { continueHumanReview } from './continue-human-review.mjs';
import { runLoopIteration } from './pre-agent2-telegram-loop.mjs';
import {
  ACTIVE_HUMAN_REVIEW_PROCESSED,
  REMOTE_WORKER_STARTED_RUN,
  runRemoteToolsiteWorker,
} from './remote-toolsite-worker.mjs';
import { runToolsiteOrchestrator } from './run-toolsite-orchestrator.mjs';

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'remote-toolsite-worker-e2e-'));
  const inboxPath = path.join(root, 'hermes-home/state/toolsite-inbox.jsonl');
  const remoteStatePath = path.join(root, 'hermes-home/state/toolsite-remote.json');
  const telegramEnvPath = path.join(root, 'hermes-home/.env');
  const imagePath = path.join(root, 'reference.jpg');
  await mkdir(path.dirname(inboxPath), { recursive: true });
  await mkdir(path.dirname(remoteStatePath), { recursive: true });
  await mkdir(path.dirname(telegramEnvPath), { recursive: true });
  await mkdir(path.join(root, 'shared/templates'), { recursive: true });
  await writeFile(path.join(root, 'shared/templates/approval.template.md'), '# Approval\n');
  await writeFile(remoteStatePath, `${JSON.stringify({ remote_mode: true }, null, 2)}\n`);
  await writeFile(telegramEnvPath, 'TELEGRAM_BOT_TOKEN=fake\nTELEGRAM_ALLOWED_USERS=123\n');
  await writeFile(imagePath, 'real-enough-test-image-bytes');
  return {
    root,
    inboxPath,
    remoteStatePath,
    telegramEnvPath,
    workerDir: path.join(root, '.toolsite-worker'),
    imagePath,
  };
}

function productionIntake({ imagePath }) {
  return {
    type: 'user_message',
    source: 'telegram',
    chat_id: '123',
    message_id: 'intake-1',
    created_at: '2026-05-12T01:00:01.000Z',
    handled: false,
    text: [
      '开始正式建站',
      '关键词：401K Calculator',
      '目标域名：401k-calculator.net',
      'UI 参考：https://www.usa.gov',
      'UX 参考：https://www.calculator.net/401k-calculator.html',
      '额外要求：对老人家友好，大字体、高对比、输入简单；第一屏就是计算器；参考我发的黑白人物插画做页面点缀；只做 educational estimate，不提供投资/税务建议；不要登录、不要后端、不要数据库、不要保存用户输入。',
    ].join('\n'),
    attachments: [
      {
        kind: 'image',
        telegram_file_id: 'photo-401k',
        local_path: imagePath,
        mime_type: 'image/jpeg',
        file_name: 'black-white-people.jpg',
        width: 720,
        height: 972,
      },
    ],
  };
}

async function appendInbox(fixture, text, id) {
  const record = {
    type: 'user_message',
    source: 'telegram',
    chat_id: '123',
    message_id: id,
    text,
    created_at: `2026-05-12T04:${String(10 + Number(id.replace(/\D/g, '') || 0)).padStart(2, '0')}:00.000Z`,
    handled: false,
  };
  await appendFile(fixture.inboxPath, `${JSON.stringify(record)}\n`);
}

async function readJsonl(filePath) {
  const text = await readFile(filePath, 'utf8');
  return text.trim().split(/\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function openReview(events) {
  const latest = new Map();
  for (const event of events) {
    if (event?.type === 'human_review' && event.id) latest.set(event.id, event);
  }
  return [...latest.values()].find((event) => event.status === 'open');
}

async function appendReview(runDir, event) {
  await appendFile(path.join(runDir, 'human-review-events.jsonl'), `${JSON.stringify(event)}\n`);
}

async function fakeStageRunner({ stage, runDir }) {
  if (stage === 'agent-2') {
    const outputDir = path.join(runDir, 'agent-2-output');
    await mkdir(outputDir, { recursive: true });
    const designInput = [
      '# Design Generation Input',
      '',
      '- Product: 401K Calculator',
      '- Selected intake asset: input-assets/01-black-white-people.jpg',
      '- Asset purpose: illustration_reference / design_reference; use as a light visual accent and do not let it displace the calculator.',
    ].join('\n');
    await writeFile(path.join(outputDir, 'site-brief.md'), '# 401K Calculator Site Brief\n');
    await writeFile(path.join(outputDir, 'tool-spec.md'), '# Tool Spec\n');
    await writeFile(path.join(outputDir, 'content-plan.md'), '# Content Plan\n');
    await writeFile(path.join(outputDir, 'seo-plan.md'), '# SEO Plan\n');
    await writeFile(path.join(outputDir, 'ui-reference-dossier.md'), '# UI Reference Dossier\n');
    await writeFile(path.join(outputDir, 'design-generation-input.md'), designInput);
    return { ok: true, code: 'FAKE_AGENT2_COMPLETE', stage };
  }

  if (stage === 'agent-2.5') {
    const boardPath = path.join(runDir, 'agent-2-5-output/chat-delivery/options-board.png');
    await mkdir(path.dirname(boardPath), { recursive: true });
    await writeFile(boardPath, Buffer.from('89504e470d0a1a0a'.padEnd(4096, '0'), 'hex'));
    await appendReview(runDir, {
      schema_version: 'human-review-event.v1',
      type: 'human_review',
      review_type: 'agent25_option_selection',
      id: 'agent25-option-selection',
      site_id: path.basename(runDir),
      run_dir: `runs/${path.basename(runDir)}`,
      phase: 'agent-2.5',
      agent: 'agent-2.5-ui-design-generation',
      status: 'open',
      blocking: true,
      blocks: 'agent-3',
      title: '请选择 UI 方案',
      message: '请查看 Option A / B / C 对比图，然后选择一个 UI 方案。',
      expected_reply: '回复：选择 Option A / 选择 Option B / 选择 Option C / 都不满意，重做：...',
      attachments: [{ label: 'Options board', path: 'agent-2-5-output/chat-delivery/options-board.png', kind: 'image', required: true }],
      created_at: '2026-05-12T02:00:00.000Z',
      created_by: 'codex-test',
    });
    return { ok: true, code: 'FAKE_AGENT25_COMPLETE', stage };
  }

  if (stage === 'agent-3') {
    const outputDir = path.join(runDir, 'agent-3-output');
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'implementation-handoff.md'), '# Agent3 Handoff\nselected_design = Option A\n');
    return { ok: true, code: 'FAKE_AGENT3_COMPLETE', stage };
  }

  if (stage === 'agent-4') {
    const siteDir = path.join(runDir, 'site');
    await mkdir(siteDir, { recursive: true });
    await writeFile(path.join(siteDir, 'package.json'), '{"scripts":{"build":"echo build"}}\n');
    return { ok: true, code: 'FAKE_AGENT4_COMPLETE', stage };
  }

  if (stage === 'agent-5') {
    const outputDir = path.join(runDir, 'agent-5-output');
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'final-qa-report.md'), '# Final QA\nPASS\n');
    await writeFile(path.join(outputDir, 'launch-readiness.md'), '# Launch Readiness\nPending human deploy approval.\n');
    await appendReview(runDir, {
      schema_version: 'human-review-event.v1',
      type: 'human_review',
      review_type: 'pre_deploy_approval',
      id: 'pre-deploy-approval',
      site_id: path.basename(runDir),
      run_dir: `runs/${path.basename(runDir)}`,
      phase: 'agent-5',
      agent: 'agent-5-final-qa',
      status: 'open',
      blocking: true,
      blocks: 'agent-6',
      title: '上线前确认',
      message: 'Agent5 Final QA 已通过。是否允许进入 Agent6 部署？',
      expected_reply: '回复：确认部署 / 修改：...',
      attachments: [],
      created_at: '2026-05-12T03:00:00.000Z',
      created_by: 'codex-test',
    });
    return { ok: true, code: 'FAKE_AGENT5_COMPLETE', stage };
  }

  if (stage === 'agent-6') {
    throw new Error('The remote worker e2e must not deploy.');
  }

  return { ok: true, code: 'FAKE_STAGE_COMPLETE', stage };
}

function makeRunToolsiteHarness({ fixture, statusMessages, now }) {
  return (args) => runToolsiteOrchestrator({
    ...args,
    rootDir: fixture.root,
    pollMs: 0,
    maxIdleIterations: 1,
    preAgent2Runner: (preAgent2Args) => runLoopIteration({
      ...preAgent2Args,
      telegramEnvPath: fixture.telegramEnvPath,
      sender: async (text) => {
        statusMessages.push(text);
        return { ok: true };
      },
      now,
    }),
    continueReview: (continueArgs) => continueHumanReview({
      ...continueArgs,
      now,
      advance: (stage, context) => fakeStageRunner({ ...context, stage }),
      resendOptionReview: async () => {
        throw new Error('The remote worker e2e must not resend options.');
      },
    }),
    stageRunner: (stageArgs) => fakeStageRunner(stageArgs),
  });
}

async function runWorkerOnce({ fixture, statusMessages, runToolsite, now }) {
  return runRemoteToolsiteWorker({
    rootDir: fixture.root,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    workerDir: fixture.workerDir,
    telegramEnvPath: fixture.telegramEnvPath,
    startedAt: '2026-05-12T01:00:00.000Z',
    once: true,
    pollMs: 0,
    now,
    runToolsite,
    statusSender: async ({ text }) => {
      statusMessages.push(text);
      return { ok: true };
    },
    printer: () => {},
  });
}

test('remote worker completes fake inbox flow through deploy approval change request', async () => {
  const fixture = await makeFixture();
  await writeFile(fixture.inboxPath, `${JSON.stringify(productionIntake({ imagePath: fixture.imagePath }))}\n`);
  const statusMessages = [];
  let tick = 0;
  const now = () => new Date(Date.parse('2026-05-12T01:00:10.000Z') + tick++ * 1000).toISOString();
  const runToolsite = makeRunToolsiteHarness({ fixture, statusMessages, now });

  const first = await runWorkerOnce({ fixture, statusMessages, runToolsite, now });
  assert.equal(first.code, REMOTE_WORKER_STARTED_RUN);
  const runDir = path.join(fixture.root, 'runs/401k-calculator');
  assert.equal(await exists(path.join(runDir, 'run-meta.json')), true);
  const runMeta = JSON.parse(await readFile(path.join(runDir, 'run-meta.json'), 'utf8'));
  assert.equal(runMeta.run_type, 'production');
  assert.equal(runMeta.deployable, true);
  assert.equal(runMeta.intake_attachments[0].purpose, 'illustration_reference');
  assert.equal(await exists(path.join(runDir, runMeta.intake_attachments[0].run_path)), true);
  assert.match(statusMessages.join('\n'), /401K Calculator 第一版计算复杂度选哪一档/);
  assert.doesNotMatch(statusMessages.join('\n'), /Q1\. 这个工具站最核心要帮用户完成什么任务/);

  const answers = [
    ['2', 'answer-1', /401K Calculator 的默认假设要怎么设置/],
    ['2', 'answer-2', /employer match 第一版按哪种规则处理/],
    ['2', 'answer-3', /401K Calculator 的结果区第一版应该怎么展示/],
    ['3', 'answer-4', /老人友好输入方式第一版选哪种/],
    ['3', 'answer-5', /【Toolsite SPEC 审核卡】/],
  ];

  for (const [text, id, expectedMessage] of answers) {
    await appendInbox(fixture, text, id);
    const result = await runWorkerOnce({ fixture, statusMessages, runToolsite, now });
    assert.equal(result.code, ACTIVE_HUMAN_REVIEW_PROCESSED);
    assert.match(statusMessages.join('\n'), expectedMessage);
  }

  let events = await readJsonl(path.join(runDir, 'human-review-events.jsonl'));
  let currentOpen = openReview(events);
  assert.equal(currentOpen.id, 'pre-agent2-spec-confirmation');
  assert.equal(await exists(path.join(runDir, 'toolsite-spec.md')), true);

  await appendInbox(fixture, '确认 SPEC', 'answer-6');
  const afterSpec = await runWorkerOnce({ fixture, statusMessages, runToolsite, now });
  assert.equal(afterSpec.code, ACTIVE_HUMAN_REVIEW_PROCESSED);
  events = await readJsonl(path.join(runDir, 'human-review-events.jsonl'));
  assert.equal(events.some((event) => event.id === 'pre-agent2-spec-confirmation' && event.status === 'resolved' && event.resolution_text === '确认 SPEC'), true);
  currentOpen = openReview(events);
  assert.equal(currentOpen.id, 'agent25-option-selection');
  const designInput = await readFile(path.join(runDir, 'agent-2-output/design-generation-input.md'), 'utf8');
  assert.match(designInput, /input-assets\/01-black-white-people\.jpg/);
  assert.match(designInput, /illustration_reference/);

  await appendInbox(fixture, 'A', 'answer-7');
  const afterOption = await runWorkerOnce({ fixture, statusMessages, runToolsite, now });
  assert.equal(afterOption.code, ACTIVE_HUMAN_REVIEW_PROCESSED);
  events = await readJsonl(path.join(runDir, 'human-review-events.jsonl'));
  assert.equal(events.some((event) => event.id === 'agent25-option-selection' && event.status === 'resolved' && event.selected_option === 'A'), true);
  currentOpen = openReview(events);
  assert.equal(currentOpen.id, 'pre-deploy-approval');

  await appendInbox(fixture, '修改：上线前再人工检查文案', 'answer-8');
  const afterDeployChange = await runWorkerOnce({ fixture, statusMessages, runToolsite, now });
  assert.equal(afterDeployChange.code, ACTIVE_HUMAN_REVIEW_PROCESSED);
  events = await readJsonl(path.join(runDir, 'human-review-events.jsonl'));
  assert.equal(events.some((event) => event.id === 'pre-deploy-approval' && event.status === 'resolved' && event.change_requested === true), true);
  assert.equal(await exists(path.join(runDir, 'agent-6-output/deploy-result.json')), false);
  assert.doesNotMatch(statusMessages.join('\n'), /确认部署成功|已部署/);
});
