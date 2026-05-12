#!/usr/bin/env node
// Production run behavior is governed by docs/production-run-master-contract.md.
// If this entrypoint conflicts with the contract, the contract wins.
// Agent2.5 option review must send the real options-board image, stop for user A/B/C selection, and never auto-select UI.
import { access, appendFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { AGENT25_OPTION_IMAGES_BLOCK_MESSAGE } from './check-agent25-option-images.mjs';

export { AGENT25_OPTION_IMAGES_BLOCK_MESSAGE };

export const DEFAULT_TELEGRAM_ENV =
  '/Users/dom/agents/hermes-toolsite-monitor/hermes-home/.env';

const OPTIONS_BOARD_PATH = 'agent-2-5-output/chat-delivery/options-board.png';
const HUMAN_REVIEW_EVENTS_PATH = 'human-review-events.jsonl';
const MIN_IMAGE_BYTES = 10 * 1024;

export const OPTION_REVIEW_CAPTION = [
  'Agent2.5 UI Option Selection',
  '',
  '请查看这张 Option A / B / C 对比图。',
  '回复：',
  '选择 Option A',
  '选择 Option B',
  '选择 Option C',
  '都不满意，重做：...',
].join('\n');

function nowIso() {
  return new Date().toISOString();
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const args = {
    runDir: '',
    telegramEnvPath: DEFAULT_TELEGRAM_ENV,
    chatId: '',
    send: false,
    write: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run-dir') {
      args.runDir = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--telegram-env-path') {
      args.telegramEnvPath = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--chat-id') {
      args.chatId = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--send') {
      args.send = true;
    } else if (arg === '--write') {
      args.write = true;
    } else if (arg === '--force') {
      args.force = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.runDir && !args.help) {
    throw new Error('Usage: node scripts/run/send-agent25-option-review.mjs --run-dir runs/<site-id> [--send --write]');
  }
  if (args.write && !args.send) {
    throw new Error('Use --send with --write so telegram_delivery can record the sent message_id');
  }
  return args;
}

function parseEnv(text) {
  const env = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function firstAllowedChatId(env) {
  return String(env.TELEGRAM_ALLOWED_USERS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)[0] || '';
}

function isRecognizedImage(header) {
  if (header.length >= 8) {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (png.every((byte, index) => header[index] === byte)) return 'png';
  }
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'jpeg';
  }
  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString('ascii') === 'RIFF' &&
    header.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return '';
}

async function inspectImage(filePath) {
  if (!(await exists(filePath))) return { exists: false, size: 0, format: '' };
  const fileStat = await stat(filePath);
  const bytes = await readFile(filePath);
  return {
    exists: true,
    size: fileStat.size,
    format: isRecognizedImage(bytes.subarray(0, 16)),
  };
}

function parseJsonl(text) {
  const events = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    events.push(JSON.parse(line));
  }
  return events;
}

function currentOpenOptionSelection(events) {
  const latest = events
    .filter(
      (event) =>
        event &&
        event.type === 'human_review' &&
        (event.review_type === 'agent25_option_selection' || event.id === 'agent25-option-selection'),
    )
    .at(-1);
  return latest?.status === 'open' ? latest : null;
}

function siteIdFromRunDir(runDir) {
  return path.basename(path.resolve(runDir));
}

function normalizeRunDir(runDir) {
  return String(runDir || '').replace(/\\/g, '/').replace(/\/$/, '');
}

function buildOpenReviewEvent({ runDir, chatId, messageId, sentAt = nowIso(), createdAt = sentAt }) {
  return {
    schema_version: 'human-review-event.v1',
    type: 'human_review',
    review_type: 'agent25_option_selection',
    id: 'agent25-option-selection',
    site_id: siteIdFromRunDir(runDir),
    run_dir: normalizeRunDir(runDir),
    phase: 'agent-2.5',
    agent: 'agent-2.5-ui-design-generation',
    status: 'open',
    blocking: true,
    blocks: 'agent-3',
    title: '请选择 UI 方案',
    message: '请查看 Telegram 中发送的 Option A / B / C 对比图，然后选择一个 UI 方案。',
    expected_reply: '回复：选择 Option A / 选择 Option B / 选择 Option C / 都不满意，重做：...',
    attachments: [
      {
        label: 'Options board',
        path: OPTIONS_BOARD_PATH,
        kind: 'image',
        required: true,
      },
    ],
    telegram_delivery: {
      chat_id: String(chatId),
      message_id: String(messageId),
      sent_at: sentAt,
    },
    created_at: createdAt,
    created_by: 'codex',
  };
}

function buildSupersededReviewEvent({ existingOpen, supersededAt = nowIso() }) {
  return {
    ...existingOpen,
    status: 'superseded',
    blocking: false,
    created_at: supersededAt,
    created_by: 'codex',
    superseded_at: supersededAt,
    superseded_by: 'codex',
    superseded_reason: 'Replaced by a forced Agent2.5 option board resend.',
    superseded_review_created_at: existingOpen.created_at || '',
  };
}

