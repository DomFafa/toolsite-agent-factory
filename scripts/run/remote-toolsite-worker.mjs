import { appendFile, mkdir, open, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { continueHumanReview, INVALID_REPLY, NO_REPLY_FOUND, REVIEW_CHANGE_REQUESTED, REVIEW_RESOLVED } from './continue-human-review.mjs';
import {
  DEFAULT_HERMES_INBOX,
  DEFAULT_HERMES_REMOTE_STATE,
  INCOMPLETE_INTAKE,
  MISSING_PRODUCTION_START_INTENT,
  MISSING_REQUIRED_ATTACHMENT,
  readHermesIntake,
  STALE_INTAKE_REJECTED,
} from './read-hermes-intake.mjs';
import {
  createProductionRunFromHermesIntake,
  PRODUCTION_RUN_CREATED,
  RUN_ALREADY_EXISTS,
  runToolsiteOrchestrator,
  WAITING_FOR_FRESH_INTAKE,
} from './run-toolsite-orchestrator.mjs';
import {
  DEFAULT_TELEGRAM_ENV,
  buildQuestionEvent,
  parseRunInput,
  runLoopIteration,
  sendTelegramMessage,
} from './pre-agent2-telegram-loop.mjs';
import { summarizeReviewEvents } from './resolve-human-review-from-hermes-inbox.mjs';

export const WORKER_LOCKED = 'WORKER_LOCKED';
export const INTAKE_ALREADY_PROCESSED = 'INTAKE_ALREADY_PROCESSED';
export const REMOTE_WORKER_STARTED_RUN = 'REMOTE_WORKER_STARTED_RUN';
export const WORKER_STARTED = 'WORKER_STARTED';
export const TELEGRAM_FEEDBACK_FAILED = 'TELEGRAM_FEEDBACK_FAILED';
export const ACTIVE_HUMAN_REVIEW_PROCESSED = 'ACTIVE_HUMAN_REVIEW_PROCESSED';
export const ACTIVE_HUMAN_REVIEW_WAITING = 'ACTIVE_HUMAN_REVIEW_WAITING';

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonOptional(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function defaultPidAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseJsonl(text) {
  return String(text || '')
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function readJsonlOptional(filePath) {
  const text = await readOptional(filePath);
  return text.trim() ? parseJsonl(text) : [];
}

async function appendJsonl(filePath, record) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(record)}\n`);
}

function workerPaths(rootDir, workerDir = '.toolsite-worker') {
  const absoluteWorkerDir = path.resolve(rootDir, workerDir);
  return {
    workerDir: absoluteWorkerDir,
    lockPath: path.join(absoluteWorkerDir, 'worker.lock'),
    statePath: path.join(absoluteWorkerDir, 'state.json'),
    logPath: path.join(absoluteWorkerDir, 'worker.log'),
  };
}

async function appendLog(logPath, code, message = '', now = nowIso) {
  await mkdir(path.dirname(logPath), { recursive: true });
  const line = `[${now()}] ${code}${message ? ` ${message}` : ''}\n`;
  await appendFile(logPath, line);
}

async function clearStaleLockIfNeeded(lockPath, pidAlive = defaultPidAlive) {
  const lock = await readJsonOptional(lockPath);
  const pid = Number(lock?.pid || 0);
  if (pid && pidAlive(pid)) return false;
  await rm(lockPath, { force: true });
  return true;
}

async function acquireLock(lockPath, now = nowIso, pidAlive = defaultPidAlive) {
  await mkdir(path.dirname(lockPath), { recursive: true });
  let handle;
  try {
    handle = await open(lockPath, 'wx');
  } catch (error) {
    if (error?.code === 'EEXIST') {
      const cleared = await clearStaleLockIfNeeded(lockPath, pidAlive);
      if (cleared) {
        handle = await open(lockPath, 'wx');
      } else {
        return { ok: false, code: WORKER_LOCKED, message: WORKER_LOCKED };
      }
    } else {
      throw error;
    }
  }

  await handle.writeFile(
    `${JSON.stringify({ pid: process.pid, acquired_at: now() }, null, 2)}\n`,
  );

  return {
    ok: true,
    async release() {
      await handle.close();
      await rm(lockPath, { force: true });
    },
  };
}

async function readWorkerState({ statePath, startedAt, now = nowIso }) {
  const existing = await readJsonOptional(statePath);
  if (existing && typeof existing === 'object') {
    return {
      started_at: existing.started_at || startedAt || now(),
      processed_intake_keys: Array.isArray(existing.processed_intake_keys)
        ? existing.processed_intake_keys
        : [],
      active_runs: existing.active_runs && typeof existing.active_runs === 'object' ? existing.active_runs : {},
      sent_feedback_keys: Array.isArray(existing.sent_feedback_keys) ? existing.sent_feedback_keys : [],
      last_result: existing.last_result || null,
    };
  }

  return {
    started_at: startedAt || now(),
    processed_intake_keys: [],
    active_runs: {},
    sent_feedback_keys: [],
    last_result: null,
  };
}

function intakeToWorkerCode(result) {
  if (result.code === 'stale-intake') return STALE_INTAKE_REJECTED;
  if (result.code === 'missing-production-start-intent') return MISSING_PRODUCTION_START_INTENT;
  if (result.code === 'incomplete-intake') return INCOMPLETE_INTAKE;
  if (result.code === 'missing-required-attachment') return MISSING_REQUIRED_ATTACHMENT;
  return WAITING_FOR_FRESH_INTAKE;
}

async function saveStateWithResult({ statePath, state, result }) {
  state.last_result = {
    code: result.code || '',
    ok: Boolean(result.ok),
    at: result.at || '',
    runDir: result.runDir || '',
    siteId: result.siteId || '',
  };
  await writeJson(statePath, state);
}

async function readRemoteMode(remoteStatePath) {
  const data = await readJsonOptional(remoteStatePath);
  return data?.remote_mode === true ? 'on' : 'off';
}

async function sendDefaultWorkerStatus({ text, inboxPath, telegramEnvPath }) {
  return sendTelegramMessage({ text, inboxPath, telegramEnvPath });
}

function feedbackKeyForResult(result) {
  const code = result?.code || '';
  const sourceKey = result?.intake?.source?.key || result?.source?.key || '';
  const runDir = result?.runDir || '';
  const message = result?.message || '';
  return [code, sourceKey, runDir, message].filter(Boolean).join('|');
}

function workerFeedbackText(result) {
  const code = result?.code || '';
  if (code === WAITING_FOR_FRESH_INTAKE || code === STALE_INTAKE_REJECTED) {
    return '远程建站 worker 正在等待新的 production intake。请在 Telegram 发送“开始正式建站”并附上完整五要素。';
  }
  if (code === MISSING_PRODUCTION_START_INTENT) {
    return '收到一条可能的 intake，但缺少“开始正式建站”等明确生产启动意图。没有创建 production run。';
  }
  if (code === INCOMPLETE_INTAKE) {
    const missing = result?.intake?.missing_fields || result?.missingFields || [];
    return [
      'production intake 不完整，暂未创建 run。',
      missing.length ? `缺少：${missing.join('、')}` : '',
      '请补齐关键词、目标域名、UI 参考、UX 参考、额外要求。',
    ].filter(Boolean).join('\n');
  }
  if (code === MISSING_REQUIRED_ATTACHMENT) {
    return '你提到了参考图片或附件，但 Hermes inbox 没有可用图片附件。请重新发送带图片的 production intake。';
  }
  if (code === RUN_ALREADY_EXISTS) {
    const runDir = result?.runDir || result?.siteId || '';
    return [
      `无法创建 production run：${runDir} 已存在。`,
      '系统不会自动改名或覆盖已有 run。请确认是否要 resume 或先处理现有 run。',
    ].join('\n');
  }
  if (code === INVALID_REPLY) {
    return result?.message || '收到回复，但该回复不符合当前审核点要求，流程没有推进。';
  }
  if (code === ACTIVE_HUMAN_REVIEW_PROCESSED) {
    const nestedCode = result?.runResult?.code || '';
    if (nestedCode === REVIEW_RESOLVED) return '已收到 Telegram 审核回复，已处理并继续推进到下一阶段。';
    if (nestedCode === REVIEW_CHANGE_REQUESTED) return '已收到修改意见，流程已停在修改处理后的审核点。';
    return '已收到 Telegram 审核回复，已处理当前人工审核点。';
  }
  return '';
}

function workerSuccessText(created) {
  const attachmentCount = created?.runMeta?.intake_attachments?.length || 0;
  return [
    '已收到新的 production intake。',
    `已创建 production run：${created?.runDir || ''}`,
    `已复制图片附件：${attachmentCount} 个`,
    '正在进入 Pre-Agent2 / SPEC 阶段。',
  ].join('\n');
}

async function sendWorkerFeedback({
  result,
  text = '',
  state,
  statePath,
  logPath,
  statusSender,
  inboxPath,
  telegramEnvPath,
  now = nowIso,
  dedupe = true,
}) {
  const message = text || workerFeedbackText(result);
  if (!message) return { sent: false };
  const key = feedbackKeyForResult({ ...result, message });
  if (dedupe && state.sent_feedback_keys.includes(key)) return { sent: false, deduped: true };
  try {
    await statusSender({ text: message, result, inboxPath, telegramEnvPath });
    state.sent_feedback_keys.push(key);
    await writeJson(statePath, state);
    return { sent: true };
  } catch (error) {
    await appendLog(logPath, TELEGRAM_FEEDBACK_FAILED, error?.message || String(error), now);
    return { sent: false, error };
  }
}

async function announceWorkerStarted({
  state,
  statePath,
  logPath,
  inboxPath,
  remoteStatePath,
  telegramEnvPath,
  statusSender,
  printer,
  now = nowIso,
}) {
  const lastProcessed = state.processed_intake_keys.at(-1) || 'none';
  const remoteMode = await readRemoteMode(remoteStatePath);
  const message = [
    WORKER_STARTED,
    `watching Hermes inbox: ${inboxPath}`,
    `remote mode status: ${remoteMode}`,
    `last processed message key: ${lastProcessed}`,
  ].join('\n');
  printer(message);
  await appendLog(logPath, WORKER_STARTED, `remote=${remoteMode} last=${lastProcessed}`, now);
  await sendWorkerFeedback({
    result: { code: WORKER_STARTED, message },
    text: message,
    state,
    statePath,
    logPath,
    statusSender,
    inboxPath,
    telegramEnvPath,
    now,
    dedupe: false,
  });
}

async function listRunDirectories(rootDir) {
  const runsDir = path.join(path.resolve(rootDir), 'runs');
  let entries = [];
  try {
    entries = await readdir(runsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !entry.name.startsWith('_'))
    .map((entry) => path.join(runsDir, entry.name));
}

async function discoverActiveProductionRuns({ rootDir, state }) {
  const candidates = new Map();
  for (const runDir of await listRunDirectories(rootDir)) {
    candidates.set(path.resolve(runDir), path.resolve(runDir));
  }
  for (const activeRun of Object.values(state.active_runs || {})) {
    const runDir = activeRun?.run_dir ? path.resolve(rootDir, activeRun.run_dir) : '';
    if (runDir) candidates.set(runDir, runDir);
  }

  const active = [];
  for (const runDir of candidates.values()) {
    const meta = await readJsonOptional(path.join(runDir, 'run-meta.json'));
    if (meta?.run_type === 'production' && meta?.status === 'active') {
      active.push({ runDir, siteId: path.basename(runDir), runMeta: meta });
    }
  }
  return active.sort((a, b) => a.runDir.localeCompare(b.runDir));
}

async function openHumanReviews(runDir) {
  const events = await readJsonlOptional(path.join(runDir, 'human-review-events.jsonl'));
  const summary = summarizeReviewEvents(events);
  return summary.openReviews;
}

function isSpecChangeRequestResult(result) {
  return result?.code === REVIEW_CHANGE_REQUESTED &&
    String(result?.review?.review_type || '') === 'pre_agent2_spec_confirmation';
}

function questionForSpecChange({ intake, requestText, questionNumber }) {
  const keyword = String(intake.keyword || 'this tool').trim() || 'this tool';
  const lower = `${keyword}\n${requestText}`.toLowerCase();
  if (lower.includes('401k') || lower.includes('401 k')) {
    return {
      number: questionNumber,
      id: 'pre-agent2-dynamic-401k-calculator-complexity',
      title: 'Pre-Agent2：401K Calculator 计算复杂度确认',
      decision_area: 'Input / Output Model',
      why_needed: '用户要求先确认 401K Calculator 的计算复杂度、默认假设、结果展示和老人友好输入方式。',
      message: [
        '401K Calculator 第一版计算复杂度选哪一档？',
        '',
        '1. 简化版：输入少，适合老人快速估算',
        '2. 标准版：包含年龄、退休年龄、当前余额、工资、缴费比例、雇主匹配、预期收益率、工资增长',
        '3. 详细版：增加 catch-up contribution、annual limit、通胀等高级项',
        '4. 其他，请直接描述',
        '5. 先按标准版生成 SPEC，但在审核卡里标注默认假设',
      ].join('\n'),
      option_decisions: {
        1: '401K Calculator 第一版使用简化输入，优先适合老人快速估算。',
        2: '401K Calculator 第一版使用标准输入，覆盖年龄、退休年龄、当前余额、工资、缴费比例、雇主匹配、预期收益率和工资增长。',
        3: '401K Calculator 第一版使用详细输入，增加 catch-up contribution、annual limit 和通胀等高级项。',
        4: '401K Calculator 第一版按用户自定义说明确定计算复杂度。',
        5: '401K Calculator 第一版按标准版生成 SPEC，并明确默认假设。',
      },
    };
  }

  return {
    number: questionNumber,
    id: `pre-agent2-dynamic-${keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tool'}-clarification`,
    title: `Pre-Agent2：${keyword} 关键澄清`,
    decision_area: 'Tool Purpose',
    why_needed: `用户要求在确认 SPEC 前补充 ${keyword} 的项目相关澄清。`,
    message: [
      `${keyword} 第一版最需要先确认哪一项？`,
      '',
      '1. 输入复杂度和默认假设',
      '2. 结果展示优先级',
      '3. 目标用户和可访问性要求',
      '4. 法务/边界限制',
      '5. 其他，请直接描述',
    ].join('\n'),
    option_decisions: {
      1: `${keyword} 优先确认输入复杂度和默认假设。`,
      2: `${keyword} 优先确认结果展示优先级。`,
      3: `${keyword} 优先确认目标用户和可访问性要求。`,
      4: `${keyword} 优先确认法务和边界限制。`,
      5: `${keyword} 使用用户自定义澄清说明。`,
    },
  };
}

async function handleSpecChangeRequestWithQuestion({
  runDir,
  eventPath,
  inboxMessage,
  pendingReview,
  createdAt,
  statusSender,
  inboxPath,
  telegramEnvPath,
  now = nowIso,
}) {
  const intake = parseRunInput(await readFile(path.join(runDir, 'input.md'), 'utf8'));
  const events = await readJsonlOptional(eventPath);
  const resolvedQuestions = events.filter(
    (event) => event?.review_type === 'pre_agent2_interview_question' && event?.status === 'resolved',
  );
  const question = questionForSpecChange({
    intake,
    requestText: inboxMessage.text,
    questionNumber: resolvedQuestions.length + 1,
  });
  const questionEvent = buildQuestionEvent({
    question,
    siteId: path.basename(runDir),
    runDir: `runs/${path.basename(runDir)}`,
    createdAt: now(),
    createdBy: 'codex',
  });
  await appendJsonl(eventPath, {
    ...pendingReview,
    status: 'superseded',
    blocking: false,
    superseded_by: questionEvent.id,
    superseded_at: now(),
    created_at: now(),
    created_by: 'codex',
  });
  await appendJsonl(eventPath, questionEvent);

  const statePath = path.join(runDir, 'pre-agent2-telegram-loop-state.json');
  const loopState = (await readJsonOptional(statePath)) || {
    schema_version: 'pre-agent2-telegram-loop-state.v1',
    site_id: path.basename(runDir),
    run_dir: runDir,
    sent_review_keys: [],
    rejected_inbox_keys: [],
    completed_questions: [],
  };
  const reviewKey = `${questionEvent.id}:${questionEvent.created_at}`;
  loopState.status = 'waiting_for_reply';
  loopState.current_question_id = questionEvent.id;
  loopState.current_question_number = Number(questionEvent.question_number || 0);
  loopState.sent_review_keys = Array.from(new Set([...(loopState.sent_review_keys || []), reviewKey]));
  loopState.updated_at = now();
  await writeJson(statePath, loopState);

  await statusSender({
    text: '已收到修改意见，正在生成澄清问题。',
    result: { code: REVIEW_CHANGE_REQUESTED, runDir, inboxMessage },
    inboxPath,
    telegramEnvPath,
  });
  await statusSender({
    text: ['已生成新的项目相关问题：', '', questionEvent.message].join('\n'),
    result: { code: REVIEW_CHANGE_REQUESTED, runDir, questionEvent },
    inboxPath,
    telegramEnvPath,
  });

  return { questionEvent };
}

function isPendingSpecChangeReview(review) {
  return String(review?.review_type || '') === 'pre_agent2_spec_confirmation_change_request' &&
    String(review?.status || '') === 'open';
}

async function handleExistingSpecChangeRequest({
  runDir,
  openReview,
  statusSender,
  inboxPath,
  telegramEnvPath,
  now = nowIso,
}) {
  const inboxMessage = {
    type: 'user_message',
    source: 'human-review-events',
    chat_id: 'run',
    message_id: openReview.id,
    text: String(openReview.message || '').replace(/^用户通过 Telegram 提出了修改请求，Codex 必须处理后重新提交审核。\s*/u, '').trim(),
    created_at: openReview.created_at,
    inbox_message_key: `human-review-events:${openReview.id}:${openReview.created_at}`,
  };
  return handleSpecChangeRequestWithQuestion({
    runDir,
    eventPath: path.join(runDir, 'human-review-events.jsonl'),
    inboxMessage,
    pendingReview: openReview,
    createdAt: openReview.created_at || now(),
    statusSender,
    inboxPath,
    telegramEnvPath,
    now,
  });
}

function activeRunFeedbackText(result) {
  if (isSpecChangeRequestResult(result)) {
    return '已收到修改意见，已生成项目相关澄清问题；Agent2 不会启动。';
  }
  if (result?.code === REVIEW_RESOLVED) {
    return '已收到 Telegram 审核回复，当前审核点已通过，正在继续推进。';
  }
  if (result?.code === INVALID_REPLY) {
    return result.message || '收到回复，但格式不符合当前审核点要求，流程未推进。';
  }
  return '';
}

function isActiveRunWaiting(runResult) {
  return runResult?.code === NO_REPLY_FOUND || runResult?.action === 'waiting';
}

async function processActiveProductionReviews({
  rootDir,
  inboxPath,
  remoteStatePath,
  state,
  statePath,
  logPath,
  runToolsite,
  telegramEnvPath,
  statusSender,
  pollMs,
  now = nowIso,
}) {
  const activeRuns = await discoverActiveProductionRuns({ rootDir, state });
  for (const activeRun of activeRuns) {
    const openReviews = await openHumanReviews(activeRun.runDir);
    if (openReviews.length === 0) continue;
    const latestOpen = openReviews.at(-1);
    if (isPendingSpecChangeReview(latestOpen)) {
      const changeResult = await handleExistingSpecChangeRequest({
        runDir: activeRun.runDir,
        openReview: latestOpen,
        statusSender,
        inboxPath,
        telegramEnvPath,
        now,
      });
      const result = {
        ok: true,
        code: ACTIVE_HUMAN_REVIEW_PROCESSED,
        runDir: activeRun.runDir,
        siteId: activeRun.siteId,
        runResult: {
          ok: true,
          code: REVIEW_CHANGE_REQUESTED,
          review: latestOpen,
          changeResult,
          nextStage: null,
        },
        at: now(),
      };
      await appendLog(logPath, ACTIVE_HUMAN_REVIEW_PROCESSED, `${activeRun.runDir} ${REVIEW_CHANGE_REQUESTED}`, now);
      await sendWorkerFeedback({
        result: { ...result, message: activeRunFeedbackText(result.runResult) },
        text: activeRunFeedbackText(result.runResult),
        state,
        statePath,
        logPath,
        statusSender,
        inboxPath,
        telegramEnvPath,
        now,
      });
      await saveStateWithResult({ statePath, state, result });
      return result;
    }
    const runResult = await runToolsite({
      runDir: activeRun.runDir,
      inboxPath,
      remoteStatePath,
      remote: true,
      pollMs: 0,
      maxIdleIterations: 1,
      continueReview: (args) => continueHumanReview({
        ...args,
        onSpecChangeRequest: (context) => handleSpecChangeRequestWithQuestion({
          ...context,
          statusSender,
          inboxPath,
          telegramEnvPath,
          now,
        }),
        now,
      }),
      preAgent2Runner: (args) => runLoopIteration({
        ...args,
        telegramEnvPath,
        sender: (text) => statusSender({ text, inboxPath, telegramEnvPath }),
        now,
      }),
    });

    if (isActiveRunWaiting(runResult)) {
      await appendLog(logPath, ACTIVE_HUMAN_REVIEW_WAITING, activeRun.runDir, now);
      continue;
    }

    const result = {
      ok: Boolean(runResult?.ok),
      code: ACTIVE_HUMAN_REVIEW_PROCESSED,
      runDir: activeRun.runDir,
      siteId: activeRun.siteId,
      runResult,
      at: now(),
    };
    await appendLog(logPath, ACTIVE_HUMAN_REVIEW_PROCESSED, `${activeRun.runDir} ${runResult?.code || ''}`, now);
    const feedback = activeRunFeedbackText(runResult);
    if (feedback) {
      await sendWorkerFeedback({
        result: { ...result, message: feedback },
        text: feedback,
        state,
        statePath,
        logPath,
        statusSender,
        inboxPath,
        telegramEnvPath,
        now,
      });
    }
    await saveStateWithResult({ statePath, state, result });
    return result;
  }
  return null;
}

export async function runRemoteToolsiteWorkerIteration({
  rootDir = process.cwd(),
  inboxPath = DEFAULT_HERMES_INBOX,
  remoteStatePath = DEFAULT_HERMES_REMOTE_STATE,
  state,
  statePath,
  logPath,
  runToolsite = runToolsiteOrchestrator,
  telegramEnvPath = DEFAULT_TELEGRAM_ENV,
  statusSender = sendDefaultWorkerStatus,
  pollMs = 10_000,
  now = nowIso,
} = {}) {
  const activeReviewResult = await processActiveProductionReviews({
    rootDir,
    inboxPath,
    remoteStatePath,
    state,
    statePath,
    logPath,
    runToolsite,
    telegramEnvPath,
    statusSender,
    pollMs,
    now,
  });
  if (activeReviewResult) return activeReviewResult;

  const intake = await readHermesIntake({
    inboxPath,
    remoteStatePath,
    freshAfter: state.started_at,
    allowExistingIntake: false,
    requireProductionStartIntent: true,
  });

  if (!intake.found) {
    const code = intakeToWorkerCode(intake);
    const result = { ok: true, code, message: code, intake, at: now() };
    await appendLog(logPath, code, intake.source?.key || '', now);
    await sendWorkerFeedback({
      result,
      state,
      statePath,
      logPath,
      statusSender,
      inboxPath,
      telegramEnvPath,
      now,
    });
    await saveStateWithResult({ statePath, state, result });
    return result;
  }

  const intakeKey = intake.source?.key || '';
  if (intakeKey && state.processed_intake_keys.includes(intakeKey)) {
    const result = { ok: true, code: INTAKE_ALREADY_PROCESSED, intake, at: now() };
    await appendLog(logPath, INTAKE_ALREADY_PROCESSED, intakeKey, now);
    await saveStateWithResult({ statePath, state, result });
    return result;
  }

  const created = await createProductionRunFromHermesIntake({
    rootDir,
    inboxPath,
    remoteStatePath,
    startedAt: state.started_at,
    allowExistingIntake: false,
    resumeExistingRun: false,
    now,
  });

  if (!created.ok || created.code !== PRODUCTION_RUN_CREATED) {
    const result = { ...created, at: now() };
    await appendLog(logPath, created.code || 'RUN_CREATE_FAILED', created.message || '', now);
    await sendWorkerFeedback({
      result,
      state,
      statePath,
      logPath,
      statusSender,
      inboxPath,
      telegramEnvPath,
      now,
    });
    await saveStateWithResult({ statePath, state, result });
    return result;
  }

  if (intakeKey) state.processed_intake_keys.push(intakeKey);
  state.active_runs[created.siteId] = {
    run_dir: path.relative(path.resolve(rootDir), created.runDir),
    intake_message_key: intakeKey,
    created_at: created.runMeta?.run_created_at || '',
  };
  await writeJson(statePath, state);
  await appendLog(logPath, PRODUCTION_RUN_CREATED, created.runDir, now);
  await sendWorkerFeedback({
    result: { ...created, code: REMOTE_WORKER_STARTED_RUN, at: now() },
    text: workerSuccessText(created),
    state,
    statePath,
    logPath,
    statusSender,
    inboxPath,
    telegramEnvPath,
    now,
  });

  const runResult = await runToolsite({
    runDir: created.runDir,
    inboxPath,
    remoteStatePath,
    remote: true,
    pollMs: 0,
    maxIdleIterations: 1,
  });
  const result = {
    ok: true,
    code: REMOTE_WORKER_STARTED_RUN,
    runDir: created.runDir,
    siteId: created.siteId,
    intake,
    runMeta: created.runMeta,
    runResult,
    at: now(),
  };
  await appendLog(logPath, REMOTE_WORKER_STARTED_RUN, created.runDir, now);
  await saveStateWithResult({ statePath, state, result });
  return result;
}

export async function runRemoteToolsiteWorker({
  rootDir = process.cwd(),
  inboxPath = DEFAULT_HERMES_INBOX,
  remoteStatePath = DEFAULT_HERMES_REMOTE_STATE,
  workerDir = '.toolsite-worker',
  telegramEnvPath = DEFAULT_TELEGRAM_ENV,
  pollMs = 10_000,
  startedAt = '',
  maxIterations = Infinity,
  once = false,
  runToolsite = runToolsiteOrchestrator,
  statusSender = sendDefaultWorkerStatus,
  printer = console.log,
  pidAlive = defaultPidAlive,
  now = nowIso,
} = {}) {
  const paths = workerPaths(rootDir, workerDir);
  const lock = await acquireLock(paths.lockPath, now, pidAlive);
  if (!lock.ok) {
    await appendLog(paths.logPath, WORKER_LOCKED, '', now);
    return { ok: false, code: WORKER_LOCKED, message: WORKER_LOCKED };
  }

  try {
    const state = await readWorkerState({ statePath: paths.statePath, startedAt, now });
    await writeJson(paths.statePath, state);
    await announceWorkerStarted({
      state,
      statePath: paths.statePath,
      logPath: paths.logPath,
      inboxPath,
      remoteStatePath,
      telegramEnvPath,
      statusSender,
      printer,
      now,
    });

    let lastResult = null;
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      lastResult = await runRemoteToolsiteWorkerIteration({
        rootDir,
        inboxPath,
        remoteStatePath,
        state,
        statePath: paths.statePath,
        logPath: paths.logPath,
        runToolsite,
        telegramEnvPath,
        statusSender,
        pollMs,
        now,
      });
      if (once) return lastResult;
      if (pollMs > 0) await sleep(pollMs);
    }
    return lastResult || { ok: true, code: WAITING_FOR_FRESH_INTAKE, message: WAITING_FOR_FRESH_INTAKE };
  } finally {
    await lock.release();
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--once') {
      args.once = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      args[key] = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printResult(result) {
  console.log(result?.code || (result?.ok ? 'OK' : 'FAILED'));
  if (result?.message) console.log(result.message);
  if (result?.siteId) console.log(`site_id: ${result.siteId}`);
  if (result?.runDir) console.log(`run_dir: ${result.runDir}`);
  if (result?.runResult?.code) console.log(`run_result: ${result.runResult.code}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runRemoteToolsiteWorker({
    rootDir: args['root-dir'] || process.cwd(),
    inboxPath: args['inbox-path'] || DEFAULT_HERMES_INBOX,
    remoteStatePath: args['remote-state-path'] || DEFAULT_HERMES_REMOTE_STATE,
    telegramEnvPath: args['telegram-env-path'] || DEFAULT_TELEGRAM_ENV,
    workerDir: args['worker-dir'] || '.toolsite-worker',
    pollMs: args['poll-ms'] ? Number(args['poll-ms']) : 10_000,
    startedAt: args['started-at'] || new Date().toISOString(),
    once: Boolean(args.once),
  });
  printResult(result);
  process.exitCode = result?.ok ? 0 : 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
