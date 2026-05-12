import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ACTIVE_HUMAN_REVIEW_PROCESSED,
  INTAKE_ALREADY_PROCESSED,
  REMOTE_WORKER_STARTED_RUN,
  runRemoteToolsiteWorker,
  WORKER_LOCKED,
  WORKER_STARTED,
} from './remote-toolsite-worker.mjs';
import {
  INCOMPLETE_INTAKE,
  MISSING_PRODUCTION_START_INTENT,
  MISSING_REQUIRED_ATTACHMENT,
  STALE_INTAKE_REJECTED,
} from './read-hermes-intake.mjs';
import { RUN_ALREADY_EXISTS } from './run-toolsite-orchestrator.mjs';

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'remote-toolsite-worker-'));
  const inboxPath = path.join(root, 'hermes-home/state/toolsite-inbox.jsonl');
  const remoteStatePath = path.join(root, 'hermes-home/state/toolsite-remote.json');
  await mkdir(path.dirname(inboxPath), { recursive: true });
  await mkdir(path.dirname(remoteStatePath), { recursive: true });
  await mkdir(path.join(root, 'shared/templates'), { recursive: true });
  await writeFile(path.join(root, 'shared/templates/approval.template.md'), '# Approval\n');
  await writeFile(remoteStatePath, `${JSON.stringify({ remote_mode: true }, null, 2)}\n`);
  return {
    root,
    inboxPath,
    remoteStatePath,
    workerDir: path.join(root, '.toolsite-worker'),
  };
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeInbox(filePath, records) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, records.map((record) => JSON.stringify(record)).join('\n') + '\n');
}

function message(text, overrides = {}) {
  return {
    type: 'user_message',
    source: 'telegram',
    chat_id: '123',
    message_id: 'm1',
    text,
    created_at: '2026-05-12T01:00:00.000Z',
    handled: false,
    ...overrides,
  };
}

