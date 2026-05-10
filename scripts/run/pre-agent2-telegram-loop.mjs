#!/usr/bin/env node
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_HERMES_INBOX =
  '/Users/dom/agents/hermes-toolsite-monitor/hermes-home/state/toolsite-inbox.jsonl';
export const DEFAULT_HERMES_REMOTE_STATE =
  '/Users/dom/agents/hermes-toolsite-monitor/hermes-home/state/toolsite-remote.json';
export const DEFAULT_TELEGRAM_ENV =
  '/Users/dom/agents/hermes-toolsite-monitor/hermes-home/.env';

export const REMOTE_DISABLED_MESSAGE =
  '远程模式未开启，拒绝启动 Pre-Agent2 Telegram 问答循环。';
export const INVALID_REPLY_MESSAGE =
  '你回复的选项不在本题范围内，请回复 1 / 2 / 3 / 4 / 5，或直接输入自定义描述。';

const HUMAN_REVIEW_SCHEMA_VERSION = 'human-review-event.v1';
const STATE_SCHEMA_VERSION = 'pre-agent2-telegram-loop-state.v1';
const QUESTION_REPLY_MODE = 'single_choice_with_custom_text';
const DEFAULT_ALLOWED_REPLIES = ['1', '2', '3', '4', '5'];
const DEFAULT_POLL_MS = 10_000;
const DEFAULT_MAX_QUESTIONS = 30;
const ABSOLUTE_MAX_QUESTIONS = 30;
const DEFAULT_SPEC_TARGET_ROUNDS = 12;
const SPEC_CONFIRMATION_ID = 'pre-agent2-spec-confirmation';

export const USER_DECISION_AREAS = [
  'Tool Purpose',
  'First Viewport UX',
  'Input / Output Model',
  'Result Experience',
  'UI / UX Direction',
  'Non-goals',
];