async function realSendPhoto({ token, chatId, photoPath, caption }) {
  const bytes = await readFile(photoPath);
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', caption);
  form.append('photo', new Blob([bytes]), path.basename(photoPath));

  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) {
    throw new Error(`Telegram sendPhoto failed: ${payload.description || response.status}`);
  }
  return {
    chat_id: String(payload.result?.chat?.id || chatId),
    message_id: String(payload.result?.message_id || ''),
  };
}

export async function sendAgent25OptionReview({
  runDir,
  telegramEnvPath = DEFAULT_TELEGRAM_ENV,
  chatId = '',
  send = false,
  write = false,
  force = false,
  sendPhoto = realSendPhoto,
  now = nowIso,
} = {}) {
  if (!runDir) throw new Error('--run-dir is required');
  if (write && !send) throw new Error('Use --send with --write so telegram_delivery can record the sent message_id');

  const absoluteRunDir = path.resolve(runDir);
  const optionsBoardPath = path.join(absoluteRunDir, OPTIONS_BOARD_PATH);
  const image = await inspectImage(optionsBoardPath);
  const failures = [];

  if (!image.exists) {
    failures.push(`missing ${OPTIONS_BOARD_PATH}`);
  } else {
    if (!image.format) failures.push(`${OPTIONS_BOARD_PATH} is not a recognized PNG, JPEG, or WebP image`);
    if (image.size < MIN_IMAGE_BYTES) failures.push(`${OPTIONS_BOARD_PATH} is too small to be a reviewable UI image`);
  }

  if (failures.length > 0) {
    return {
      ok: false,
      code: 'blocked-no-reviewable-image',
      message: AGENT25_OPTION_IMAGES_BLOCK_MESSAGE,
      failures,
      image,
    };
  }

  const eventsPath = path.join(absoluteRunDir, HUMAN_REVIEW_EVENTS_PATH);
  const events = parseJsonl(await readOptional(eventsPath));
  const existingOpen = currentOpenOptionSelection(events);
  if (existingOpen && !force) {
    return {
      ok: true,
      code: 'already-open',
      message: '当前已存在 open agent25-option-selection，未重复发送。',
      sent: false,
      wrote: false,
      existingReview: {
        id: existingOpen.id,
        created_at: existingOpen.created_at,
      },
    };
  }

  if (!send) {
    return {
      ok: true,
      code: 'dry-run',
      message: 'Dry run: no Telegram message sent and no human_review event written.',
      sent: false,
      wrote: false,
      image,
      caption: OPTION_REVIEW_CAPTION,
      existingReview: existingOpen
        ? {
            id: existingOpen.id,
            created_at: existingOpen.created_at,
            would_supersede_with_force: true,
          }
        : null,
    };
  }

  const env = parseEnv(await readOptional(telegramEnvPath));
  const token = env.TELEGRAM_BOT_TOKEN;
  const resolvedChatId = String(chatId || firstAllowedChatId(env)).trim();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing');
  if (!resolvedChatId) throw new Error('Telegram chat id is missing');

  const delivery = await sendPhoto({
    token,
    chatId: resolvedChatId,
    photoPath: optionsBoardPath,
    caption: OPTION_REVIEW_CAPTION,
  });
  const sentAt = now();

  const event = buildOpenReviewEvent({
    runDir,
    chatId: delivery.chat_id || resolvedChatId,
    messageId: delivery.message_id,
    sentAt,
    createdAt: sentAt,
  });
  const supersededEvent = existingOpen && force
    ? buildSupersededReviewEvent({ existingOpen, supersededAt: sentAt })
    : null;

  if (write) {
    if (supersededEvent) await appendFile(eventsPath, `${JSON.stringify(supersededEvent)}\n`, 'utf8');
    await appendFile(eventsPath, `${JSON.stringify(event)}\n`, 'utf8');
  }

  return {
    ok: true,
    code: write ? 'sent-and-written' : 'sent',
    message: write
      ? 'Agent2.5 option board sent to Telegram and open human_review event written.'
      : 'Agent2.5 option board sent to Telegram.',
    sent: true,
    wrote: write,
    image,
    telegram_delivery: event.telegram_delivery,
    superseded: Boolean(supersededEvent),
    superseded_event: write ? supersededEvent : null,
    event: write ? event : null,
  };
}

function usage() {
  return [
    'Usage:',
    '  node scripts/run/send-agent25-option-review.mjs --run-dir runs/<site-id>',
    '  node scripts/run/send-agent25-option-review.mjs --run-dir runs/<site-id> --send --write',
    '',
    'Options:',
    '  --telegram-env-path <path>',
    '  --chat-id <id>',
    '  --send',
    '  --write',
    '  --force',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const result = await sendAgent25OptionReview(args);
  console.log(result.message);
  if (result.code === 'blocked-no-reviewable-image') {
    for (const failure of result.failures) console.log(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  if (result.telegram_delivery) {
    console.log(`chat_id: ${result.telegram_delivery.chat_id}`);
    console.log(`message_id: ${result.telegram_delivery.message_id}`);
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 2;
  });
}
