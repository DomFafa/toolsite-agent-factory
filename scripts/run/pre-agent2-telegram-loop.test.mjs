import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  SPEC_GENERIC_BLOCK_MESSAGE,
} from '../qa/check-pre-agent2-toolsite-spec.mjs';

import {
  QUESTION_BANK,
  REMOTE_DISABLED_MESSAGE,
  buildQuestionEvent,
  buildResolvedQuestionEvent,
  normalizeMaxQuestions,
  renderSpecReviewCard,
  runPreAgent2TelegramLoop,
  shouldGenerateSpec,
  splitTelegramMessages,
  validateReply,
} from './pre-agent2-telegram-loop.mjs';

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'pre-agent2-loop-'));
  const runDir = path.join(root, 'runs', 'sample-site');
  const inboxPath = path.join(root, 'hermes-home', 'state', 'toolsite-inbox.jsonl');
  const remoteStatePath = path.join(root, 'hermes-home', 'state', 'toolsite-remote.json');
  const telegramEnvPath = path.join(root, 'hermes-home', '.env');
  await mkdir(runDir, { recursive: true });
  await mkdir(path.dirname(inboxPath), { recursive: true });
  await writeFile(
    path.join(runDir, 'input.md'),
    [
      '# Run Input',
      '',
      '- Site ID: sample-site',
      '- Target domain: sample.local',
      '- Primary keyword: sample tool',
      '',
      '## Pre-Agent2 required user inputs',
      '',
      '- Keyword / 关键词: sample tool',
      '- Target Domain / 目标域名: sample.local',
      '- UI Reference / UI 参考: Stripe 风格',
      '- UX Reference / UX 参考: example.com',
      '- Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点: 第一屏必须是工具',
      '',
    ].join('\n'),
  );
  await writeFile(telegramEnvPath, 'TELEGRAM_ALLOWED_USERS=123\nTELEGRAM_BOT_TOKEN=test-token\n');
  return {
    root,
    runDir,
    inboxPath,
    remoteStatePath,
    telegramEnvPath,
    eventPath: path.join(runDir, 'human-review-events.jsonl'),
    qaPath: path.join(runDir, 'pre-agent2-qa.md'),
    specPath: path.join(runDir, 'toolsite-spec.md'),
    statePath: path.join(runDir, 'pre-agent2-telegram-loop-state.json'),
  };
}

async function setRemoteMode(remoteStatePath, remoteMode) {
  await mkdir(path.dirname(remoteStatePath), { recursive: true });
  await writeFile(remoteStatePath, `${JSON.stringify({ remote_mode: remoteMode })}\n`);
}

async function writeJsonl(filePath, records) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
}