export const QUESTION_BANK = [
  {
    number: 1,
    id: 'pre-agent2-q1-tool-purpose',
    title: 'Pre-Agent2 Q1：工具目的',
    decision_area: 'Tool Purpose',
    message:
      'Q1. 这个工具站最核心要帮用户完成什么任务？\n\n' +
      '1. 快速完成一个明确计算/转换/检查任务\n' +
      '2. 帮用户做内容、写作或 SEO 判断\n' +
      '3. 帮用户整理输入并输出可复制结果\n' +
      '4. 做一个专业但轻量的工作流工具\n' +
      '5. 其他，请直接描述',
    option_decisions: {
      1: '工具目的偏快速完成明确计算、转换或检查任务。',
      2: '工具目的偏帮助用户做内容、写作或 SEO 判断。',
      3: '工具目的偏整理输入并输出可复制结果。',
      4: '工具目的偏专业但轻量的工作流工具。',
    },
  },
  {
    number: 2,
    id: 'pre-agent2-q2-first-viewport',
    title: 'Pre-Agent2 Q2：第一屏体验',
    decision_area: 'First Viewport UX',
    message:
      'Q2. 第一屏应该优先呈现什么体验？\n\n' +
      '1. 用户一打开页面就能直接输入并得到结果\n' +
      '2. 上方一句简短说明，下方立即是工具主体\n' +
      '3. 工具主体和关键结果并排展示\n' +
      '4. 先突出核心结果，再让用户补充输入\n' +
      '5. 其他，请直接描述',
    option_decisions: {
      1: '第一屏优先直接可用，用户打开页面即可输入并得到结果。',
      2: '第一屏使用短说明加工具主体的结构。',
      3: '第一屏将工具主体和关键结果并排展示。',
      4: '第一屏先突出核心结果，再让用户补充输入。',
    },
  },
  {
    number: 3,
    id: 'pre-agent2-q3-input-output-model',
    title: 'Pre-Agent2 Q3：输入输出模型',
    decision_area: 'Input / Output Model',
    message:
      'Q3. 输入和输出模型应该怎么设计？\n\n' +
      '1. 单一文本输入，实时输出结果\n' +
      '2. 多个输入字段，输出结构化结果\n' +
      '3. 支持粘贴内容，并提供复制结果\n' +
      '4. 支持更复杂输入，例如文件、URL 或批量数据\n' +
      '5. 其他，请直接描述',
    option_decisions: {
      1: '输入输出模型为单一文本输入并实时输出结果。',
      2: '输入输出模型为多个输入字段并输出结构化结果。',
      3: '输入输出模型支持粘贴内容并复制结果。',
      4: '输入输出模型支持更复杂输入，例如文件、URL 或批量数据。',
    },
  },
  {
    number: 4,
    id: 'pre-agent2-q4-result-experience',
    title: 'Pre-Agent2 Q4：结果体验',
    decision_area: 'Result Experience',
    message:
      'Q4. 结果区应该给用户什么感觉？\n\n' +
      '1. 非常快，核心数字或结果最醒目\n' +
      '2. 信息更完整，但保持克制和可扫描\n' +
      '3. 先给结论，再给详细解释\n' +
      '4. 支持用户复制、保存或继续调整输入\n' +
      '5. 其他，请直接描述',
    option_decisions: {
      1: '结果体验强调速度，核心数字或结果最醒目。',
      2: '结果体验信息完整但克制，便于扫描。',
      3: '结果体验先给结论，再给详细解释。',
      4: '结果体验支持复制、保存或继续调整输入。',
    },
  },
  {
    number: 5,
    id: 'pre-agent2-q5-ui-ux-direction',
    title: 'Pre-Agent2 Q5：UI / UX 方向',
    decision_area: 'UI / UX Direction',
    message:
      'Q5. UI / UX 方向更应该偏哪一种？\n\n' +
      '1. 极简白底、细边框、清晰层级\n' +
      '2. 精致 SaaS 工具感，带轻量色块和卡片\n' +
      '3. 专业编辑器/控制台感，密度更高\n' +
      '4. 更接近参考站点的交互和信息组织\n' +
      '5. 其他，请直接描述',
    option_decisions: {
      1: 'UI / UX 方向偏极简白底、细边框、清晰层级。',
      2: 'UI / UX 方向偏精致 SaaS 工具感，带轻量色块和卡片。',
      3: 'UI / UX 方向偏专业编辑器或控制台感，密度更高。',
      4: 'UI / UX 方向更接近参考站点的交互和信息组织。',
    },
  },
  {
    number: 6,
    id: 'pre-agent2-q6-non-goals',
    title: 'Pre-Agent2 Q6：第一版非目标',
    decision_area: 'Non-goals',
    message:
      'Q6. 第一版明确不要做哪些事情？\n\n' +
      '1. 不要登录、账户、保存历史\n' +
      '2. 不要 AI 生成/改写，只做工具任务\n' +
      '3. 不要复杂上传、批量处理或团队功能\n' +
      '4. 以上都不要做\n' +
      '5. 其他，请直接描述',
    option_decisions: {
      1: '第一版不要登录、账户或保存历史。',
      2: '第一版不要 AI 生成或改写，只做工具任务。',
      3: '第一版不要复杂上传、批量处理或团队功能。',
      4: '第一版不做登录、账户、保存历史、AI 改写、复杂上传、批量处理或团队功能。',
    },
  },
  {
    number: 7,
    id: 'pre-agent2-q7-result-depth',
    title: 'Pre-Agent2 Q7：结果深度',
    decision_area: 'Result Experience',
    message:
      'Q7. 结果详情应该做到什么深度？\n\n' +
      '1. 只展示核心结果，不增加解释\n' +
      '2. 增加少量说明，帮助用户理解结果\n' +
      '3. 增加可展开的详细指标或诊断\n' +
      '4. 增加可操作建议，但不喧宾夺主\n' +
      '5. 其他，请直接描述',
    option_decisions: {
      1: '结果详情只展示核心结果，不增加解释。',
      2: '结果详情增加少量说明，帮助用户理解结果。',
      3: '结果详情增加可展开的详细指标或诊断。',
      4: '结果详情增加可操作建议，但不喧宾夺主。',
    },
  },
  {
    number: 8,
    id: 'pre-agent2-q8-mobile-experience',
    title: 'Pre-Agent2 Q8：移动端体验',
    decision_area: 'First Viewport UX',
    message:
      'Q8. 移动端第一屏最需要保证什么？\n\n' +
      '1. 输入优先，结果紧跟在下方\n' +
      '2. 核心结果优先可见，输入区适中\n' +
      '3. 保持桌面布局的简化版本\n' +
      '4. 移动端只保证可用，桌面体验优先\n' +
      '5. 其他，请直接描述',
    option_decisions: {
      1: '移动端输入优先，结果紧跟在下方。',
      2: '移动端核心结果优先可见，输入区适中。',
      3: '移动端保持桌面布局的简化版本。',
      4: '移动端只保证可用，桌面体验优先。',
    },
  },
  {
    number: 9,
    id: 'pre-agent2-q9-primary-action',
    title: 'Pre-Agent2 Q9：关键成功动作',
    decision_area: 'Tool Purpose',
    message:
      'Q9. 用户完成什么动作时，算这个工具站成功？\n\n' +
      '1. 输入内容后立刻拿到可信结果\n' +
      '2. 复制结果用于别处\n' +
      '3. 根据结果做出判断或下一步操作\n' +
      '4. 反复调整输入，直到结果满意\n' +
      '5. 其他，请直接描述',
    option_decisions: {
      1: '成功动作是输入内容后立刻拿到可信结果。',
      2: '成功动作是复制结果用于别处。',
      3: '成功动作是根据结果做出判断或下一步操作。',
      4: '成功动作是反复调整输入，直到结果满意。',
    },
  },
  {
    number: 10,
    id: 'pre-agent2-q10-trust-privacy',
    title: 'Pre-Agent2 Q10：信任和隐私',
    decision_area: 'Input / Output Model',
    message:
      'Q10. 输入内容的隐私和信任预期应该怎么处理？\n\n' +
      '1. 明确本地浏览器内处理，不上传输入\n' +
      '2. 给轻量隐私提示，但不占第一屏重点\n' +
      '3. 不强调隐私，只保持简洁工具体验\n' +
      '4. 后续高级功能可以需要上传或 API\n' +
      '5. 其他，请直接描述',
    option_decisions: {
      1: '隐私预期为本地浏览器内处理，不上传输入。',
      2: '提供轻量隐私提示，但不占第一屏重点。',
      3: '不强调隐私，只保持简洁工具体验。',
      4: '后续高级功能可以需要上传或 API。',
    },
  },
  {
    number: 11,
    id: 'pre-agent2-q11-seo-boundary',
    title: 'Pre-Agent2 Q11：SEO 内容边界',
    decision_area: 'Non-goals',
    message:
      'Q11. SEO 内容和工具主体之间应该怎么平衡？\n\n' +
      '1. 第一屏只放工具，SEO 内容放在下方\n' +
      '2. 第一屏有一句说明，但不影响工具使用\n' +
      '3. 工具下方提供 FAQ 和使用说明\n' +
      '4. 页面更像完整指南，但工具仍在第一屏\n' +
      '5. 其他，请直接描述',
    option_decisions: {
      1: 'SEO 内容放在下方，第一屏只放工具。',
      2: '第一屏有一句说明，但不影响工具使用。',
      3: '工具下方提供 FAQ 和使用说明。',
      4: '页面更像完整指南，但工具仍在第一屏。',
    },
  },
  {
    number: 12,
    id: 'pre-agent2-q12-final-priority',
    title: 'Pre-Agent2 Q12：最终优先级',
    decision_area: 'UI / UX Direction',
    message:
      'Q12. 如果第一版只能把一个方向做到最好，你最看重什么？\n\n' +
      '1. 工具速度和结果准确感\n' +
      '2. 第一屏视觉完成度\n' +
      '3. 输入输出交互顺手\n' +
      '4. SEO 可读内容和工具体验平衡\n' +
      '5. 其他，请直接描述',
    option_decisions: {
      1: '最终优先工具速度和结果准确感。',
      2: '最终优先第一屏视觉完成度。',
      3: '最终优先输入输出交互顺手。',
      4: '最终优先 SEO 可读内容和工具体验平衡。',
    },
  },
];

