import assert from 'node:assert/strict';
import { access, appendFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { GATES_BLOCKED, REVIEW_RESOLVED, SMOKE_NOT_DEPLOYABLE } from './continue-human-review.mjs';
import {
  ATTACHMENT_FILE_MISSING,
  createProductionRunFromHermesIntake,
  DEPLOY_BLOCKED,
  NEXT_STAGE_READY,
  PRODUCTION_RUN_CREATED,
  RUN_ALREADY_EXISTS,
  runToolsiteOrchestrator,
  STOPPED_AT_HUMAN_REVIEW,
  WAITING_FOR_FRESH_INTAKE,
} from './run-toolsite-orchestrator.mjs';
import {
  INCOMPLETE_INTAKE,
  MISSING_REQUIRED_ATTACHMENT,
  MISSING_PRODUCTION_START_INTENT,
  STALE_INTAKE_REJECTED,
} from './read-hermes-intake.mjs';

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'run-toolsite-orchestrator-'));
  const runDir = path.join(root, 'runs', 'sample-site');
  const inboxPath = path.join(root, 'hermes-home/state/toolsite-inbox.jsonl');
  await mkdir(runDir, { recursive: true });
  await mkdir(path.dirname(inboxPath), { recursive: true });
  await mkdir(path.join(root, 'shared/templates'), { recursive: true });
  await writeFile(path.join(root, 'shared/templates/approval.template.md'), '# Approval\n');
  return {
    root,
    runDir,
    inboxPath,
    eventPath: path.join(runDir, 'human-review-events.jsonl'),
  };
}

async function writeJsonl(filePath, records) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, records.length > 0 ? `${records.map((record) => JSON.stringify(record)).join('\n')}\n` : '');
}

async function writeRemote(remoteStatePath, remoteMode = true) {
  await mkdir(path.dirname(remoteStatePath), { recursive: true });
  await writeFile(
    remoteStatePath,
    JSON.stringify({ remote_mode: remoteMode, updated_at: '2026-05-12T00:00:00.000Z' }),
  );
}