async function readJsonl(filePath) {
  const text = await readFile(filePath, 'utf8');
  return text
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function inboxMessage(text, overrides = {}) {
  return {
    type: 'user_message',
    source: 'telegram',
    chat_id: '123',
    message_id: String(overrides.message_id || text),
    text,
    created_at: overrides.created_at || '2026-05-11T10:01:00.000Z',
    handled: false,
  };
}

function fakeSender(sent) {
  return async (text) => {
    sent.push(text);
    return { message_id: String(sent.length), chat_id: '123' };
  };
}

function assertSpecConfirmationCard(text) {
  assert.match(text, /【Toolsite SPEC 审核卡】/);
  assert.match(text, /工具目标/);
  assert.match(text, /第一屏 UX/);
  assert.match(text, /输入 \/ 输出模型/);
  assert.match(text, /明确不做的功能/);
  assert.match(text, /成功标准/);
  assert.match(text, /请回复：/);
}

function assertChineseFirstSpecCard(text) {
  assertSpecConfirmationCard(text);
  assert.doesNotMatch(text, /Static frontend only\./);
  assert.doesNotMatch(text, /No backend, database/);
  assert.doesNotMatch(text, /Users understand within 3 seconds/);
  assert.doesNotMatch(text, /The first viewport must be a clean Stripe-style tool surface/);
  assert.doesNotMatch(text, /Input is plain text only/);
  assert.match(text, /word counter/);
  assert.match(text, /Stripe/);
  assert.match(text, /wordcounter\.net/);
  assert.match(text, /words/);
  assert.match(text, /characters/);
  assert.match(text, /sentences/);
  assert.match(text, /paragraphs/);
  assert.match(text, /reading time/);
  assert.match(text, /speaking time/);
}

function genericWordCounterSpec() {
  return [
    '# Toolsite SPEC: sample-site',
    '',
    '## Required Inputs',
    '',
    '- Keyword: word counter',
    '- Target Domain: wordcounter-test.local',
    '- UI Reference: Stripe 风格',
    '- UX Reference: wordcounter.net',
    '- Extra Ideas / Constraints / Mimic Points: 第一屏必须是工具，不要登录，不要复杂功能',
    '',
    '## Lightweight Q&A Record',
    '',
    '- Question rounds: 12',
    '- Complex tool: no',
    '',
    '## Tool Purpose',
    '',
    '- 快速完成明确计算、转换或检查任务。',
    '',
    '## First Viewport UX',
    '',
    '- 核心数字或结果最醒目。',
    '',
    '## Input / Output Model',
    '',
    '- 用户输入内容后得到结果。',
    '',
    '## Result Experience',
    '',
    '- 结果清晰、快速、可信。',
    '',
    '## UI / UX Direction',
    '',
    '- 使用仓库标准约束。',
    '',
    '## Non-goals',
    '',
    '- 不做复杂功能。',
    '',
    '## Technical Constraints',
    '',
    '- Use the repository standard static frontend tool constraints.',
    '',
    '## Page Boundary',
    '',
    '- Build one focused tool page.',
    '',
    '## Agent Workflow Boundary',
    '',
    '- Agent2 waits for SPEC confirmation.',
    '',
    '## SEO Baseline',
    '',
    '- Primary keyword drives page intent.',
    '',
    '## Success Criteria Baseline',
    '',
    '- 用户打开页面后完成任务。',
    '',
  ].join('\n');
}

function englishWordCounterSpec() {
  return [
    '# Toolsite SPEC: wordcounter-test',
    '',
    '## Required Inputs',
    '',
    '- Keyword: word counter',
    '- Target Domain: wordcounter-test.local',
    '- UI Reference: Stripe 风格',
    '- UX Reference: wordcounter.net',
    '- Extra Ideas / Constraints / Mimic Points: 第一屏必须是工具，不要登录，不要复杂功能',
    '',
    '## Tool Purpose',
    '',
    '- Build word counter for wordcounter-test.local: a browser-local word counter that lets users paste or type plain text and see real-time text statistics.',
    '- The core task is not content creation or AI rewriting. It is fast, trustworthy counting for writers, editors, students, SEO/content operators, and anyone checking text length.',
    '',
    '## Target Users and Use Cases',
    '',
    '- Writers and editors checking draft length before publishing.',
    '- Students or professionals checking text length for forms, essays, blurbs, or platform limits.',
    '- SEO/content users who need quick text statistics without login, upload, or saving private text.',
    '',
    '## First Viewport UX',
    '',
    '- The first viewport must be a clean Stripe-style tool surface inspired by Stripe 风格: a short title and description, a large text input, and core stat cards below or to the right.',
    '- On mobile, the text input comes first and the stat cards follow immediately below it. The tool must be usable before any SEO content.',
    '',
    '## Input / Output Model',
    '',
    '- Input is plain text only. Users paste or type into one large text area.',
    '- Output updates in real time without a submit button.',
    '- Include lightweight actions: clear text, copy results, and insert example text.',
    '- Text must be processed in the local browser only. Do not upload it and do not store user input.',
    '',
    '## Result Experience',
    '',
    '- The first viewport default metrics must include: words, characters, sentences, paragraphs, reading time, and speaking time.',
    '- Core metric cards should be visible, scannable, and stable while users type or paste long text.',
    '- Keyword density is not a first-screen core metric. It can only be considered later as an optional advanced module.',
    '',
    '## UI / UX Direction',
    '',
    '- UI reference: Stripe 风格. Use a clean, professional Stripe-style visual system with whitespace, subtle cards, clear hierarchy, and restrained color.',
    '- UX reference: wordcounter.net. Match the immediacy of wordcounter.net style live statistics, but do not copy its layout or visual design.',
    '- The experience should feel like a focused utility, not a marketing landing page or dashboard.',
    '',
    '## Non-goals',
    '',
    '- Do not build login, accounts, database, backend, API keys, AI rewrite, spelling check, grammar check, cloud sync, history, leaderboard, or saved documents.',
    '- Do not make keyword density a first-screen core feature.',
    '- Do not require users to click submit before seeing results.',
    '',
    '## Technical Constraints',
    '',
    '- Static frontend only.',
    '- No backend, database, login, account system, API key, AI service, server-side text processing, or analytics that captures user text.',
    '- Counting logic must run locally in the browser and handle long text without overflow.',
    '',
    '## Page Boundary',
    '',
    '- Required pages: `/`, `/privacy`, `/terms`, `/sitemap.xml`, and `/robots.txt`.',
    '- The `/` page is the word counter tool page. First-screen tool experience has priority over SEO content.',
    '- Forbidden by default: `/login`, `/dashboard`, `/account`, `/pricing`, `/leaderboard`, `/api`, `/history`, and `/blog`.',
    '',
    '## Success Criteria Baseline',
    '',
    '- Users understand within 3 seconds that they can paste or type text and immediately see text statistics.',
    '- Pasting text immediately updates words, characters, sentences, paragraphs, reading time, and speaking time.',
    '- Mobile is usable, long text does not overflow, and the first viewport remains a working tool rather than SEO filler.',
    '',
  ].join('\n');
}

async function startLoopOnce(fixture, sent = []) {
  await setRemoteMode(fixture.remoteStatePath, true);
  const result = await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    pollMs: 0,
    maxIterations: 1,
    sender: fakeSender(sent),
    now: () => '2026-05-11T10:00:00.000Z',
  });
  return result;
}