function nowIso() {
  return new Date().toISOString();
}

function asText(value) {
  return String(value || '').trim();
}

function normalizeLabel(value) {
  return asText(value)
    .replace(/^[\s>*#\-.•\d）)、.]+/, '')
    .replace(/\s+/g, ' ')
    .replace(/[：:]/g, ':')
    .toLowerCase()
    .trim();
}

function findLabeledValue(text, aliases) {
  for (const line of String(text || '').split(/\r?\n/)) {
    const separatorIndex = line.search(/[：:]/);
    if (separatorIndex < 0) continue;
    const rawLabel = line.slice(0, separatorIndex);
    const rawValue = line.slice(separatorIndex + 1);
    const label = normalizeLabel(rawLabel);
    if (aliases.some((alias) => label.includes(normalizeLabel(alias)))) return asText(rawValue);
  }
  return '';
}

export function parseRunInput(text) {
  return {
    keyword: findLabeledValue(text, ['keyword', 'primary keyword', '关键词']),
    target_domain: findLabeledValue(text, ['target domain', 'target domain / 目标域名', '目标域名']),
    ui_reference: findLabeledValue(text, ['ui reference', 'ui reference / ui 参考', 'ui 参考']),
    ux_reference: findLabeledValue(text, ['ux reference', 'ux reference / ux 参考', 'ux 参考']),
    extra_notes: findLabeledValue(text, [
      'extra ideas',
      'constraints',
      'mimic points',
      '额外想法',
      '限制',
      '模仿点',
    ]),
  };
}

export function normalizeMaxQuestions(value = DEFAULT_MAX_QUESTIONS) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return DEFAULT_MAX_QUESTIONS;
  return Math.min(Math.floor(numeric), ABSOLUTE_MAX_QUESTIONS);
}

function parseArgs(argv) {
  const options = {
    inboxPath: DEFAULT_HERMES_INBOX,
    remoteStatePath: DEFAULT_HERMES_REMOTE_STATE,
    telegramEnvPath: DEFAULT_TELEGRAM_ENV,
    pollMs: DEFAULT_POLL_MS,
    maxQuestions: DEFAULT_MAX_QUESTIONS,
    allowEarlySpec: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run-dir') {
      options.runDir = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--inbox-path') {
      options.inboxPath = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--remote-state-path') {
      options.remoteStatePath = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--telegram-env-path') {
      options.telegramEnvPath = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--poll-ms') {
      options.pollMs = Number(argv[index + 1] || DEFAULT_POLL_MS);
      index += 1;
    } else if (arg === '--max-questions') {
      options.maxQuestions = Number(argv[index + 1] || DEFAULT_MAX_QUESTIONS);
      index += 1;
    } else if (arg === '--allow-early-spec') {
      options.allowEarlySpec = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.maxQuestions = normalizeMaxQuestions(options.maxQuestions);
  if (!options.runDir && !options.help) {
    throw new Error('Usage: node scripts/run/pre-agent2-telegram-loop.mjs --run-dir runs/<site-id>');
  }
  return options;
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return '';
    throw error;
  }
}

async function readJsonl(filePath, { missingOk = true } = {}) {
  const text = await readOptional(filePath);
  if (!text && missingOk) return [];
  const records = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch (error) {
      throw new Error(`${filePath}:${index + 1} is not valid JSONL: ${error.message}`);
    }
  }
  return records;
}

