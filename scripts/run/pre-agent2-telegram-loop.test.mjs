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
  parseBatchAnswers,
  parseRunInput,
  renderToolsiteSpec,
  renderSpecReviewCard,
  runPreAgent2TelegramLoop,
  sanitizeSpecContent,
  shouldGenerateSpec,
  splitTelegramMessages,
  validateReply,
} from './pre-agent2-telegram-loop.mjs';
import {
  attachmentPurpose,
  inputRequiresAttachment,
  planPreAgent2Questions,
} from './pre-agent2-question-planner.mjs';

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
  assert.match(text, /【Toolsite 需求确认】/);
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

function wordCounterInputMarkdown() {
  return [
    '# Run Input',
    '',
    '- Site ID: wordcounter-cn-card-test',
    '- Target domain: wordcounter-cn-card-test.local',
    '- Primary keyword: word counter',
    '',
    '## Pre-Agent2 required user inputs',
    '',
    '- Keyword / 关键词: word counter',
    '- Target Domain / 目标域名: wordcounter-cn-card-test.local',
    '- UI Reference / UI 参考: Stripe',
    '- UX Reference / UX 参考: wordcounter.net',
    '- Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点: 第一屏必须直接可用；输入文本后实时展示 words / characters / sentences / paragraphs / reading time / speaking time；浏览器本地处理；不要登录；不要后端；不要数据库；不要 AI 改写；不要历史保存；页面底部可以有 /privacy /terms /sitemap.xml /robots.txt。',
    '',
  ].join('\n');
}

function fourOhOneKInputMarkdown({ concise = false } = {}) {
  const extra = concise
    ? '希望页面简单。'
    : '对老人家友好，大字体、高对比、输入简单；第一屏就是计算器；用我发的黑白人物插画做点缀；只做 educational estimate，不提供投资/税务建议；不要登录、不要后端、不要数据库、不要保存用户输入。';
  return [
    '# Run Input',
    '',
    '- Site ID: 401k-calculator',
    '- Target domain: 401k-calculator.net',
    '- Primary keyword: 401K Calculator',
    '',
    '## Pre-Agent2 required user inputs',
    '',
    '- Keyword / 关键词: 401K Calculator',
    '- Target Domain / 目标域名: 401k-calculator.net',
    '- UI Reference / UI 参考: https://www.usa.gov',
    '- UX Reference / UX 参考: https://www.calculator.net/401k-calculator.html',
    `- Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点: ${extra}`,
    '',
    '## Input assets',
    '',
    '- image: input-assets/01-reference.jpg (purpose: illustration_reference, source: /tmp/reference.jpg, telegram_file_id: tg-photo)',
    '',
  ].join('\n');
}

test('SPEC sanitizer removes internal meta instructions and dirty snippets', () => {
  const dirtySpec = [
    '# Toolsite SPEC: 401k-calculator',
    '',
    '## Tool Purpose',
    '',
    '- 工具目标需按已确认 SPEC 执行，不能保留英文整句说明。',
    '- 401K Calculator should keep expected return and employer match visible.',
    '- https://www.calculator.net/401k-calculator.html%EF%BC%9AThis is a copied source snippet.',
    '- Source title: 401K Calculator - Calculator.net',
    '- blocks = agent-2',
    '',
    '## Agent Workflow Boundary',
    '',
    '- Agent2 waits for confirmation.',
    '',
    '## User Confirmation',
    '',
    '- [ ] User confirmed this Toolsite SPEC before Agent2 starts.',
  ].join('\n');

  const clean = sanitizeSpecContent(dirtySpec);

  assert.doesNotMatch(clean, /需按已确认 SPEC 执行/);
  assert.doesNotMatch(clean, /不能保留英文整句说明/);
  assert.doesNotMatch(clean, /Agent Workflow Boundary/);
  assert.doesNotMatch(clean, /User Confirmation/);
  assert.doesNotMatch(clean, /blocks = agent-2/);
  assert.doesNotMatch(clean, /%EF%BC%9A/);
  assert.doesNotMatch(clean, /Source title/);
  assert.match(clean, /401K Calculator/);
  assert.match(clean, /expected return/);
  assert.match(clean, /employer match/);
});