test('remote_mode=false refuses to start before reading inbox', async () => {
  const fixture = await makeFixture();
  await setRemoteMode(fixture.remoteStatePath, false);
  await writeFile(fixture.inboxPath, 'not valid jsonl');

  const result = await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    pollMs: 0,
    maxIterations: 1,
    sender: fakeSender([]),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'remote-disabled');
  assert.equal(result.message, REMOTE_DISABLED_MESSAGE);
  assert.equal(await exists(fixture.eventPath), false);
});

test('Q1 is written as an open review and pushed to Telegram', async () => {
  const fixture = await makeFixture();
  const sent = [];

  const result = await startLoopOnce(fixture, sent);
  const events = await readJsonl(fixture.eventPath);

  assert.equal(result.ok, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'pre-agent2-q1-tool-purpose');
  assert.equal(events[0].status, 'open');
  assert.deepEqual(events[0].allowed_replies, ['1', '2', '3', '4', '5']);
  assert.equal(events[0].allow_custom_text, true);
  assert.equal(events[0].reply_mode, 'single_choice_with_custom_text');
  assert.equal(sent.length, 1);
  assert.match(sent[0], /^Q1\./);
});

test('legal option 4 resolves, records QA as option, and enters next question', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await startLoopOnce(fixture, sent);
  await writeJsonl(fixture.inboxPath, [inboxMessage('4')]);

  await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    pollMs: 0,
    maxIterations: 2,
    sender: fakeSender(sent),
    now: () => '2026-05-11T10:02:00.000Z',
  });

  const events = await readJsonl(fixture.eventPath);
  const resolved = events.find((event) => event.id === 'pre-agent2-q1-tool-purpose' && event.status === 'resolved');
  const q2 = events.find((event) => event.id === 'pre-agent2-q2-first-viewport' && event.status === 'open');
  const qa = await readFile(fixture.qaPath, 'utf8');

  assert.equal(resolved.answer_type, 'option');
  assert.equal(resolved.selected_option, '4');
  assert.equal(q2.status, 'open');
  assert.match(qa, /Answer type: option/);
  assert.match(qa, /Answer: 4/);
  assert.equal(sent.length, 2);
  assert.match(sent[1], /^Q2\./);
});

for (const invalid of ['8', '0', '9', '12']) {
  test(`invalid numeric reply ${invalid} does not resolve or advance`, async () => {
    const fixture = await makeFixture();
    const sent = [];
    await startLoopOnce(fixture, sent);
    await writeJsonl(fixture.inboxPath, [inboxMessage(invalid)]);

    await runPreAgent2TelegramLoop({
      runDir: fixture.runDir,
      inboxPath: fixture.inboxPath,
      remoteStatePath: fixture.remoteStatePath,
      telegramEnvPath: fixture.telegramEnvPath,
      pollMs: 0,
      maxIterations: 2,
      sender: fakeSender(sent),
      now: () => '2026-05-11T10:02:00.000Z',
    });

    const events = await readJsonl(fixture.eventPath);
    assert.equal(events.filter((event) => event.status === 'resolved').length, 0);
    assert.equal(events.some((event) => event.id === 'pre-agent2-q2-first-viewport'), false);
    assert.equal(await exists(fixture.qaPath), false);
    assert.equal(await exists(fixture.specPath), false);
    assert.equal(sent.length, 2);
    assert.match(sent[1], /^你回复的选项不在本题范围内/);
    assert.match(sent[1], /Q1\. 这个工具站最核心要帮用户完成什么任务/);
  });
}