async function appendJsonl(filePath, record) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

async function readRemoteMode(remoteStatePath) {
  try {
    const state = JSON.parse(await readFile(remoteStatePath, 'utf8'));
    return state && state.remote_mode === true;
  } catch {
    return false;
  }
}

function parseEnv(text) {
  const env = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1).replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
  return env;
}

function inboxMessageKey(message) {
  return [
    asText(message.source),
    asText(message.chat_id),
    asText(message.message_id),
    asText(message.created_at),
  ].join(':');
}

function hasUsableTime(messageCreatedAt, openCreatedAt) {
  const messageTime = Date.parse(asText(messageCreatedAt));
  const openTime = Date.parse(asText(openCreatedAt));
  if (Number.isNaN(messageTime)) return false;
  if (Number.isNaN(openTime)) return true;
  return messageTime >= openTime;
}

function latestReviewStates(events) {
  const latestById = new Map();
  for (const event of events) {
    if (event && event.type === 'human_review' && event.id) latestById.set(event.id, event);
  }
  return [...latestById.values()];
}

function consumedInboxKeys(events) {
  return new Set(
    events
      .filter((event) => event && event.type === 'human_review' && event.status === 'resolved')
      .map((event) => asText(event.inbox_message_key))
      .filter(Boolean),
  );
}

function questionById(id) {
  return QUESTION_BANK.find((question) => question.id === id) || null;
}

function questionByNumber(number) {
  return QUESTION_BANK.find((question) => question.number === number) || null;
}

function reviewKey(event) {
  return `${event.id}:${event.created_at}`;
}

export function buildQuestionEvent({
  question,
  siteId,
  runDir,
  createdAt = nowIso(),
  createdBy = 'codex',
}) {
  return {
    schema_version: HUMAN_REVIEW_SCHEMA_VERSION,
    type: 'human_review',
    review_type: 'pre_agent2_interview_question',
    id: question.id,
    site_id: siteId,
    run_dir: runDir,
    phase: 'pre-agent2',
    agent: 'pre-agent2-toolsite-spec',
    status: 'open',
    blocking: true,
    blocks: 'pre-agent2-spec',
    title: question.title,
    message: question.message,
    expected_reply: '回复 1 / 2 / 3 / 4 / 5，或直接自定义描述',
    allowed_replies: [...DEFAULT_ALLOWED_REPLIES],
    allow_custom_text: true,
    reply_mode: QUESTION_REPLY_MODE,
    question_number: question.number,
    decision_area: question.decision_area,
    attachments: [],
    created_at: createdAt,
    created_by: createdBy,
  };
}

export function validateReply(text, review) {
  const value = asText(text);
  const allowed = Array.isArray(review.allowed_replies) && review.allowed_replies.length > 0
    ? review.allowed_replies.map(String)
    : DEFAULT_ALLOWED_REPLIES;

  if (/^\d+$/.test(value)) {
    if (allowed.includes(value)) {
      return { ok: true, answer_type: 'option', value };
    }
    return { ok: false, reason: 'invalid_option_number', value, allowed };
  }

  if (review.allow_custom_text !== false && value) {
    return { ok: true, answer_type: 'custom_text', value };
  }

  return { ok: false, reason: 'empty_or_custom_text_not_allowed', value, allowed };
}

export function invalidReplyPrompt(review) {
  return [INVALID_REPLY_MESSAGE, '', review.message].join('\n');
}