test('401K SPEC renders image attachment as design reference', () => {
  const intake = parseRunInput(fourOhOneKInputMarkdown());
  const spec = renderToolsiteSpec({
    siteId: '401k-calculator',
    intake,
    answeredEvents: [],
    allowEarlySpec: true,
  });
  const card = renderSpecReviewCard({
    specText: spec,
    specPath: 'runs/401k-calculator/toolsite-spec.md',
  });

  assert.match(spec, /input-assets\/01-reference\.jpg/);
  assert.match(spec, /illustration_reference \/ design_reference/);
  assert.match(spec, /页面点缀和视觉风格参考/);
  assert.doesNotMatch(spec, /这张图是什么意思|是否使用这张图片/);
  assert.match(card, /input-assets\/01-reference\.jpg/);
  assert.match(card, /页面点缀和视觉风格参考/);
});

test('401K SPEC content contract rejects internal meta and dirty link residue', () => {
  const intake = parseRunInput(fourOhOneKInputMarkdown());
  const spec = renderToolsiteSpec({
    siteId: '401k-calculator',
    intake,
    answeredEvents: [],
    allowEarlySpec: true,
  });
  const card = renderSpecReviewCard({
    specText: spec,
    specPath: 'runs/401k-calculator/toolsite-spec.md',
  });
  const combined = `${spec}\n${card}`;

  assert.doesNotMatch(combined, /需按已确认 SPEC 执行/);
  assert.doesNotMatch(combined, /不能保留英文整句说明/);
  assert.doesNotMatch(combined, /Agent Workflow Boundary/);
  assert.doesNotMatch(combined, /User Confirmation/);
  assert.doesNotMatch(combined, /human_review|blocks = agent-2/);
  assert.doesNotMatch(combined, /generated before dynamic gap analysis|fixed generic Pre-Agent2/);
  assert.doesNotMatch(combined, /calculator\.net\/401k-calculator\.html%EF%BC%9A/);
  assert.doesNotMatch(combined, /Search Results?|source title|result snippet/i);
  assert.match(combined, /401K Calculator/);
  assert.match(combined, /expected annual return|expected return/);
  assert.match(combined, /employer match/);
});

function wordCounterIntake() {
  return {
    keyword: 'word counter',
    target_domain: 'wordcounter-cn-card-test.local',
    ui_reference: 'Stripe',
    ux_reference: 'wordcounter.net',
    extra_notes:
      '第一屏必须直接可用；输入文本后实时展示 words / characters / sentences / paragraphs / reading time / speaking time；浏览器本地处理；不要登录；不要后端；不要数据库；不要 AI 改写；不要历史保存；页面底部可以有 /privacy /terms /sitemap.xml /robots.txt。',
  };
}

function answeredQuestionEvents({
  siteId = 'wordcounter-cn-card-test',
  runDir = 'runs/wordcounter-cn-card-test',
  answers = {},
} = {}) {
  return QUESTION_BANK.map((question, index) => {
    const answer = answers[question.number] || '1';
    const open = buildQuestionEvent({
      question,
      siteId,
      runDir,
      createdAt: `2026-05-11T10:${String(index).padStart(2, '0')}:00.000Z`,
    });
    return buildResolvedQuestionEvent({
      openReview: open,
      inboxMessage: inboxMessage(answer, {
        message_id: `answered-${index}`,
        created_at: `2026-05-11T10:${String(index).padStart(2, '0')}:30.000Z`,
      }),
      validation: validateReply(answer, open),
      resolvedAt: `2026-05-11T10:${String(index).padStart(2, '0')}:40.000Z`,
    });
  });
}

function wordCounterQualityAnswers() {
  return {
    1: '1',
    2: '1',
    3: '单一文本输入框，用户粘贴或输入文本后实时输出 words、characters、sentences、paragraphs、reading time、speaking time。',
    4: 'word counter 的结果区必须突出 words 和 characters，并同时展示 sentences、paragraphs、reading time、speaking time，结果要实时变化且方便复制参考。',
    5: '2',
    6: '4',
    7: '3',
    8: '1',
    9: '1',
    10: '1',
    11: '3',
    12: '1',
  };
}