async function appendJsonl(filePath, record) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(record)}\n`);
}

async function readEvents(eventPath) {
  const text = await readFile(eventPath, 'utf8');
  return text
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function review(overrides = {}) {
  return {
    schema_version: 'human-review-event.v1',
    type: 'human_review',
    review_type: 'agent25_option_selection',
    id: 'agent25-option-selection',
    site_id: 'sample-site',
    run_dir: 'runs/sample-site',
    phase: 'agent-2.5',
    agent: 'agent-2.5-ui-design-generation',
    status: 'open',
    blocking: true,
    blocks: 'agent-3',
    title: 'Choose UI option',
    message: 'Choose Option A, B, or C.',
    expected_reply: 'A / B / C',
    attachments: [],
    created_at: '2026-05-11T10:00:00.000Z',
    created_by: 'codex',
    ...overrides,
  };
}

function inbox(overrides = {}) {
  return {
    type: 'user_message',
    source: 'telegram',
    chat_id: '123',
    message_id: '456',
    text: 'A',
    created_at: '2026-05-11T10:05:00.000Z',
    handled: false,
    ...overrides,
  };
}

function completeIntake({ domain = 'wordcounter-new.local', includeIntent = true } = {}) {
  return [
    includeIntent ? '开始正式建站' : '',
    '关键词: word counter',
    `目标域名: ${domain}`,
    'UI 参考: Stripe',
    'UX 参考: wordcounter.net',
    '额外想法/限制/模仿点: 第一屏必须直接可用；浏览器本地处理；不要登录。',
  ]
    .filter(Boolean)
    .join('\n');
}

test('run:toolsite stops at existing human_review when not remote', async () => {
  const { runDir, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [review()]);

  const result = await runToolsiteOrchestrator({ runDir, remote: false });

  assert.equal(result.ok, true);
  assert.equal(result.code, STOPPED_AT_HUMAN_REVIEW);
  assert.equal(result.openReviews[0].id, 'agent25-option-selection');
});

test('run:toolsite consumes open review in remote mode and stops at next human_review', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [review()]);
  await writeJsonl(inboxPath, [inbox({ text: 'A' })]);

  const result = await runToolsiteOrchestrator({
    runDir,
    inboxPath,
    remote: true,
    continueReview: async () => {
      await appendJsonl(eventPath, { ...review(), status: 'resolved', blocking: false, selected_option: 'A' });
      await appendJsonl(eventPath, {
        ...review({
          id: 'pre-deploy-approval',
          review_type: 'pre_deploy_approval',
          phase: 'agent-5',
          blocks: 'agent-6',
        }),
      });
      return { ok: true, code: REVIEW_RESOLVED };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, STOPPED_AT_HUMAN_REVIEW);
  assert.equal(result.openReviews[0].id, 'pre-deploy-approval');
});

test('run:toolsite starts next stage and stops when that stage opens a review', async () => {
  const { runDir, eventPath } = await makeFixture();
  await writeFile(path.join(runDir, 'toolsite-spec.md'), '# SPEC\n');

  const result = await runToolsiteOrchestrator({
    runDir,
    remote: true,
    stageRunner: async ({ stage }) => {
      assert.equal(stage, 'agent-2');
      await appendJsonl(
        eventPath,
        review({
          id: 'agent2-brief-exception',
          review_type: 'agent2_brief_exception',
          phase: 'agent-2',
          blocks: 'agent-2.5',
        }),
      );
      return { ok: true, stage };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, STOPPED_AT_HUMAN_REVIEW);
  assert.equal(result.stage, 'agent-2');
  assert.equal(result.openReviews[0].id, 'agent2-brief-exception');
});

test('default stage runner reports next stage without creating site source', async () => {
  const { runDir } = await makeFixture();
  await writeFile(path.join(runDir, 'toolsite-spec.md'), '# SPEC\n');

  const result = await runToolsiteOrchestrator({ runDir, remote: true });

  assert.equal(result.ok, true);
  assert.equal(result.code, NEXT_STAGE_READY);
  assert.equal(result.stage, 'agent-2');
});

test('smoke run cannot deploy', async () => {
  const { runDir } = await makeFixture();
  await writeFile(path.join(runDir, 'run-meta.json'), JSON.stringify({ run_type: 'smoke', deployable: false }));
  await mkdir(path.join(runDir, 'agent-5-output'), { recursive: true });
  await writeFile(path.join(runDir, 'toolsite-spec.md'), '# SPEC\n');
  await mkdir(path.join(runDir, 'agent-2-output'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-2-output/site-brief.md'), '# Site brief\n');
  await mkdir(path.join(runDir, 'agent-2-5-output/chat-delivery'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-2-5-output/chat-delivery/options-board.png'), 'png');
  await mkdir(path.join(runDir, 'agent-3-output'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-3-output/implementation-handoff.md'), '# Handoff\n');
  await mkdir(path.join(runDir, 'site'), { recursive: true });
  await writeFile(path.join(runDir, 'site/package.json'), '{}\n');
  await writeFile(path.join(runDir, 'agent-5-output/final-qa-report.md'), '# Final QA\n');

  const result = await runToolsiteOrchestrator({ runDir, remote: true });

  assert.equal(result.ok, false);
  assert.equal(result.code, DEPLOY_BLOCKED);
  assert.match(result.message, /Smoke runs are not deployable/);
});

test('production run still requires gate evidence integrity before Agent6', async () => {
  const { runDir } = await makeFixture();
  await writeFile(path.join(runDir, 'run-meta.json'), JSON.stringify({ run_type: 'production', deployable: true }));
  await mkdir(path.join(runDir, 'agent-5-output'), { recursive: true });
  await writeFile(path.join(runDir, 'toolsite-spec.md'), '# SPEC\n');
  await mkdir(path.join(runDir, 'agent-2-output'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-2-output/site-brief.md'), '# Site brief\n');
  await mkdir(path.join(runDir, 'agent-2-5-output/chat-delivery'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-2-5-output/chat-delivery/options-board.png'), 'png');
  await mkdir(path.join(runDir, 'agent-3-output'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-3-output/implementation-handoff.md'), '# Handoff\n');
  await mkdir(path.join(runDir, 'site'), { recursive: true });
  await writeFile(path.join(runDir, 'site/package.json'), '{}\n');
  await writeFile(path.join(runDir, 'agent-5-output/final-qa-report.md'), '# Final QA\n');

  const result = await runToolsiteOrchestrator({ runDir, remote: true });

  assert.equal(result.ok, false);
  assert.equal(result.code, DEPLOY_BLOCKED);
  assert.equal(result.gateResult.allowed, false);
});

test('does not deploy unless pre_deploy_approval is explicitly confirmed on production run', async () => {
  const { runDir, eventPath } = await makeFixture();
  await writeFile(path.join(runDir, 'run-meta.json'), JSON.stringify({ run_type: 'production', deployable: true }));
  await writeJsonl(eventPath, [
    review({
      id: 'pre-deploy-approval',
      review_type: 'pre_deploy_approval',
      phase: 'agent-5',
      blocks: 'agent-6',
    }),
  ]);
  let stageRunnerCalled = false;

  const result = await runToolsiteOrchestrator({
    runDir,
    remote: false,
    stageRunner: async () => {
      stageRunnerCalled = true;
      return { ok: true };
    },
  });

  assert.equal(result.code, STOPPED_AT_HUMAN_REVIEW);
  assert.equal(stageRunnerCalled, false);
  assert.equal((await readEvents(eventPath)).filter((event) => event.status === 'resolved').length, 0);
});

test('old Hermes intake is rejected by default for production run creation', async () => {
  const { root, inboxPath } = await makeFixture();
  const remoteStatePath = path.join(root, 'hermes-home/state/toolsite-remote.json');
  await writeRemote(remoteStatePath, true);
  await writeJsonl(inboxPath, [
    inbox({
      message_id: 'old',
      text: completeIntake(),
      created_at: '2026-05-11T00:00:00.000Z',
    }),
  ]);

  const result = await createProductionRunFromHermesIntake({
    rootDir: root,
    inboxPath,
    remoteStatePath,
    startedAt: '2026-05-12T00:00:00.000Z',
    now: () => '2026-05-12T00:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, STALE_INTAKE_REJECTED);
});

test('fresh Hermes intake with production intent creates production run', async () => {
  const { root, inboxPath } = await makeFixture();
  const remoteStatePath = path.join(root, 'hermes-home/state/toolsite-remote.json');
  await writeRemote(remoteStatePath, true);
  await writeJsonl(inboxPath, [
    inbox({
      message_id: 'fresh',
      text: completeIntake({ domain: 'wordcounter-fresh.local' }),
      created_at: '2026-05-12T00:00:01.000Z',
    }),
  ]);

  const result = await createProductionRunFromHermesIntake({
    rootDir: root,
    inboxPath,
    remoteStatePath,
    startedAt: '2026-05-12T00:00:00.000Z',
    now: () => '2026-05-12T00:00:02.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, PRODUCTION_RUN_CREATED);
  assert.equal(result.siteId, 'wordcounter-fresh');
  const runMeta = JSON.parse(await readFile(path.join(result.runDir, 'run-meta.json'), 'utf8'));
  assert.equal(runMeta.run_type, 'production');
  assert.equal(runMeta.deployable, true);
  assert.equal(runMeta.status, 'active');
  assert.equal(runMeta.source, 'hermes-intake');
  assert.equal(runMeta.intake_message_key, 'telegram:123:fresh:2026-05-12T00:00:01.000Z');
  assert.equal(runMeta.intake_created_at, '2026-05-12T00:00:01.000Z');
  assert.equal(runMeta.run_created_at, '2026-05-12T00:00:02.000Z');
});

test('production run records attachment provenance and copies input assets', async () => {
  const { root, inboxPath } = await makeFixture();
  const remoteStatePath = path.join(root, 'hermes-home/state/toolsite-remote.json');
  const sourceImage = path.join(root, 'hermes-home/state/toolsite-attachments/123/asset.jpg');
  await mkdir(path.dirname(sourceImage), { recursive: true });
  await writeFile(sourceImage, 'real-image-bytes');
  await writeRemote(remoteStatePath, true);
  await writeJsonl(inboxPath, [
    inbox({
      message_id: 'fresh',
      text: [
        '开始正式建站',
        '关键词: 401K Calculator',
        '目标域名: 401k-calculator.net',
        'UI 参考: https://www.usa.gov',
        'UX 参考: https://www.calculator.net/401k-calculator.html',
        '额外要求: 对老人家友好；用我发的图做黑白人物插画点缀；不要登录。',
      ].join('\n'),
      created_at: '2026-05-12T00:00:01.000Z',
      attachments: [
        {
          kind: 'image',
          telegram_file_id: 'tg-photo',
          local_path: sourceImage,
          mime_type: 'image/jpeg',
          file_name: 'elder-friendly-reference.jpg',
          width: 1600,
          height: 1200,
        },
      ],
    }),
  ]);

  const result = await createProductionRunFromHermesIntake({
    rootDir: root,
    inboxPath,
    remoteStatePath,
    startedAt: '2026-05-12T00:00:00.000Z',
    now: () => '2026-05-12T00:00:02.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, PRODUCTION_RUN_CREATED);
  const runMeta = JSON.parse(await readFile(path.join(result.runDir, 'run-meta.json'), 'utf8'));
  assert.equal(runMeta.intake_attachments.length, 1);
  assert.equal(runMeta.intake_attachments[0].telegram_file_id, 'tg-photo');
  assert.match(runMeta.intake_attachments[0].run_path, /^input-assets\/01-elder-friendly-reference\.jpg$/);
  assert.equal(await readFile(path.join(result.runDir, runMeta.intake_attachments[0].run_path), 'utf8'), 'real-image-bytes');
  const input = await readFile(path.join(result.runDir, 'input.md'), 'utf8');
  assert.match(input, /## Input assets/);
  assert.match(input, /input-assets\/01-elder-friendly-reference\.jpg/);
});

test('production intake requiring attachment but lacking one does not create run', async () => {
  const { root, inboxPath } = await makeFixture();
  const remoteStatePath = path.join(root, 'hermes-home/state/toolsite-remote.json');
  await writeRemote(remoteStatePath, true);
  await writeJsonl(inboxPath, [
    inbox({
      message_id: 'fresh',
      text: [
        '开始正式建站',
        '关键词: 401K Calculator',
        '目标域名: 401k-calculator.net',
        'UI 参考: https://www.usa.gov',
        'UX 参考: https://www.calculator.net/401k-calculator.html',
        '额外想法/限制/模仿点: 参考我发的插画；不要登录。',
      ].join('\n'),
      created_at: '2026-05-12T00:00:01.000Z',
    }),
  ]);

  const result = await createProductionRunFromHermesIntake({
    rootDir: root,
    inboxPath,
    remoteStatePath,
    startedAt: '2026-05-12T00:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, MISSING_REQUIRED_ATTACHMENT);
  assert.equal(await fileExists(path.join(root, 'runs/401k-calculator')), false);
});

test('production run creation fails if attachment metadata points to a missing file', async () => {
  const { root, inboxPath } = await makeFixture();
  const remoteStatePath = path.join(root, 'hermes-home/state/toolsite-remote.json');
  await writeRemote(remoteStatePath, true);
  await writeJsonl(inboxPath, [
    inbox({
      message_id: 'fresh',
      text: [
        '开始正式建站',
        '关键词: 401K Calculator',
        '目标域名: 401k-missing-asset.net',
        'UI 参考: https://www.usa.gov',
        'UX 参考: https://www.calculator.net/401k-calculator.html',
        '额外要求: 用我发的图片做点缀；不要登录。',
      ].join('\n'),
      created_at: '2026-05-12T00:00:01.000Z',
      attachments: [
        {
          kind: 'image',
          telegram_file_id: 'tg-photo',
          local_path: path.join(root, 'missing.jpg'),
          mime_type: 'image/jpeg',
          file_name: 'missing.jpg',
          width: 1600,
          height: 1200,
        },
      ],
    }),
  ]);

  const result = await createProductionRunFromHermesIntake({
    rootDir: root,
    inboxPath,
    remoteStatePath,
    startedAt: '2026-05-12T00:00:00.000Z',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, ATTACHMENT_FILE_MISSING);
});

test('fresh Hermes intake without production intent is rejected', async () => {
  const { root, inboxPath } = await makeFixture();
  const remoteStatePath = path.join(root, 'hermes-home/state/toolsite-remote.json');
  await writeRemote(remoteStatePath, true);
  await writeJsonl(inboxPath, [
    inbox({
      message_id: 'fresh',
      text: completeIntake({ includeIntent: false }),
      created_at: '2026-05-12T00:00:01.000Z',
    }),
  ]);

  const result = await createProductionRunFromHermesIntake({
    rootDir: root,
    inboxPath,
    remoteStatePath,
    startedAt: '2026-05-12T00:00:00.000Z',
  });

  assert.equal(result.code, MISSING_PRODUCTION_START_INTENT);
});

test('incomplete fresh Hermes intake is rejected with missing fields', async () => {
  const { root, inboxPath } = await makeFixture();
  const remoteStatePath = path.join(root, 'hermes-home/state/toolsite-remote.json');
  await writeRemote(remoteStatePath, true);
  await writeJsonl(inboxPath, [
    inbox({
      message_id: 'fresh',
      text: ['开始正式建站', '关键词: word counter', '目标域名: wordcounter-incomplete.local'].join('\n'),
      created_at: '2026-05-12T00:00:01.000Z',
    }),
  ]);

  const result = await createProductionRunFromHermesIntake({
    rootDir: root,
    inboxPath,
    remoteStatePath,
    startedAt: '2026-05-12T00:00:00.000Z',
  });

  assert.equal(result.code, INCOMPLETE_INTAKE);
  assert.deepEqual(result.missingFields, ['UI 参考', 'UX 参考', '额外想法 / 限制 / 模仿点']);
});

test('existing run dir is not auto-renamed or overwritten', async () => {
  const { root, inboxPath } = await makeFixture();
  const remoteStatePath = path.join(root, 'hermes-home/state/toolsite-remote.json');
  const existingRun = path.join(root, 'runs/wordcounter-existing');
  await writeRemote(remoteStatePath, true);
  await mkdir(existingRun, { recursive: true });
  await writeFile(path.join(existingRun, 'sentinel.txt'), 'do-not-overwrite');
  await writeJsonl(inboxPath, [
    inbox({
      message_id: 'fresh',
      text: completeIntake({ domain: 'wordcounter-existing.local' }),
      created_at: '2026-05-12T00:00:01.000Z',
    }),
  ]);

  const result = await createProductionRunFromHermesIntake({
    rootDir: root,
    inboxPath,
    remoteStatePath,
    startedAt: '2026-05-12T00:00:00.000Z',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, RUN_ALREADY_EXISTS);
  assert.equal(await readFile(path.join(existingRun, 'sentinel.txt'), 'utf8'), 'do-not-overwrite');
});

test('--allow-existing-intake can explicitly use older intake', async () => {
  const { root, inboxPath } = await makeFixture();
  const remoteStatePath = path.join(root, 'hermes-home/state/toolsite-remote.json');
  await writeRemote(remoteStatePath, true);
  await writeJsonl(inboxPath, [
    inbox({
      message_id: 'old',
      text: completeIntake({ domain: 'wordcounter-allowed-old.local' }),
      created_at: '2026-05-11T00:00:01.000Z',
    }),
  ]);

  const result = await createProductionRunFromHermesIntake({
    rootDir: root,
    inboxPath,
    remoteStatePath,
    startedAt: '2026-05-12T00:00:00.000Z',
    allowExistingIntake: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, PRODUCTION_RUN_CREATED);
});

test('aborted run does not get resumed accidentally', async () => {
  const { root, inboxPath } = await makeFixture();
  const remoteStatePath = path.join(root, 'hermes-home/state/toolsite-remote.json');
  const abortedRun = path.join(root, 'runs/wordcounter-aborted');
  await writeRemote(remoteStatePath, true);
  await mkdir(abortedRun, { recursive: true });
  await writeFile(path.join(abortedRun, 'run-meta.json'), JSON.stringify({ status: 'aborted' }));
  await writeJsonl(inboxPath, [
    inbox({
      message_id: 'fresh',
      text: completeIntake({ domain: 'wordcounter-aborted.local' }),
      created_at: '2026-05-12T00:00:01.000Z',
    }),
  ]);

  const result = await createProductionRunFromHermesIntake({
    rootDir: root,
    inboxPath,
    remoteStatePath,
    startedAt: '2026-05-12T00:00:00.000Z',
    resumeExistingRun: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, RUN_ALREADY_EXISTS);
});

test('fromHermesIntake waits without creating a run when no fresh intake exists', async () => {
  const { root, inboxPath } = await makeFixture();
  const remoteStatePath = path.join(root, 'hermes-home/state/toolsite-remote.json');
  await writeRemote(remoteStatePath, true);
  await writeJsonl(inboxPath, []);

  const result = await runToolsiteOrchestrator({
    rootDir: root,
    inboxPath,
    remoteStatePath,
    fromHermesIntake: true,
    remote: true,
    startedAt: '2026-05-12T00:00:00.000Z',
  });

  assert.equal(result.code, WAITING_FOR_FRESH_INTAKE);
});