function latestOpenPreAgent2Review(events) {
  const open = latestReviewStates(events)
    .filter((event) => event.phase === 'pre-agent2' && event.status === 'open')
    .sort((a, b) => asText(a.created_at).localeCompare(asText(b.created_at)));
  return open.at(-1) || null;
}

function resolvedQuestionEvents(events) {
  return events
    .filter((event) => event && event.review_type === 'pre_agent2_interview_question')
    .filter((event) => event.status === 'resolved')
    .sort((a, b) => Number(a.question_number || 0) - Number(b.question_number || 0));
}

function coveredDecisionAreas(answeredEvents) {
  return new Set(answeredEvents.map((event) => asText(event.decision_area)).filter(Boolean));
}

export function shouldGenerateSpec({
  answeredEvents,
  maxQuestions = DEFAULT_MAX_QUESTIONS,
  allowEarlySpec = false,
}) {
  const answeredCount = answeredEvents.length;
  const normalizedMax = normalizeMaxQuestions(maxQuestions);
  if (answeredCount >= Math.min(DEFAULT_SPEC_TARGET_ROUNDS, normalizedMax)) return true;
  if (answeredCount >= normalizedMax) return true;
  if (!allowEarlySpec) return false;
  const covered = coveredDecisionAreas(answeredEvents);
  return USER_DECISION_AREAS.every((area) => covered.has(area));
}

function nextQuestionFor(answeredEvents, maxQuestions) {
  const nextNumber = answeredEvents.length + 1;
  if (nextNumber > normalizeMaxQuestions(maxQuestions)) return null;
  if (nextNumber > QUESTION_BANK.length) return null;
  return questionByNumber(nextNumber);
}

function selectInboxReply({ messages, openReview, reviewEvents, rejectedInboxKeys }) {
  const consumed = consumedInboxKeys(reviewEvents);
  const candidates = messages
    .filter((message) => message && message.type === 'user_message')
    .filter((message) => asText(message.text))
    .map((message) => ({ ...message, inbox_message_key: inboxMessageKey(message) }))
    .filter((message) => !consumed.has(message.inbox_message_key))
    .filter((message) => !rejectedInboxKeys.has(message.inbox_message_key))
    .filter((message) => hasUsableTime(message.created_at, openReview.created_at));

  return candidates.at(-1) || null;
}

export function buildResolvedQuestionEvent({
  openReview,
  inboxMessage,
  validation,
  resolvedAt = nowIso(),
}) {
  const inboxKey = inboxMessage.inbox_message_key || inboxMessageKey(inboxMessage);
  return {
    ...openReview,
    status: 'resolved',
    blocking: false,
    created_at: resolvedAt,
    created_by: 'codex',
    resolved_at: resolvedAt,
    resolved_by: `hermes-inbox:${asText(inboxMessage.source)}:${asText(inboxMessage.chat_id)}`,
    resolution_text: validation.value,
    resolution_source: 'hermes_inbox',
    answer_type: validation.answer_type,
    ...(validation.answer_type === 'option' ? { selected_option: validation.value } : {}),
    ...(validation.answer_type === 'custom_text' ? { custom_text: validation.value } : {}),
    inbox_message: {
      source: asText(inboxMessage.source),
      chat_id: asText(inboxMessage.chat_id),
      message_id: asText(inboxMessage.message_id),
      created_at: asText(inboxMessage.created_at),
    },
    inbox_message_key: inboxKey,
  };
}

function decisionFor(event) {
  const question = questionById(event.id);
  if (!question) return event.resolution_text;
  if (event.answer_type === 'option') {
    return question.option_decisions?.[event.resolution_text] || event.resolution_text;
  }
  return event.resolution_text;
}