function batchAnswersMarkdown(answers = wordCounterQualityAnswers()) {
  return [
    'Pre-Agent2 Answers:',
    ...QUESTION_BANK.map((question) => `Q${question.number}: ${answers[question.number] || '1'}`),
    '',
  ].join('\n');
}

function markdownSection(text, heading) {
  const lines = String(text || '').split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return '';
  const body = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) break;
    body.push(lines[index]);
  }
  return body.join('\n').trim();
}

function reviewCardSection(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(text || '').match(new RegExp(`${escaped}\\n([\\s\\S]*?)(?=\\n\\d+\\. |\\n附：|$)`));
  return match?.[1]?.trim() || '';
}

function duplicateBulletLines(text) {
  const seen = new Set();
  const duplicates = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!/^\s*-\s+/.test(line)) continue;
    const normalized = line
      .replace(/^\s*-\s+/, '')
      .replace(/[。.!！?？]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) duplicates.push(line.trim());
    seen.add(normalized);
  }
  return duplicates;
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

test('dynamic targeted question is written as an open review and pushed to Telegram', async () => {
  const fixture = await makeFixture();
  const sent = [];

  const result = await startLoopOnce(fixture, sent);
  const events = await exists(fixture.eventPath) ? await readJsonl(fixture.eventPath) : [];

  assert.equal(result.ok, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'pre-agent2-dynamic-sample-tool-inputs');
  assert.equal(events[0].status, 'open');
  assert.match(events[0].message, /sample tool/);
  assert.doesNotMatch(events[0].message, /这个工具站最核心要帮用户完成什么任务/);
  assert.deepEqual(events[0].allowed_replies, ['1', '2', '3', '4', '5']);
  assert.equal(events[0].allow_custom_text, true);
  assert.equal(events[0].reply_mode, 'single_choice_with_custom_text');
  assert.equal(sent.length, 1);
  assert.match(sent[0], /sample tool/);
  assert.doesNotMatch(sent[0], /^Q1\./);
});

test('production complete 401K intake never sends generic Q1 and opens a targeted question', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await setRemoteMode(fixture.remoteStatePath, true);
  await writeFile(path.join(fixture.runDir, 'input.md'), fourOhOneKInputMarkdown());

  await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    pollMs: 0,
    maxIterations: 1,
    sender: fakeSender(sent),
    now: () => '2026-05-11T10:00:00.000Z',
  });

  const events = await exists(fixture.eventPath) ? await readJsonl(fixture.eventPath) : [];
  const combined = `${sent.join('\n')}\n${events.map((event) => event.message).join('\n')}`;
  const question = events.find((event) => event.review_type === 'pre_agent2_interview_question');

  assert.equal(question.status, 'open');
  assert.match(question.message, /401K Calculator/);
  assert.match(question.message, /计算复杂度/);
  assert.equal(events.some((event) => event.id === 'pre-agent2-spec-confirmation'), false);
  assert.doesNotMatch(combined, /这个工具站最核心要帮用户完成什么任务/);
  assert.doesNotMatch(combined, /Pre-Agent2 Q1/);
  assert.doesNotMatch(combined, /这张图是什么意思|重新解释.*图片|附件.*什么意思/);
});

test('production 401K incomplete detail intake creates targeted project-specific question', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await setRemoteMode(fixture.remoteStatePath, true);
  await writeFile(path.join(fixture.runDir, 'input.md'), fourOhOneKInputMarkdown({ concise: true }));

  await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    pollMs: 0,
    maxIterations: 1,
    sender: fakeSender(sent),
    now: () => '2026-05-11T10:00:00.000Z',
  });

  const events = await readJsonl(fixture.eventPath);
  assert.equal(events[0].review_type, 'pre_agent2_interview_question');
  assert.match(events[0].message, /401K Calculator/);
  assert.match(events[0].message, /401k|retirement|calculator/i);
  assert.doesNotMatch(events[0].message, /这个工具站最核心要帮用户完成什么任务/);
});

