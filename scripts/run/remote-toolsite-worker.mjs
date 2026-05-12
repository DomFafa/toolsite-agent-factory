import { appendFile, mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  sendTelegramMessage,
} from './pre-agent2-telegram-loop.mjs';

export const WORKER_LOCKED = 'WORKER_LOCKED';
export const INTAKE_ALREADY_PROCESSED = 'INTAKE_ALREADY_PROCESSED';
export const REMOTE_WORKER_STARTED_RUN = 'REMOTE_WORKER_STARTED_RUN';
export const WORKER_STARTED = 'WORKER_STARTED';
export const TELEGRAM_FEEDBACK_FAILED = 'TELEGRAM_FEEDBACK_FAILED';

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
    pollMs,
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