export function renderQaRecord({ intake, answeredEvents }) {
  const lines = [
    '# Pre-Agent2 Q&A Record',
    '',
    '## Intake',
    '',
    `- Keyword: ${intake.keyword}`,
    `- Target domain: ${intake.target_domain}`,
    `- UI reference: ${intake.ui_reference}`,
    `- UX reference: ${intake.ux_reference}`,
    `- Extra ideas / constraints / mimic points: ${intake.extra_notes}`,
    '',
    '## Lightweight Q&A Record',
    '',
    `- Question rounds: ${answeredEvents.length}`,
    '- Complex tool: no',
    '',
    '## Answers',
  ];

  for (const event of answeredEvents) {
    lines.push(
      '',
      `### Q${event.question_number}. ${event.title}`,
      '',
      `Decision area: ${event.decision_area}`,
      `Answer type: ${event.answer_type}`,
      `Answer: ${event.resolution_text}`,
      '',
      `Decision: ${decisionFor(event)}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

async function writeQaRecord({ runDir, intake, events }) {
  const answeredEvents = resolvedQuestionEvents(events);
  await writeFile(path.join(runDir, 'pre-agent2-qa.md'), renderQaRecord({ intake, answeredEvents }), 'utf8');
}

function summaryForArea(answeredEvents, area) {
  const relevant = answeredEvents.filter((event) => event.decision_area === area);
  if (relevant.length === 0) return 'Use the baseline toolsite defaults for this area.';
  return relevant.map((event) => `- ${decisionFor(event)}`).join('\n');
}

export function renderToolsiteSpec({ siteId, intake, answeredEvents, allowEarlySpec = false }) {
  const early = answeredEvents.length < DEFAULT_SPEC_TARGET_ROUNDS && allowEarlySpec;
  return [
    `# Toolsite SPEC: ${siteId}`,
    '',
    '## Required Inputs',
    '',
    `- Keyword: ${intake.keyword}`,
    `- Target Domain: ${intake.target_domain}`,
    `- UI Reference: ${intake.ui_reference}`,
    `- UX Reference: ${intake.ux_reference}`,
    `- Extra Ideas / Constraints / Mimic Points: ${intake.extra_notes}`,
    '',
    '## Lightweight Q&A Record',
    '',
    `- Question rounds: ${answeredEvents.length}`,
    '- Complex tool: no',
    ...(early ? ['- 六个用户决策区已清楚，用户同意提前输出 SPEC。'] : []),
    '',
    '## Tool Purpose',
    '',
    summaryForArea(answeredEvents, 'Tool Purpose'),
    '',
    '## First Viewport UX',
    '',
    summaryForArea(answeredEvents, 'First Viewport UX'),
    '',
    '## Input / Output Model',
    '',
    summaryForArea(answeredEvents, 'Input / Output Model'),
    '',
    '## Result Experience',
    '',
    summaryForArea(answeredEvents, 'Result Experience'),
    '',
    '## UI / UX Direction',
    '',
    summaryForArea(answeredEvents, 'UI / UX Direction'),
    '',
    '## Non-goals',
    '',
    summaryForArea(answeredEvents, 'Non-goals'),
    '',
    '## Technical Constraints',
    '',
    'Use the repository standard static frontend tool constraints unless a later approved brief changes them. Do not add backend, database, login, or API key requirements by default.',
    '',
    '## Page Boundary',
    '',
    'Build one focused tool page for the target domain. The first viewport must prioritize the usable tool experience.',
    '',
    '## Agent Workflow Boundary',
    '',
    'Agent2 must not start until this Toolsite SPEC has explicit user confirmation and the Pre-Agent2 SPEC gate passes.',
    '',
    '## SEO Baseline',
    '',
    'Use the keyword and target domain from Required Inputs. Keep SEO content below or around the tool without blocking first-viewport tool usage.',
    '',
    '## Success Criteria Baseline',
    '',
    'A visitor can open the page, understand the tool, complete the core task, and trust the result without login or unnecessary setup.',
    '',
    '## User Confirmation',
    '',
    '- [ ] User confirmed this Toolsite SPEC before Agent2 starts.',
    '- Confirmation text:',
    '- Confirmed by:',
    '- Confirmed at:',
    '',
  ].join('\n');
}

function buildSpecConfirmationEvent({ siteId, runDir, createdAt = nowIso() }) {
  return {
    schema_version: HUMAN_REVIEW_SCHEMA_VERSION,
    type: 'human_review',
    review_type: 'pre_agent2_spec_confirmation',
    id: SPEC_CONFIRMATION_ID,
    site_id: siteId,
    run_dir: runDir,
    phase: 'pre-agent2',
    agent: 'pre-agent2-toolsite-spec',
    status: 'open',
    blocking: true,
    blocks: 'agent-2',
    title: 'Pre-Agent2 SPEC 确认',
    message: [
      `Pre-Agent2 Toolsite SPEC 草稿已生成：${path.join(runDir, 'toolsite-spec.md')}`,
      '',
      '请确认是否可以作为 Agent2 之前的建站 SPEC。',
      '',
      '回复：确认 SPEC',
      '或回复：需要修改：...',
    ].join('\n'),
    expected_reply: '回复：确认 SPEC，或回复：需要修改：...',
    attachments: [path.join(runDir, 'toolsite-spec.md')],
    created_at: createdAt,
    created_by: 'codex',
  };
}

async function ensureSpecAndConfirmation({
  runDir,
  siteId,
  intake,
  events,
  allowEarlySpec,
  now = nowIso,
}) {
  const answeredEvents = resolvedQuestionEvents(events);
  await writeFile(
    path.join(runDir, 'toolsite-spec.md'),
    renderToolsiteSpec({ siteId, intake, answeredEvents, allowEarlySpec }),
    'utf8',
  );

  const latest = latestReviewStates(events);
  if (!latest.some((event) => event.id === SPEC_CONFIRMATION_ID)) {
    const confirmation = buildSpecConfirmationEvent({
      siteId,
      runDir,
      createdAt: now(),
    });
    await appendJsonl(path.join(runDir, 'human-review-events.jsonl'), confirmation);
    return confirmation;
  }

  return latest.find((event) => event.id === SPEC_CONFIRMATION_ID) || null;
}

async function readLoopState(statePath, { siteId, runDir }) {
  try {
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    return {
      schema_version: STATE_SCHEMA_VERSION,
      site_id: siteId,
      run_dir: runDir,
      status: state.status || 'initialized',
      current_question_id: state.current_question_id || '',
      current_question_number: Number(state.current_question_number || 0),
      sent_review_keys: Array.isArray(state.sent_review_keys) ? state.sent_review_keys : [],
      rejected_inbox_keys: Array.isArray(state.rejected_inbox_keys) ? state.rejected_inbox_keys : [],
      completed_questions: Array.isArray(state.completed_questions) ? state.completed_questions : [],
      updated_at: state.updated_at || nowIso(),
    };
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error;
    return {
      schema_version: STATE_SCHEMA_VERSION,
      site_id: siteId,
      run_dir: runDir,
      status: 'initialized',
      current_question_id: '',
      current_question_number: 0,
      sent_review_keys: [],
      rejected_inbox_keys: [],
      completed_questions: [],
      updated_at: nowIso(),
    };
  }
}

async function writeLoopState(statePath, state, now = nowIso) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(
    statePath,
    `${JSON.stringify({ ...state, updated_at: now() }, null, 2)}\n`,
    'utf8',
  );
}