test('image attachments are treated as design references, not requirement questions', () => {
  const intake = {
    keyword: '401K Calculator',
    target_domain: '401k-calculator.net',
    ui_reference: 'https://www.usa.gov',
    ux_reference: 'https://www.calculator.net/401k-calculator.html',
    extra_notes: '第一屏就是计算器；参考我发的黑白人物插画做页面点缀；不要登录；不要后端。',
  };
  const plan = planPreAgent2Questions({
    intake,
    attachments: [{ kind: 'image', local_path: 'input-assets/01-reference.jpg' }],
    answeredEvents: [],
  });
  const visibleQuestions = plan.questions.map((question) => question.message).join('\n');

  assert.equal(inputRequiresAttachment(intake), true);
  assert.equal(attachmentPurpose(intake), 'illustration_reference');
  assert.doesNotMatch(visibleQuestions, /这张图是什么意思|你想怎么用这张图|是否要使用这张图片|图片放不放页面|附件用途确认/);
});

test('resolved 401K complexity answer after SPEC change request asks defaults instead of generating SPEC', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await setRemoteMode(fixture.remoteStatePath, true);
  await writeFile(path.join(fixture.runDir, 'input.md'), fourOhOneKInputMarkdown());
  await writeJsonl(fixture.eventPath, [
    {
      schema_version: 'human-review-event.v1',
      type: 'human_review',
      review_type: 'pre_agent2_spec_confirmation',
      id: 'pre-agent2-spec-confirmation',
      site_id: '401k-calculator',
      run_dir: 'runs/401k-calculator',
      phase: 'pre-agent2',
      agent: 'pre-agent2-toolsite-spec',
      status: 'resolved',
      blocking: false,
      blocks: 'agent-2',
      title: 'Pre-Agent2 SPEC 确认',
      message: '【Toolsite 需求确认】',
      expected_reply: '回复：确认 SPEC，或回复：修改：...',
      resolution_text: '修改：先问 401K Calculator 计算复杂度。',
      change_requested: true,
      created_at: '2026-05-11T10:00:00.000Z',
      resolved_at: '2026-05-11T10:00:10.000Z',
      created_by: 'codex',
    },
    {
      schema_version: 'human-review-event.v1',
      type: 'human_review',
      review_type: 'pre_agent2_interview_question',
      id: 'pre-agent2-dynamic-401k-calculator-complexity',
      site_id: '401k-calculator',
      run_dir: 'runs/401k-calculator',
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
      created_at: '2026-05-11T10:01:00.000Z',
      created_by: 'codex',
    },
  ]);
  await writeJsonl(fixture.inboxPath, [
    inboxMessage('2', {
      message_id: 'answer-2',
      created_at: '2026-05-11T10:02:00.000Z',
    }),
  ]);

  await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    pollMs: 0,
    maxIterations: 3,
    sender: fakeSender(sent),
    now: () => '2026-05-11T10:03:00.000Z',
  });

  const events = await readJsonl(fixture.eventPath);
  const resolvedQuestion = events.find(
    (event) => event.id === 'pre-agent2-dynamic-401k-calculator-complexity' && event.status === 'resolved',
  );
  const defaultsQuestion = events.find(
    (event) => event.id === 'pre-agent2-dynamic-401k-calculator-default-assumptions' && event.status === 'open',
  );

  assert.equal(resolvedQuestion.selected_option, '2');
  assert.match(defaultsQuestion.message, /默认假设/);
  assert.match(defaultsQuestion.message, /expected return 6%/);
  assert.equal(events.some((event) => event.id === 'pre-agent2-spec-confirmation' && event.status === 'open'), false);
  assert.equal(sent.some((message) => message.includes('401K Calculator 的默认假设要怎么设置')), true);
  assert.equal(sent.some((message) => message.includes('【Toolsite 需求确认】')), false);
  assert.equal(await exists(path.join(fixture.runDir, 'agent-2-output/site-brief.md')), false);
});