test('custom text resolves and records QA as custom_text', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await startLoopOnce(fixture, sent);
  await writeJsonl(fixture.inboxPath, [inboxMessage('我想要更完整的指标')]);

  await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    pollMs: 0,
    maxIterations: 2,
    sender: fakeSender(sent),
    now: () => '2026-05-11T10:02:00.000Z',
  });

  const events = await readJsonl(fixture.eventPath);
  const resolved = events.find((event) => event.status === 'resolved');
  const qa = await readFile(fixture.qaPath, 'utf8');

  assert.equal(resolved.answer_type, 'custom_text');
  assert.equal(resolved.custom_text, '我想要更完整的指标');
  assert.match(qa, /Answer type: custom_text/);
  assert.match(qa, /Answer: 我想要更完整的指标/);
});

test('same invalid inbox key is not repeatedly reprompted', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await startLoopOnce(fixture, sent);
  await writeJsonl(fixture.inboxPath, [inboxMessage('8', { message_id: 'bad-once' })]);

  await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    pollMs: 0,
    maxIterations: 3,
    sender: fakeSender(sent),
    now: () => '2026-05-11T10:02:00.000Z',
  });

  const state = JSON.parse(await readFile(fixture.statePath, 'utf8'));
  assert.equal(sent.length, 2);
  assert.equal(state.rejected_inbox_keys.length, 1);
  assert.match(sent[1], /^你回复的选项不在本题范围内/);
});

test('max questions is clamped to 30', () => {
  assert.equal(normalizeMaxQuestions(99), 30);
  assert.equal(normalizeMaxQuestions(30), 30);
});

test('six decision areas can trigger early SPEC generation when enabled', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await setRemoteMode(fixture.remoteStatePath, true);

  const answered = QUESTION_BANK.slice(0, 6).map((question, index) => {
    const open = buildQuestionEvent({
      question,
      siteId: 'sample-site',
      runDir: fixture.runDir,
      createdAt: `2026-05-11T10:0${index}:00.000Z`,
    });
    return buildResolvedQuestionEvent({
      openReview: open,
      inboxMessage: inboxMessage('1', {
        message_id: `answered-${index}`,
        created_at: `2026-05-11T10:0${index}:30.000Z`,
      }),
      validation: validateReply('1', open),
      resolvedAt: `2026-05-11T10:0${index}:40.000Z`,
    });
  });
  assert.equal(shouldGenerateSpec({ answeredEvents: answered, allowEarlySpec: true }), true);
  await writeJsonl(fixture.eventPath, answered);

  await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    pollMs: 0,
    maxIterations: 1,
    sender: fakeSender(sent),
    allowEarlySpec: true,
    now: () => '2026-05-11T10:10:00.000Z',
  });

  const events = await readJsonl(fixture.eventPath);
  const spec = await readFile(fixture.specPath, 'utf8');
  const confirmation = events.find((event) => event.id === 'pre-agent2-spec-confirmation');

  assert.equal(confirmation.status, 'open');
  assert.equal(confirmation.blocks, 'agent-2');
  assert.match(spec, /六个用户决策区已清楚，用户同意提前输出 SPEC。/);
  assertSpecConfirmationCard(confirmation.message);
  assertSpecConfirmationCard(sent.at(-1));
  assert.doesNotMatch(sent.at(-1), /^Pre-Agent2 Toolsite SPEC 草稿已生成：.*toolsite-spec\.md\s*$/s);
});

test('long SPEC confirmation review card is split into Telegram-safe messages', () => {
  const longText = 'word counter 专属需求。'.repeat(140);
  const specText = [
    '# Toolsite SPEC: sample-site',
    '',
    '## Required Inputs',
    '',
    '- Keyword: word counter',
    '- Target Domain: wordcounter-test.local',
    '',
    '## Tool Purpose',
    '',
    `- ${longText}`,
    '',
    '## First Viewport UX',
    '',
    `- ${longText}`,
    '',
    '## Input / Output Model',
    '',
    `- ${longText}`,
    '',
    '## Result Experience',
    '',
    `- ${longText}`,
    '',
    '## UI / UX Direction',
    '',
    `- ${longText}`,
    '',
    '## Non-goals',
    '',
    `- ${longText}`,
    '',
    '## Technical Constraints',
    '',
    `- ${longText}`,
    '',
    '## Page Boundary',
    '',
    `- ${longText}`,
    '',
    '## Success Criteria Baseline',
    '',
    `- ${longText}`,
    '',
  ].join('\n');

  const card = renderSpecReviewCard({
    specText,
    specPath: 'runs/sample-site/toolsite-spec.md',
  });
  const chunks = splitTelegramMessages(card, 500);

  assertSpecConfirmationCard(card);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 500));
  assert.match(chunks.join('\n'), /runs\/sample-site\/toolsite-spec\.md/);
});