async function latestChatId({ inboxPath, telegramEnvPath }) {
  const env = parseEnv(await readOptional(telegramEnvPath));
  const messages = await readJsonl(inboxPath, { missingOk: true });
  const latest = messages.filter((message) => message && message.type === 'user_message' && message.chat_id).at(-1);
  return asText(latest?.chat_id || env.TELEGRAM_ALLOWED_USERS || '').split(',')[0].trim();
}

export async function sendTelegramMessage({ text, inboxPath, telegramEnvPath }) {
  const env = parseEnv(await readOptional(telegramEnvPath));
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = await latestChatId({ inboxPath, telegramEnvPath });
  if (!token || !chatId) throw new Error('Telegram token or chat id is missing');

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    body: new URLSearchParams({ chat_id: chatId, text }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) {
    throw new Error(`Telegram send failed: ${payload.description || response.status}`);
  }
  return { chat_id: chatId, message_id: String(payload.result?.message_id || '') };
}

async function sendReviewIfNeeded({ review, state, statePath, sender, now = nowIso }) {
  const key = reviewKey(review);
  if (state.sent_review_keys.includes(key)) return { sent: false };
  const result = await sender(review.message);
  state.sent_review_keys.push(key);
  state.status = review.id === SPEC_CONFIRMATION_ID ? 'awaiting_spec_confirmation' : 'waiting_for_reply';
  state.current_question_id = review.id;
  state.current_question_number = Number(review.question_number || 0);
  await writeLoopState(statePath, state, now);
  return { sent: true, result };
}