test('legal option 4 resolves, records QA as option, and enters next targeted question', async () => {
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
  const resolved = events.find((event) => event.id === 'pre-agent2-dynamic-sample-tool-inputs' && event.status === 'resolved');
  const q2 = events.find((event) => event.id === 'pre-agent2-dynamic-sample-tool-results' && event.status === 'open');
  const qa = await readFile(fixture.qaPath, 'utf8');

  assert.equal(resolved.answer_type, 'option');
  assert.equal(resolved.selected_option, '4');
  assert.equal(q2.status, 'open');
  assert.match(qa, /Answer type: option/);
  assert.match(qa, /Answer: 4/);
  assert.equal(sent.length, 2);
  assert.match(sent[1], /sample tool/);
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
    assert.equal(events.some((event) => event.id === 'pre-agent2-dynamic-sample-tool-results'), false);
    assert.equal(await exists(fixture.qaPath), false);
    assert.equal(await exists(fixture.specPath), false);
    assert.equal(sent.length, 2);
    assert.match(sent[1], /^你回复的选项不在本题范围内/);
    assert.match(sent[1], /sample tool/);
    assert.doesNotMatch(sent[1], /这个工具站最核心要帮用户完成什么任务/);
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

test('information-sufficient intake can generate SPEC without fixed question minimum', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await setRemoteMode(fixture.remoteStatePath, true);
  await writeFile(path.join(fixture.runDir, 'input.md'), wordCounterInputMarkdown());
  assert.equal(shouldGenerateSpec({
    answeredEvents: [],
    intake: wordCounterIntake(),
    allowEarlySpec: false,
  }), true);

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
  assert.match(spec, /word counter/);
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

test('generated word counter SPEC result experience names keyword and metrics', () => {
  const spec = renderToolsiteSpec({
    siteId: 'wordcounter-cn-card-test',
    intake: wordCounterIntake(),
    answeredEvents: answeredQuestionEvents(),
  });
  const resultExperience = markdownSection(spec, 'Result Experience');

  assert.match(resultExperience, /word counter/);
  assert.match(resultExperience, /words/);
  assert.match(resultExperience, /characters/);
  assert.match(resultExperience, /reading time/);
  assert.match(resultExperience, /speaking time/);
});

test('word counter generated SPEC passes specificity before confirmation card', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await setRemoteMode(fixture.remoteStatePath, true);
  await writeFile(path.join(fixture.runDir, 'input.md'), wordCounterInputMarkdown());
  await writeJsonl(fixture.eventPath, answeredQuestionEvents({
    siteId: 'sample-site',
    runDir: fixture.runDir,
  }));

  const result = await runPreAgent2TelegramLoop({
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

  assert.notEqual(result.lastResult.reason, 'spec-too-generic');
  assert.equal(confirmation.status, 'open');
  assert.equal(confirmation.blocks, 'agent-2');
  assertChineseFirstSpecCard(confirmation.message);
  assertChineseFirstSpecCard(sent.at(-1));
});

test('full word counter SPEC quality contract passes without manual Telegram dry run', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await setRemoteMode(fixture.remoteStatePath, true);
  await writeFile(path.join(fixture.runDir, 'input.md'), wordCounterInputMarkdown());
  await writeJsonl(fixture.eventPath, answeredQuestionEvents({
    siteId: 'sample-site',
    runDir: fixture.runDir,
    answers: wordCounterQualityAnswers(),
  }));

  const result = await runPreAgent2TelegramLoop({
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
  const spec = await readFile(fixture.specPath, 'utf8');
  const message = confirmation.message;
  const nonGoals = markdownSection(spec, 'Non-goals');
  const pageBoundary = markdownSection(spec, 'Page Boundary');
  const seoBaseline = markdownSection(spec, 'SEO Baseline');
  const resultExperience = markdownSection(spec, 'Result Experience');
  const cardResultExperience = reviewCardSection(message, '核心结果展示');
  const forbiddenConflictPatterns = [
    /后续高级功能可以需要上传或 API/,
    /可以需要上传或 API/,
    /backend later/i,
    /database later/i,
    /API advanced features/i,
  ];
  const forbiddenCopyPatterns = [
    /任何搜索内容/,
    /。。/,
    /、and speaking time/i,
    /and speaking time/i,
  ];

  assert.notEqual(result.lastResult.reason, 'spec-too-generic');
  assert.equal(await exists(fixture.specPath), true);
  assert.equal(confirmation.status, 'open');
  assert.equal(confirmation.blocks, 'agent-2');
  assertChineseFirstSpecCard(message);
  assertChineseFirstSpecCard(sent.at(-1));
  for (const pattern of forbiddenConflictPatterns) {
    assert.doesNotMatch(spec, pattern);
    assert.doesNotMatch(message, pattern);
  }
  assert.doesNotMatch(nonGoals, /工具下方提供 FAQ 和使用说明/);
  assert.match(`${pageBoundary}\n${seoBaseline}`, /FAQ/);
  assert.match(`${pageBoundary}\n${seoBaseline}`, /使用说明/);
  for (const pattern of forbiddenCopyPatterns) {
    assert.doesNotMatch(message, pattern);
  }
  for (const term of ['word counter', 'words', 'characters', 'sentences', 'paragraphs', 'reading time', 'speaking time']) {
    assert.match(resultExperience, new RegExp(term));
    assert.match(cardResultExperience, new RegExp(term));
  }
  assert.deepEqual(duplicateBulletLines(message), []);
  assert.equal(await exists(path.join(fixture.runDir, 'agent-2-output', 'site-brief.md')), false);
  assert.equal(await exists(path.join(fixture.runDir, 'site', 'package.json')), false);
});

test('complete intake with answers file generates SPEC without Telegram inbox polling', async () => {
  const fixture = await makeFixture();
  const sent = [];
  const answersFile = path.join(fixture.runDir, 'pre-agent2-answers.md');
  await setRemoteMode(fixture.remoteStatePath, true);
  await writeFile(path.join(fixture.runDir, 'input.md'), wordCounterInputMarkdown());
  await writeFile(fixture.inboxPath, 'not valid jsonl');
  await writeFile(answersFile, batchAnswersMarkdown());

  const result = await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    answersFile,
    pollMs: 0,
    maxIterations: 20,
    sender: fakeSender(sent),
    now: () => '2026-05-11T10:20:00.000Z',
  });

  const events = await readJsonl(fixture.eventPath);
  const confirmation = events.find((event) => event.id === 'pre-agent2-spec-confirmation');
  const qa = await readFile(fixture.qaPath, 'utf8');

  assert.equal(result.lastResult.reason, 'awaiting-spec-confirmation');
  assert.equal(events.some((event) => event.review_type === 'pre_agent2_interview_question'), false);
  assert.equal(confirmation.status, 'open');
  assert.equal(confirmation.blocks, 'agent-2');
  assert.equal(await exists(fixture.specPath), true);
  assert.match(qa, /Question rounds: 0/);
  assert.equal(sent.some((message) => /^Q\d+\./.test(message)), false);
  assertSpecConfirmationCard(sent.at(-1));
});

test('invalid numeric batch answer blocks and does not generate SPEC', async () => {
  const fixture = await makeFixture();
  const sent = [];
  const answersFile = path.join(fixture.runDir, 'pre-agent2-answers.md');
  await setRemoteMode(fixture.remoteStatePath, true);
  await writeFile(answersFile, 'Pre-Agent2 Answers:\nQ1: 8\n');
  await writeFile(fixture.inboxPath, 'not valid jsonl');

  const result = await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    answersFile,
    pollMs: 0,
    maxIterations: 3,
    sender: fakeSender(sent),
    now: () => '2026-05-11T10:20:00.000Z',
  });

  const events = await exists(fixture.eventPath) ? await readJsonl(fixture.eventPath) : [];
  const state = JSON.parse(await readFile(fixture.statePath, 'utf8'));

  assert.equal(result.lastResult.reason, 'invalid-batch-answer');
  assert.equal(result.lastResult.validation.value, '8');
  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'pre-agent2-dynamic-sample-tool-inputs');
  assert.equal(events[0].status, 'open');
  assert.equal(await exists(fixture.qaPath), false);
  assert.equal(await exists(fixture.specPath), false);
  assert.equal(sent.length, 0);
  assert.equal(state.status, 'blocked_invalid_batch_answer');
});

