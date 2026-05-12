import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkRunGates, SMOKE_RUN_BLOCK_MESSAGE } from './check-gates.mjs';
import {
  buildResolvedEvent,
  DEFAULT_HERMES_INBOX,
  selectResolution,
  summarizeReviewEvents,
} from './resolve-human-review-from-hermes-inbox.mjs';
import { sendAgent25OptionReview } from './send-agent25-option-review.mjs';

export const NO_OPEN_REVIEW = 'NO_OPEN_REVIEW';
export const NO_REPLY_FOUND = 'NO_REPLY_FOUND';
export const INVALID_REPLY = 'INVALID_REPLY';
export const REVIEW_RESOLVED = 'REVIEW_RESOLVED';
export const REVIEW_CHANGE_REQUESTED = 'REVIEW_CHANGE_REQUESTED';
export const OPTION_REVIEW_RESENT = 'OPTION_REVIEW_RESENT';
export const SMOKE_NOT_DEPLOYABLE = 'SMOKE_NOT_DEPLOYABLE';
export const GATES_BLOCKED = 'GATES_BLOCKED';
export const AGENT6_READY = 'AGENT6_READY';

const DEFAULT_NOW = () => new Date().toISOString();

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeReviewType(review) {
  return String(review?.review_type || review?.id || '').replaceAll('-', '_').toLowerCase();
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function readJsonOptional(filePath) {
  const text = await readOptional(filePath);
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseJsonl(text) {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function readJsonl(filePath) {
  const text = await readOptional(filePath);
  if (!text.trim()) return [];
  return parseJsonl(text);
}

async function appendJsonl(filePath, record) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(record)}\n`);
}

function relativeRunDir(runDir) {
  const normalized = runDir.replace(/\\/g, '/');
  const marker = '/runs/';
  const index = normalized.lastIndexOf(marker);
  if (index >= 0) return normalized.slice(index + 1);
  return normalized;
}

function siteIdFromRunDir(runDir) {
  return path.basename(path.resolve(runDir));
}

function inboxMessageKey(inboxMessage) {
  return [
    inboxMessage.source || '',
    inboxMessage.chat_id || '',
    inboxMessage.message_id || '',
    inboxMessage.created_at || '',
  ].join(':');
}

function isSpecConfirmation(text) {
  return /^确认(?:\s*SPEC)?$/i.test(normalizeText(text));
}

function isChangeRequest(text) {
  return /^修改\s*[:：]/.test(normalizeText(text));
}

function isResendRequest(text) {
  return /^(重发|重新发送|resend|force)$/i.test(normalizeText(text));
}

function parseOptionSelection(text) {
  const raw = normalizeText(text);
  const compact = raw.replace(/\s+/g, '').toLowerCase();
  if (/^[abc]$/i.test(raw)) return raw.toUpperCase();
  const match = compact.match(/^(?:选择|使用)?(?:option)?([abc])$/i);
  if (match) return match[1].toUpperCase();
  return null;
}

function isDeployConfirmation(text) {
  return /^确认部署$/.test(normalizeText(text));
}

function buildPendingChangeReview({ openReview, inboxMessage, createdAt }) {
  return {
    ...openReview,
    status: 'open',
    blocking: true,
    id: `${openReview.id}-change-request`,
    review_type: `${normalizeReviewType(openReview)}_change_request`,
    title: `${openReview.title || openReview.id} 修改请求待处理`,
    message: `用户通过 Telegram 提出了修改请求，Codex 必须处理后重新提交审核。\n\n${normalizeText(
      inboxMessage.text,
    )}`,
    expected_reply: 'Codex 处理修改后重新生成审核内容；用户再次确认前不得继续。',
    attachments: openReview.attachments || [],
    created_at: createdAt,
    created_by: 'codex',
  };
}

function addResolutionFields({ openReview, inboxMessage, resolvedAt, extra = {} }) {
  return {
    ...buildResolvedEvent({ openReview, inboxMessage, resolvedAt }),
    ...extra,
  };
}

async function appendResolvedEvent({ eventPath, openReview, inboxMessage, resolvedAt, extra }) {
  const resolvedEvent = addResolutionFields({ openReview, inboxMessage, resolvedAt, extra });
  await appendJsonl(eventPath, resolvedEvent);
  return resolvedEvent;
}

async function defaultAdvance(stage, { runDir } = {}) {
  if (stage === 'agent-3') {
    const gateResult = await checkRunGates({ runDir, before: 'agent-3' });
    if (!gateResult.allowed) {
      return {
        ok: false,
        code: GATES_BLOCKED,
        stage,
        message: 'Agent3 is blocked until Agent2.5 proof gates pass.',
        gateResult,
      };
    }
  }
  return {
    ok: true,
    code: 'NEXT_STAGE_READY',
    stage,
    message: `${stage} is ready for the next runner. No deployment was started.`,
  };
}

async function defaultResendOptionReview({ runDir }) {
  return sendAgent25OptionReview({ runDir, send: true, write: true, force: true });
}

async function ensureProductionDeployable(runDir) {
  const runMeta = await readJsonOptional(path.join(runDir, 'run-meta.json'));
  if (runMeta?.run_type === 'smoke' || runMeta?.deployable === false) {
    return {
      ok: false,
      code: SMOKE_NOT_DEPLOYABLE,
      message: SMOKE_RUN_BLOCK_MESSAGE,
    };
  }

  const gateResult = await checkRunGates({ runDir, before: 'agent-6' });
  if (!gateResult.allowed) {
    return {
      ok: false,
      code: GATES_BLOCKED,
      message: 'Agent6 is blocked by gate checks.',
      gateResult,
    };
  }

  return { ok: true, gateResult };
}

async function handleSpecConfirmation({
  runDir,
  eventPath,
  openReview,
  inboxMessage,
  advance,
  onSpecChangeRequest,
  now,
}) {
  const resolvedAt = now();
  const text = normalizeText(inboxMessage.text);
  if (isSpecConfirmation(text)) {
    const resolvedEvent = await appendResolvedEvent({ eventPath, openReview, inboxMessage, resolvedAt });
    const advanceResult = await advance('agent-2', { runDir, openReview, inboxMessage, resolvedEvent });
    return {
      ok: true,
      code: REVIEW_RESOLVED,
      review: openReview,
      inboxMessage,
      resolvedEvent,
      nextStage: 'agent-2',
      advanceResult,
    };
  }

  if (isChangeRequest(text)) {
    const resolvedEvent = await appendResolvedEvent({
      eventPath,
      openReview,
      inboxMessage,
      resolvedAt,
      extra: { change_requested: true },
    });
    const pendingReview = buildPendingChangeReview({ openReview, inboxMessage, createdAt: resolvedAt });
    await appendJsonl(eventPath, pendingReview);
    const changeResult = typeof onSpecChangeRequest === 'function'
      ? await onSpecChangeRequest({
          runDir,
          eventPath,
          openReview,
          inboxMessage,
          resolvedEvent,
          pendingReview,
          createdAt: resolvedAt,
        })
      : null;
    return {
      ok: true,
      code: REVIEW_CHANGE_REQUESTED,
      review: openReview,
      inboxMessage,
      resolvedEvent,
      pendingReview,
      changeResult,
      nextStage: null,
    };
  }

  return {
    ok: false,
    code: INVALID_REPLY,
    review: openReview,
    inboxMessage,
    message: 'INVALID_REPLY: 请回复“确认 SPEC”或“修改：...”。',
  };
}

async function handleAgent25OptionSelection({
  runDir,
  eventPath,
  openReview,
  inboxMessage,
  advance,
  resendOptionReview,
  now,
}) {
  const text = normalizeText(inboxMessage.text);
  if (isResendRequest(text)) {
    const resendResult = await resendOptionReview({ runDir, openReview, inboxMessage });
    return {
      ok: Boolean(resendResult?.ok),
      code: OPTION_REVIEW_RESENT,
      review: openReview,
      inboxMessage,
      resendResult,
      nextStage: null,
    };
  }

  const selectedOption = parseOptionSelection(text);
  if (!selectedOption) {
    return {
      ok: false,
      code: INVALID_REPLY,
      review: openReview,
      inboxMessage,
      message: 'INVALID_REPLY: 请回复 A / B / C，或回复“重发”。',
    };
  }

  const resolvedAt = now();
  const selectedDesign = `Option ${selectedOption}`;
  const resolvedEvent = await appendResolvedEvent({
    eventPath,
    openReview,
    inboxMessage,
    resolvedAt,
    extra: {
      selected_option: selectedOption,
      selected_design: selectedDesign,
    },
  });
  const advanceResult = await advance('agent-3', { runDir, openReview, inboxMessage, resolvedEvent });
  if (!advanceResult?.ok) {
    return {
      ok: false,
      code: advanceResult?.code || GATES_BLOCKED,
      review: openReview,
      inboxMessage,
      resolvedEvent,
      selectedOption,
      selectedDesign,
      nextStage: 'agent-3',
      advanceResult,
      message: advanceResult?.message || 'Agent3 is blocked until required gates pass.',
    };
  }
  return {
    ok: true,
    code: REVIEW_RESOLVED,
    review: openReview,
    inboxMessage,
    resolvedEvent,
    selectedOption,
    selectedDesign,
    nextStage: 'agent-3',
    advanceResult,
  };
}

async function handlePreDeployApproval({ runDir, eventPath, openReview, inboxMessage, advance, now }) {
  const text = normalizeText(inboxMessage.text);
  if (isChangeRequest(text)) {
    const resolvedAt = now();
    const resolvedEvent = await appendResolvedEvent({
      eventPath,
      openReview,
      inboxMessage,
      resolvedAt,
      extra: { change_requested: true },
    });
    const pendingReview = buildPendingChangeReview({ openReview, inboxMessage, createdAt: resolvedAt });
    await appendJsonl(eventPath, pendingReview);
    return {
      ok: true,
      code: REVIEW_CHANGE_REQUESTED,
      review: openReview,
      inboxMessage,
      resolvedEvent,
      pendingReview,
      nextStage: null,
    };
  }

  if (!isDeployConfirmation(text)) {
    return {
      ok: false,
      code: INVALID_REPLY,
      review: openReview,
      inboxMessage,
      message: 'INVALID_REPLY: 请回复“确认部署”或“修改：...”。',
    };
  }

  const deployable = await ensureProductionDeployable(runDir);
  if (!deployable.ok) {
    return {
      ...deployable,
      review: openReview,
      inboxMessage,
    };
  }

  const resolvedAt = now();
  const resolvedEvent = await appendResolvedEvent({ eventPath, openReview, inboxMessage, resolvedAt });
  const advanceResult = await advance('agent-6', { runDir, openReview, inboxMessage, resolvedEvent });
  return {
    ok: true,
    code: AGENT6_READY,
    review: openReview,
    inboxMessage,
    resolvedEvent,
    nextStage: 'agent-6',
    gateResult: deployable.gateResult,
    advanceResult,
  };
}

function selectHandler(review) {
  const reviewType = normalizeReviewType(review);
  if (reviewType === 'pre_agent2_spec_confirmation') return handleSpecConfirmation;
  if (reviewType === 'agent25_option_selection') return handleAgent25OptionSelection;
  if (reviewType === 'pre_deploy_approval' || reviewType === 'final_qa_launch_approval') {
    return handlePreDeployApproval;
  }
  return null;
}

export async function continueHumanReview({
  runDir,
  inboxPath = DEFAULT_HERMES_INBOX,
  advance = defaultAdvance,
  resendOptionReview = defaultResendOptionReview,
  onSpecChangeRequest = null,
  now = DEFAULT_NOW,
} = {}) {
  if (!runDir) throw new Error('Missing --run-dir');
  const absoluteRunDir = path.resolve(runDir);
  const eventPath = path.join(absoluteRunDir, 'human-review-events.jsonl');
  const events = await readJsonl(eventPath);
  const summary = summarizeReviewEvents(events);
  if (summary.openReviews.length === 0) {
    return { ok: true, code: NO_OPEN_REVIEW, message: NO_OPEN_REVIEW };
  }

  const inboxMessages = await readJsonl(inboxPath);
  const selection = selectResolution({
    openReviews: summary.openReviews,
    inboxMessages,
    consumedInboxKeys: summary.consumedInboxKeys,
  });
  if (!selection.ok) {
    return { ok: false, code: NO_REPLY_FOUND, message: NO_REPLY_FOUND, details: selection };
  }

  const openReview = selection.review;
  const inboxMessage = selection.message;
  const handler = selectHandler(openReview);
  if (!handler) {
    return {
      ok: false,
      code: INVALID_REPLY,
      review: openReview,
      inboxMessage,
      message: `Unsupported review_type: ${openReview.review_type || openReview.id}`,
    };
  }

  return handler({
    runDir: absoluteRunDir,
    eventPath,
    openReview,
    inboxMessage: {
      ...inboxMessage,
      inbox_message_key: inboxMessageKey(inboxMessage),
    },
    advance,
    resendOptionReview,
    onSpecChangeRequest,
    now,
  });
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    }
  }
  if (!args['run-dir']) throw new Error('Missing --run-dir');
  return args;
}

function printResult(result) {
  console.log(result.code || (result.ok ? 'OK' : 'FAILED'));
  if (result.message) console.log(result.message);
  if (result.review?.id) console.log(`review: ${result.review.id}`);
  if (result.inboxMessage?.text) console.log(`reply: ${result.inboxMessage.text}`);
  if (result.selectedOption) console.log(`selected_option: ${result.selectedOption}`);
  if (result.nextStage) console.log(`next_stage: ${result.nextStage}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await continueHumanReview({
    runDir: args['run-dir'],
    inboxPath: args['inbox-path'] || DEFAULT_HERMES_INBOX,
  });
  printResult(result);
  process.exitCode = result.ok ? 0 : 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}

export const testInternals = {
  inboxMessageKey,
  isSpecConfirmation,
  isChangeRequest,
  parseOptionSelection,
  relativeRunDir,
};