export async function runLoopIteration({
  runDir,
  inboxPath = DEFAULT_HERMES_INBOX,
  telegramEnvPath = DEFAULT_TELEGRAM_ENV,
  maxQuestions = DEFAULT_MAX_QUESTIONS,
  allowEarlySpec = false,
  sender,
  now = nowIso,
}) {
  const absoluteRunDir = path.resolve(runDir);
  const runDirForEvents = runDir;
  const siteId = path.basename(absoluteRunDir);
  const eventPath = path.join(absoluteRunDir, 'human-review-events.jsonl');
  const inputPath = path.join(absoluteRunDir, 'input.md');
  const statePath = path.join(absoluteRunDir, 'pre-agent2-telegram-loop-state.json');
  const intake = parseRunInput(await readFile(inputPath, 'utf8'));
  const state = await readLoopState(statePath, { siteId, runDir: runDirForEvents });
  const reviewEvents = await readJsonl(eventPath, { missingOk: true });
  let openReview = latestOpenPreAgent2Review(reviewEvents);
  const answeredEvents = resolvedQuestionEvents(reviewEvents);
  const send = sender || ((text) => sendTelegramMessage({ text, inboxPath, telegramEnvPath }));

  if (!openReview) {
    if (shouldGenerateSpec({ answeredEvents, maxQuestions, allowEarlySpec })) {
      openReview = await ensureSpecAndConfirmation({
        runDir: absoluteRunDir,
        siteId,
        intake,
        events: reviewEvents,
        allowEarlySpec,
        now,
      });
    } else {
      const nextQuestion = nextQuestionFor(answeredEvents, maxQuestions);
      if (!nextQuestion) {
        openReview = await ensureSpecAndConfirmation({
          runDir: absoluteRunDir,
          siteId,
          intake,
          events: reviewEvents,
          allowEarlySpec,
          now,
        });
      } else {
        openReview = buildQuestionEvent({
          question: nextQuestion,
          siteId,
          runDir: runDirForEvents,
          createdAt: now(),
        });
        await appendJsonl(eventPath, openReview);
      }
    }
  }

  if (!openReview) {
    state.status = 'stopped';
    await writeLoopState(statePath, state, now);
    return { action: 'stopped', reason: 'no-open-review' };
  }

  await sendReviewIfNeeded({ review: openReview, state, statePath, sender: send, now });

  if (openReview.id === SPEC_CONFIRMATION_ID) {
    state.status = 'awaiting_spec_confirmation';
    await writeLoopState(statePath, state, now);
    return { action: 'stopped', reason: 'awaiting-spec-confirmation', review: openReview };
  }

  if (openReview.review_type !== 'pre_agent2_interview_question') {
    return { action: 'waiting', reason: 'non-question-open-review', review: openReview };
  }

  const inboxMessages = await readJsonl(inboxPath, { missingOk: true });
  const rejectedInboxKeys = new Set(state.rejected_inbox_keys);
  const inboxMessage = selectInboxReply({
    messages: inboxMessages,
    openReview,
    reviewEvents,
    rejectedInboxKeys,
  });

  if (!inboxMessage) {
    state.status = 'waiting_for_reply';
    await writeLoopState(statePath, state, now);
    return { action: 'waiting', reason: 'no-inbox-reply', review: openReview };
  }

  const validation = validateReply(inboxMessage.text, openReview);
  if (!validation.ok) {
    if (!rejectedInboxKeys.has(inboxMessage.inbox_message_key)) {
      await send(invalidReplyPrompt(openReview));
      state.rejected_inbox_keys.push(inboxMessage.inbox_message_key);
    }
    state.status = 'waiting_for_valid_reply';
    await writeLoopState(statePath, state, now);
    return {
      action: 'invalid-reply',
      reason: validation.reason,
      review: openReview,
      inboxMessage,
    };
  }

  const resolvedEvent = buildResolvedQuestionEvent({
    openReview,
    inboxMessage,
    validation,
    resolvedAt: now(),
  });
  await appendJsonl(eventPath, resolvedEvent);
  const updatedEvents = [...reviewEvents, resolvedEvent];
  await writeQaRecord({ runDir: absoluteRunDir, intake, events: updatedEvents });

  state.status = 'advanced';
  state.current_question_id = '';
  state.current_question_number = 0;
  state.completed_questions = resolvedQuestionEvents(updatedEvents).map((event) => event.question_number);
  await writeLoopState(statePath, state, now);

  return {
    action: 'resolved',
    review: openReview,
    inboxMessage,
    resolvedEvent,
  };
}

export async function runPreAgent2TelegramLoop({
  runDir,
  inboxPath = DEFAULT_HERMES_INBOX,
  remoteStatePath = DEFAULT_HERMES_REMOTE_STATE,
  telegramEnvPath = DEFAULT_TELEGRAM_ENV,
  pollMs = DEFAULT_POLL_MS,
  maxQuestions = DEFAULT_MAX_QUESTIONS,
  allowEarlySpec = false,
  sender,
  maxIterations = Infinity,
  now = nowIso,
} = {}) {
  if (!runDir) throw new Error('--run-dir is required');
  const remoteMode = await readRemoteMode(remoteStatePath);
  if (!remoteMode) {
    return {
      ok: false,
      code: 'remote-disabled',
      message: REMOTE_DISABLED_MESSAGE,
    };
  }

  const normalizedMaxQuestions = normalizeMaxQuestions(maxQuestions);
  let lastResult = null;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations += 1;
    lastResult = await runLoopIteration({
      runDir,
      inboxPath,
      telegramEnvPath,
      maxQuestions: normalizedMaxQuestions,
      allowEarlySpec,
      sender,
      now,
    });

    if (lastResult.action === 'stopped') break;
    if (lastResult.action === 'resolved') continue;
    if (pollMs > 0) await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return {
    ok: true,
    code: 'loop-complete',
    iterations,
    lastResult,
  };
}

function usage() {
  return [
    'Usage:',
    '  node scripts/run/pre-agent2-telegram-loop.mjs --run-dir runs/<site-id>',
    '',
    'Options:',
    '  --inbox-path <path>',
    '  --remote-state-path <path>',
    '  --telegram-env-path <path>',
    '  --poll-ms 10000',
    '  --max-questions 30',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const result = await runPreAgent2TelegramLoop(args);
  if (!result.ok && result.code === 'remote-disabled') {
    console.log(result.message);
    process.exitCode = 1;
    return;
  }

  console.log(`Pre-Agent2 Telegram loop stopped: ${result.lastResult?.reason || result.code}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 2;
  });
}