test('batch answers still passes full word counter SPEC quality contract', async () => {
  const fixture = await makeFixture();
  const sent = [];
  const answersFile = path.join(fixture.runDir, 'pre-agent2-answers.md');
  await setRemoteMode(fixture.remoteStatePath, true);
  await writeFile(path.join(fixture.runDir, 'input.md'), wordCounterInputMarkdown());
  await writeFile(answersFile, batchAnswersMarkdown(wordCounterQualityAnswers()));

  await runPreAgent2TelegramLoop({
    runDir: fixture.runDir,
    inboxPath: fixture.inboxPath,
    remoteStatePath: fixture.remoteStatePath,
    telegramEnvPath: fixture.telegramEnvPath,
    answersFile,
    pollMs: 0,
    maxIterations: 20,
    sender: fakeSender(sent),
    now: () => '2026-05-11T10:20:00.000Z',
  });

  const events = await readJsonl(fixture.eventPath);
  const confirmation = events.find((event) => event.id === 'pre-agent2-spec-confirmation');
  const spec = await readFile(fixture.specPath, 'utf8');
  const resultExperience = markdownSection(spec, 'Result Experience');
  const cardResultExperience = reviewCardSection(confirmation.message, '核心结果展示');

  assert.equal(confirmation.status, 'open');
  assert.equal(confirmation.blocks, 'agent-2');
  assertChineseFirstSpecCard(confirmation.message);
  for (const term of ['word counter', 'words', 'characters', 'sentences', 'paragraphs', 'reading time', 'speaking time']) {
    assert.match(resultExperience, new RegExp(term));
    assert.match(cardResultExperience, new RegExp(term));
  }
  assert.doesNotMatch(spec, /后续高级功能可以需要上传或 API/);
  assert.equal(await exists(path.join(fixture.runDir, 'agent-2-output', 'site-brief.md')), false);
  assert.equal(await exists(path.join(fixture.runDir, 'site', 'package.json')), false);
});