test('English SPEC input renders a Chinese-first Telegram review card', () => {
  const card = renderSpecReviewCard({
    specText: englishWordCounterSpec(),
    specPath: 'runs/wordcounter-test/toolsite-spec.md',
  });

  assertChineseFirstSpecCard(card);
  assert.match(card, /工具目标/);
  assert.match(card, /第一屏 UX/);
  assert.match(card, /输入 \/ 输出模型/);
  assert.match(card, /明确不做的功能/);
  assert.match(card, /成功标准/);
  assert.match(card, /浏览器本地运行/);
  assert.match(card, /仅使用静态前端/);
});

test('generic SPEC is not sent for user confirmation', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await setRemoteMode(fixture.remoteStatePath, true);

  const answered = QUESTION_BANK.map((question, index) => {
    const open = buildQuestionEvent({
      question,
      siteId: 'sample-site',
      runDir: fixture.runDir,
      createdAt: `2026-05-11T10:${String(index).padStart(2, '0')}:00.000Z`,
    });
    return buildResolvedQuestionEvent({
      openReview: open,
      inboxMessage: inboxMessage('1', {
        message_id: `answered-${index}`,
        created_at: `2026-05-11T10:${String(index).padStart(2, '0')}:30.000Z`,
      }),
      validation: validateReply('1', open),
      resolvedAt: `2026-05-11T10:${String(index).padStart(2, '0')}:40.000Z`,
    });
  });
  await writeJsonl(fixture.eventPath, answered);

  const result = await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    pollMs: 0,
    maxIterations: 1,
    sender: fakeSender(sent),
    renderSpec: () => genericWordCounterSpec(),
    now: () => '2026-05-11T10:20:00.000Z',
  });

  const events = await readJsonl(fixture.eventPath);
  const state = JSON.parse(await readFile(fixture.statePath, 'utf8'));

  assert.equal(result.lastResult.reason, 'spec-too-generic');
  assert.equal(result.lastResult.message, SPEC_GENERIC_BLOCK_MESSAGE);
  assert.equal(events.some((event) => event.id === 'pre-agent2-spec-confirmation'), false);
  assert.equal(sent.length, 0);
  assert.equal(state.status, 'blocked_spec_too_generic');
});

test('Q12 completion writes SPEC confirmation and does not start Agent2', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await setRemoteMode(fixture.remoteStatePath, true);

  const answered = QUESTION_BANK.map((question, index) => {
    const open = buildQuestionEvent({
      question,
      siteId: 'sample-site',
      runDir: fixture.runDir,
      createdAt: `2026-05-11T10:${String(index).padStart(2, '0')}:00.000Z`,
    });
    return buildResolvedQuestionEvent({
      openReview: open,
      inboxMessage: inboxMessage('1', {
        message_id: `answered-${index}`,
        created_at: `2026-05-11T10:${String(index).padStart(2, '0')}:30.000Z`,
      }),
      validation: validateReply('1', open),
      resolvedAt: `2026-05-11T10:${String(index).padStart(2, '0')}:40.000Z`,
    });
  });
  await writeJsonl(fixture.eventPath, answered);

  await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    pollMs: 0,
    maxIterations: 1,
    sender: fakeSender(sent),
    now: () => '2026-05-11T10:20:00.000Z',
  });

  const events = await readJsonl(fixture.eventPath);
  const confirmation = events.find((event) => event.id === 'pre-agent2-spec-confirmation');

  assert.equal(await exists(fixture.specPath), true);
  assert.equal(confirmation.status, 'open');
  assert.equal(confirmation.blocks, 'agent-2');
  assertSpecConfirmationCard(confirmation.message);
  assertSpecConfirmationCard(sent.at(-1));
  assert.equal(await exists(path.join(fixture.runDir, 'agent-2-output', 'site-brief.md')), false);
  assert.equal(await exists(path.join(fixture.runDir, 'site', 'package.json')), false);
});