function completeText({ domain = '401k-worker-test.local', includeIntent = true, includeImageRequest = false } = {}) {
  return [
    includeIntent ? '开始正式建站' : '',
    '关键词: 401K Calculator',
    `目标域名: ${domain}`,
    'UI 参考: https://www.usa.gov',
    'UX 参考: https://www.calculator.net/401k-calculator.html',
    `额外要求: 对老人家友好；第一屏就是计算器；不要登录；不要后端；不要数据库。${
      includeImageRequest ? '参考我发的黑白人物插画。' : ''
    }`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function writeImage(root, name = 'reference.jpg') {
  const filePath = path.join(root, name);
  await writeFile(filePath, 'fake-image-bytes');
  return filePath;
}

async function createActive401kRun(root, { reviewCreatedAt = '2026-05-12T01:00:00.000Z' } = {}) {
  const runDir = path.join(root, 'runs/401k-worker-test');
  await mkdir(runDir, { recursive: true });
  await writeFile(
    path.join(runDir, 'run-meta.json'),
    `${JSON.stringify(
      {
        run_type: 'production',
        deployable: true,
        status: 'active',
        source: 'hermes-intake',
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(runDir, 'input.md'),
    [
      '# Run Input',
      '',
      '## Pre-Agent2 required user inputs',
      '',
      '- Keyword / 关键词: 401K Calculator',
      '- Target Domain / 目标域名: 401k-worker-test.local',
      '- UI Reference / UI 参考: https://www.usa.gov',
      '- UX Reference / UX 参考: https://www.calculator.net/401k-calculator.html',
      '- Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点: 对老人家友好；第一屏就是计算器；用我发的黑白人物插画做点缀；只做 educational estimate；不要登录；不要后端；不要数据库。',
      '',
    ].join('\n'),
  );
  await writeFile(
    path.join(runDir, 'human-review-events.jsonl'),
    `${JSON.stringify({
      schema_version: 'human-review-event.v1',
      type: 'human_review',
      review_type: 'pre_agent2_spec_confirmation',
      id: 'pre-agent2-spec-confirmation',
      site_id: '401k-worker-test',
      run_dir: 'runs/401k-worker-test',
      phase: 'pre-agent2',
      agent: 'pre-agent2-toolsite-spec',
      status: 'open',
      blocking: true,
      blocks: 'agent-2',
      title: 'Pre-Agent2 SPEC 确认',
      message: '【Toolsite SPEC 审核卡】',
      expected_reply: '回复：确认 SPEC，或回复：修改：...',
      attachments: [],
      created_at: reviewCreatedAt,
      created_by: 'codex',
    })}\n`,
  );
  return runDir;
}

async function runOnce(fixture, options = {}) {
  const statusMessages = options.statusMessages || [];
  const printed = options.printed || [];
  return runRemoteToolsiteWorker({
    rootDir: fixture.root,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    workerDir: fixture.workerDir,
    startedAt: '2026-05-12T00:59:00.000Z',
    once: true,
    pollMs: 0,
    now: () => '2026-05-12T01:01:00.000Z',
    statusSender: async ({ text }) => {
      statusMessages.push(text);
      return { ok: true };
    },
    printer: (text) => {
      printed.push(text);
    },
    ...options,
  });
}

test('fresh production intake triggers run creation and invokes run:toolsite', async () => {
  const fixture = await makeFixture();
  await writeInbox(fixture.inboxPath, [message(completeText())]);
  const calls = [];
  const statusMessages = [];

  const result = await runOnce(fixture, {
    statusMessages,
    runToolsite: async (args) => {
      calls.push(args);
      return { ok: true, code: 'STOPPED_AT_HUMAN_REVIEW' };
    },
  });

  assert.equal(result.code, REMOTE_WORKER_STARTED_RUN);
  assert.equal(result.siteId, '401k-worker-test');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].remote, true);
  assert.equal(await exists(path.join(fixture.root, 'runs/401k-worker-test/run-meta.json')), true);
  assert.equal(statusMessages.some((text) => text.includes('已收到新的 production intake')), true);
  assert.equal(statusMessages.some((text) => text.includes('已创建 production run')), true);
});

test('worker startup prints visible status', async () => {
  const fixture = await makeFixture();
  await writeInbox(fixture.inboxPath, []);
  const statusMessages = [];
  const printed = [];

  await runOnce(fixture, { statusMessages, printed });

  assert.equal(printed.some((text) => text.includes(WORKER_STARTED)), true);
  assert.equal(statusMessages.some((text) => text.includes('watching Hermes inbox')), true);
  assert.equal(statusMessages.some((text) => text.includes('remote mode status: on')), true);
});

test('worker accepts 额外要求 as extra notes', async () => {
  const fixture = await makeFixture();
  await writeInbox(fixture.inboxPath, [message(completeText())]);

  const result = await runOnce(fixture, {
    runToolsite: async () => ({ ok: true, code: 'STOPPED_AT_HUMAN_REVIEW' }),
  });

  assert.equal(result.code, REMOTE_WORKER_STARTED_RUN);
  assert.match(result.intake.extra_notes, /对老人家友好/);
});

test('Telegram image attachment is copied into input-assets', async () => {
  const fixture = await makeFixture();
  const imagePath = await writeImage(fixture.root);
  await writeInbox(fixture.inboxPath, [
    message(completeText({ includeImageRequest: true }), {
      attachments: [
        {
          kind: 'image',
          telegram_file_id: 'photo-1',
          local_path: imagePath,
          mime_type: 'image/jpeg',
          file_name: 'elder-friendly-reference.jpg',
          width: 1200,
          height: 900,
        },
      ],
    }),
  ]);

  const result = await runOnce(fixture, {
    runToolsite: async () => ({ ok: true, code: 'STOPPED_AT_HUMAN_REVIEW' }),
  });
  const runDir = path.join(fixture.root, 'runs/401k-worker-test');
  const runMeta = JSON.parse(await readFile(path.join(runDir, 'run-meta.json'), 'utf8'));
  const input = await readFile(path.join(runDir, 'input.md'), 'utf8');
  const copiedPath = path.join(runDir, runMeta.intake_attachments[0].run_path);

  assert.equal(result.code, REMOTE_WORKER_STARTED_RUN);
  assert.equal(runMeta.intake_attachments[0].purpose, 'illustration_reference');
  assert.equal(await readFile(copiedPath, 'utf8'), 'fake-image-bytes');
  assert.match(input, /input-assets\/01-elder-friendly-reference\.jpg/);
  assert.match(input, /illustration_reference/);
});

test('stale intake is ignored', async () => {
  const fixture = await makeFixture();
  await writeInbox(fixture.inboxPath, [message(completeText(), { created_at: '2026-05-12T00:30:00.000Z' })]);

  const result = await runOnce(fixture);

  assert.equal(result.code, STALE_INTAKE_REJECTED);
  assert.equal(await exists(path.join(fixture.root, 'runs/401k-worker-test')), false);
});

test('missing production start intent is ignored', async () => {
  const fixture = await makeFixture();
  await writeInbox(fixture.inboxPath, [message(completeText({ includeIntent: false }))]);

  const result = await runOnce(fixture);

  assert.equal(result.code, MISSING_PRODUCTION_START_INTENT);
  assert.equal(await exists(path.join(fixture.root, 'runs/401k-worker-test')), false);
});

test('incomplete intake is rejected', async () => {
  const fixture = await makeFixture();
  await writeInbox(fixture.inboxPath, [message('开始正式建站\n关键词: 401K Calculator\n目标域名: 401k-worker-test.local')]);
  const statusMessages = [];

  const result = await runOnce(fixture, { statusMessages });

  assert.equal(result.code, INCOMPLETE_INTAKE);
  assert.equal(await exists(path.join(fixture.root, 'runs/401k-worker-test')), false);
  assert.equal(statusMessages.some((text) => text.includes('production intake 不完整')), true);
  assert.equal(statusMessages.some((text) => text.includes('缺少')), true);
});

test('missing required attachment is rejected', async () => {
  const fixture = await makeFixture();
  await writeInbox(fixture.inboxPath, [message(completeText({ includeImageRequest: true }))]);
  const statusMessages = [];

  const result = await runOnce(fixture, { statusMessages });

  assert.equal(result.code, MISSING_REQUIRED_ATTACHMENT);
  assert.equal(await exists(path.join(fixture.root, 'runs/401k-worker-test')), false);
  assert.equal(statusMessages.some((text) => text.includes('没有可用图片附件')), true);
});

test('duplicate intake is not processed twice', async () => {
  const fixture = await makeFixture();
  await writeInbox(fixture.inboxPath, [message(completeText())]);
  let calls = 0;

  const first = await runOnce(fixture, {
    runToolsite: async () => {
      calls += 1;
      return { ok: true, code: 'STOPPED_AT_HUMAN_REVIEW' };
    },
  });
  const second = await runOnce(fixture, {
    runToolsite: async () => {
      calls += 1;
      return { ok: true, code: 'STOPPED_AT_HUMAN_REVIEW' };
    },
  });

  assert.equal(first.code, REMOTE_WORKER_STARTED_RUN);
  assert.equal(second.code, INTAKE_ALREADY_PROCESSED);
  assert.equal(calls, 1);
});

test('worker consumes reply for existing pre-agent2-spec-confirmation open review', async () => {
  const fixture = await makeFixture();
  const runDir = await createActive401kRun(fixture.root);
  const statusMessages = [];
  await writeInbox(fixture.inboxPath, [
    message(
      '修改：不要直接生成 SPEC。请先问我 1-3 个和 401K Calculator 相关的关键澄清问题，例如计算复杂度、默认假设、结果展示方式、老人友好输入方式。不要问固定模板问题。',
      {
        message_id: 'reply-1',
        created_at: '2026-05-12T01:00:05.000Z',
      },
    ),
  ]);

  const result = await runOnce(fixture, { statusMessages });
  const events = (await readFile(path.join(runDir, 'human-review-events.jsonl'), 'utf8'))
    .trim()
    .split(/\n/)
    .map((line) => JSON.parse(line));

  assert.equal(result.code, ACTIVE_HUMAN_REVIEW_PROCESSED);
  assert.equal(result.runResult.code, 'REVIEW_CHANGE_REQUESTED');
  assert.equal(events.some((event) => event.id === 'pre-agent2-spec-confirmation' && event.status === 'resolved' && event.change_requested === true), true);
  assert.equal(events.some((event) => event.id === 'pre-agent2-dynamic-401k-calculator-complexity' && event.status === 'open'), true);
  assert.equal(events.some((event) => event.id === 'pre-agent2-spec-confirmation-change-request' && event.status === 'superseded'), true);
  assert.equal(await exists(path.join(runDir, 'agent-2-output/site-brief.md')), false);
  assert.equal(statusMessages.some((text) => text.includes('已收到修改意见')), true);
  assert.equal(statusMessages.some((text) => text.includes('401K Calculator 第一版计算复杂度选哪一档')), true);
});

test('duplicate active review reply is not consumed twice', async () => {
  const fixture = await makeFixture();
  const runDir = await createActive401kRun(fixture.root);
  await writeInbox(fixture.inboxPath, [
    message('修改：请先问 401K Calculator 计算复杂度。', {
      message_id: 'reply-1',
      created_at: '2026-05-12T01:00:05.000Z',
    }),
  ]);

  const first = await runOnce(fixture);
  const second = await runOnce(fixture);
  const events = (await readFile(path.join(runDir, 'human-review-events.jsonl'), 'utf8'))
    .trim()
    .split(/\n/)
    .map((line) => JSON.parse(line));

  assert.equal(first.code, ACTIVE_HUMAN_REVIEW_PROCESSED);
  assert.notEqual(second.runResult?.code, 'REVIEW_CHANGE_REQUESTED');
  assert.equal(events.filter((event) => event.id === 'pre-agent2-dynamic-401k-calculator-complexity' && event.status === 'open').length, 1);
});

test('active production run is discovered from run-meta.json', async () => {
  const fixture = await makeFixture();
  await createActive401kRun(fixture.root);
  await writeInbox(fixture.inboxPath, [
    message('修改：请先问 401K Calculator 计算复杂度。', {
      message_id: 'reply-1',
      created_at: '2026-05-12T01:00:05.000Z',
    }),
  ]);

  const result = await runOnce(fixture);

  assert.equal(result.code, ACTIVE_HUMAN_REVIEW_PROCESSED);
  assert.equal(result.siteId, '401k-worker-test');
});

test('existing SPEC change request open review triggers targeted question generation', async () => {
  const fixture = await makeFixture();
  const runDir = await createActive401kRun(fixture.root);
  const initialEvents = (await readFile(path.join(runDir, 'human-review-events.jsonl'), 'utf8')).trim();
  await writeFile(
    path.join(runDir, 'human-review-events.jsonl'),
    [
      initialEvents,
      JSON.stringify({
        schema_version: 'human-review-event.v1',
        type: 'human_review',
        review_type: 'pre_agent2_spec_confirmation',
        id: 'pre-agent2-spec-confirmation',
        site_id: '401k-worker-test',
        run_dir: 'runs/401k-worker-test',
        phase: 'pre-agent2',
        agent: 'pre-agent2-toolsite-spec',
        status: 'resolved',
        blocking: false,
        blocks: 'agent-2',
        title: 'Pre-Agent2 SPEC 确认',
        message: '【Toolsite SPEC 审核卡】',
        resolution_text: '修改：请先问 401K Calculator 计算复杂度。',
        change_requested: true,
        created_at: '2026-05-12T01:00:05.000Z',
        created_by: 'codex',
        resolved_at: '2026-05-12T01:00:05.000Z',
        inbox_message_key: 'telegram:123:reply-1:2026-05-12T01:00:05.000Z',
      }),
      JSON.stringify({
        schema_version: 'human-review-event.v1',
        type: 'human_review',
        review_type: 'pre_agent2_spec_confirmation_change_request',
        id: 'pre-agent2-spec-confirmation-change-request',
        site_id: '401k-worker-test',
        run_dir: 'runs/401k-worker-test',
        phase: 'pre-agent2',
        agent: 'pre-agent2-toolsite-spec',
        status: 'open',
        blocking: true,
        blocks: 'agent-2',
        title: 'Pre-Agent2 SPEC 确认 修改请求待处理',
        message: '用户通过 Telegram 提出了修改请求，Codex 必须处理后重新提交审核。\n\n修改：请先问 401K Calculator 计算复杂度。',
        expected_reply: 'Codex 处理修改后重新生成审核内容；用户再次确认前不得继续。',
        created_at: '2026-05-12T01:00:06.000Z',
        created_by: 'codex',
      }),
    ].join('\n') + '\n',
  );
  await writeInbox(fixture.inboxPath, []);
  const statusMessages = [];

  const result = await runOnce(fixture, { statusMessages });
  const events = (await readFile(path.join(runDir, 'human-review-events.jsonl'), 'utf8'))
    .trim()
    .split(/\n/)
    .map((line) => JSON.parse(line));

  assert.equal(result.code, ACTIVE_HUMAN_REVIEW_PROCESSED);
  assert.equal(result.runResult.code, 'REVIEW_CHANGE_REQUESTED');
  assert.equal(events.some((event) => event.id === 'pre-agent2-spec-confirmation-change-request' && event.status === 'superseded'), true);
  assert.equal(events.some((event) => event.id === 'pre-agent2-dynamic-401k-calculator-complexity' && event.status === 'open'), true);
  assert.equal(statusMessages.some((text) => text.includes('401K Calculator 第一版计算复杂度选哪一档')), true);
});

test('worker consumes targeted Pre-Agent2 answer and sends fresh SPEC confirmation', async () => {
  const fixture = await makeFixture();
  const runDir = await createActive401kRun(fixture.root);
  await writeFile(
    path.join(runDir, 'human-review-events.jsonl'),
    [
      JSON.stringify({
        schema_version: 'human-review-event.v1',
        type: 'human_review',
        review_type: 'pre_agent2_spec_confirmation',
        id: 'pre-agent2-spec-confirmation',
        site_id: '401k-worker-test',
        run_dir: 'runs/401k-worker-test',
        phase: 'pre-agent2',
        agent: 'pre-agent2-toolsite-spec',
        status: 'resolved',
        blocking: false,
        blocks: 'agent-2',
        title: 'Pre-Agent2 SPEC 确认',
        message: '【Toolsite SPEC 审核卡】',
        resolution_text: '修改：请先问 401K Calculator 计算复杂度。',
        change_requested: true,
        created_at: '2026-05-12T01:00:00.000Z',
        created_by: 'codex',
        resolved_at: '2026-05-12T01:00:05.000Z',
        inbox_message_key: 'telegram:123:reply-1:2026-05-12T01:00:05.000Z',
      }),
      JSON.stringify({
        schema_version: 'human-review-event.v1',
        type: 'human_review',
        review_type: 'pre_agent2_interview_question',
        id: 'pre-agent2-dynamic-401k-calculator-complexity',
        site_id: '401k-worker-test',
        run_dir: 'runs/401k-worker-test',
        phase: 'pre-agent2',
        agent: 'pre-agent2-toolsite-spec',
        status: 'open',
        blocking: true,
        blocks: 'pre-agent2-spec',
        title: 'Pre-Agent2：401K Calculator 计算复杂度确认',
        message: [
          '401K Calculator 第一版计算复杂度选哪一档？',
          '',
          '1. 简化版：输入少，适合老人快速估算',
          '2. 标准版：包含年龄、退休年龄、当前余额、工资、缴费比例、雇主匹配、预期收益率、工资增长',
          '3. 详细版：增加 catch-up contribution、annual limit、通胀等高级项',
          '4. 其他，请直接描述',
          '5. 先按标准版生成 SPEC，但在审核卡里标注默认假设',
        ].join('\n'),
        expected_reply: '回复 1 / 2 / 3 / 4 / 5，或直接自定义描述',
        allowed_replies: ['1', '2', '3', '4', '5'],
        allow_custom_text: true,
        reply_mode: 'single_choice_with_custom_text',
        created_at: '2026-05-12T01:01:00.000Z',
        created_by: 'codex',
      }),
    ].join('\n') + '\n',
  );
  await writeInbox(fixture.inboxPath, [
    message('2', {
      message_id: 'reply-2',
      created_at: '2026-05-12T01:02:00.000Z',
    }),
  ]);
  const statusMessages = [];

  const result = await runOnce(fixture, { statusMessages });
  const events = (await readFile(path.join(runDir, 'human-review-events.jsonl'), 'utf8'))
    .trim()
    .split(/\n/)
    .map((line) => JSON.parse(line));

  assert.equal(result.code, ACTIVE_HUMAN_REVIEW_PROCESSED);
  assert.equal(events.some((event) => event.id === 'pre-agent2-dynamic-401k-calculator-complexity' && event.status === 'resolved' && event.selected_option === '2'), true);
  assert.equal(events.some((event) => event.id === 'pre-agent2-spec-confirmation' && event.status === 'open'), true);
  assert.equal(statusMessages.some((text) => text.includes('【Toolsite SPEC 审核卡】')), true);
  assert.equal(await exists(path.join(runDir, 'agent-2-output/site-brief.md')), false);
});

test('existing run dir blocks and is not auto-renamed', async () => {
  const fixture = await makeFixture();
  await mkdir(path.join(fixture.root, 'runs/401k-worker-test'), { recursive: true });
  await writeInbox(fixture.inboxPath, [message(completeText())]);
  const statusMessages = [];

  const result = await runOnce(fixture, { statusMessages });

  assert.equal(result.code, RUN_ALREADY_EXISTS);
  assert.equal(await exists(path.join(fixture.root, 'runs/401k-worker-test-local')), false);
  assert.equal(statusMessages.some((text) => text.includes('已存在')), true);
  assert.equal(statusMessages.some((text) => text.includes('不会自动改名或覆盖')), true);
});

test('worker does not auto-confirm SPEC, UI, or deploy approval', async () => {
  const fixture = await makeFixture();
  await writeInbox(fixture.inboxPath, [message(completeText())]);
  const calls = [];

  await runOnce(fixture, {
    runToolsite: async (args) => {
      calls.push(args);
      return { ok: true, code: 'STOPPED_AT_HUMAN_REVIEW' };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].remote, true);
  assert.equal('autoConfirmSpec' in calls[0], false);
  assert.equal('autoSelectOption' in calls[0], false);
  assert.equal('autoConfirmDeploy' in calls[0], false);
});

test('lock prevents duplicate worker', async () => {
  const fixture = await makeFixture();
  await mkdir(fixture.workerDir, { recursive: true });
  await writeFile(path.join(fixture.workerDir, 'worker.lock'), JSON.stringify({ pid: 123 }));
  await writeInbox(fixture.inboxPath, [message(completeText())]);

  const result = await runOnce(fixture, {
    pidAlive: () => true,
    runToolsite: async () => {
      throw new Error('locked worker must not run toolsite');
    },
  });

  assert.equal(result.code, WORKER_LOCKED);
  assert.equal(await exists(path.join(fixture.root, 'runs/401k-worker-test')), false);
});

test('stale lock auto-clears when PID is dead', async () => {
  const fixture = await makeFixture();
  await mkdir(fixture.workerDir, { recursive: true });
  await writeFile(path.join(fixture.workerDir, 'worker.lock'), JSON.stringify({ pid: 123 }));
  await writeInbox(fixture.inboxPath, [message(completeText())]);

  const result = await runOnce(fixture, {
    pidAlive: () => false,
    runToolsite: async () => ({ ok: true, code: 'STOPPED_AT_HUMAN_REVIEW' }),
  });

  assert.equal(result.code, REMOTE_WORKER_STARTED_RUN);
  assert.equal(await exists(path.join(fixture.root, 'runs/401k-worker-test/run-meta.json')), true);
});