test('batch answers parser accepts multiline custom answers', () => {
  const answers = parseBatchAnswers([
    'Pre-Agent2 Answers:',
    'Q1: 1',
    'Q2: 第一行',
    '第二行',
    'Q3：3',
    '',
  ].join('\n'));

  assert.equal(answers.get(1), '1');
  assert.equal(answers.get(2), '第一行\n第二行');
  assert.equal(answers.get(3), '3');
});

test('generic SPEC is not sent for user confirmation', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await setRemoteMode(fixture.remoteStatePath, true);
  await writeFile(path.join(fixture.runDir, 'input.md'), wordCounterInputMarkdown());

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

  const events = await exists(fixture.eventPath) ? await readJsonl(fixture.eventPath) : [];
  const state = JSON.parse(await readFile(fixture.statePath, 'utf8'));

  assert.equal(result.lastResult.reason, 'spec-too-generic');
  assert.equal(result.lastResult.message, SPEC_GENERIC_BLOCK_MESSAGE);
  assert.equal(events.some((event) => event.id === 'pre-agent2-spec-confirmation'), false);
  assert.equal(sent.length, 0);
  assert.equal(state.status, 'blocked_spec_too_generic');
});

test('hard cap completion writes SPEC confirmation and does not start Agent2', async () => {
  const fixture = await makeFixture();
  const sent = [];
  await setRemoteMode(fixture.remoteStatePath, true);
  await writeFile(path.join(fixture.runDir, 'input.md'), wordCounterInputMarkdown());

  const answered = Array.from({ length: 30 }, (_, index) => QUESTION_BANK[index % QUESTION_BANK.length]).map((question, index) => {
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
    maxQuestions: 30,
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
