// Production run behavior is governed by docs/production-run-master-contract.md.
// If this entrypoint conflicts with the contract, the contract wins.
// Hermes intake must enforce fresh production intent, complete five elements, and required image attachments without pretending missing attachments were read.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_HERMES_INBOX =
  '/Users/dom/agents/hermes-toolsite-monitor/hermes-home/state/toolsite-inbox.jsonl';
export const DEFAULT_HERMES_REMOTE_STATE =
  '/Users/dom/agents/hermes-toolsite-monitor/hermes-home/state/toolsite-remote.json';

export const REMOTE_DISABLED_MESSAGE = '远程模式未开启，拒绝读取 Hermes intake。';
export const INBOX_MISSING_MESSAGE = '没有找到 Hermes inbox。';
export const NO_INTAKE_MESSAGE = '没有找到可用的新站 intake 消息。';
export const STALE_INTAKE_REJECTED = 'STALE_INTAKE_REJECTED';
export const MISSING_PRODUCTION_START_INTENT = 'MISSING_PRODUCTION_START_INTENT';
export const INCOMPLETE_INTAKE = 'INCOMPLETE_INTAKE';
export const MISSING_REQUIRED_ATTACHMENT = 'MISSING_REQUIRED_ATTACHMENT';

export const PRODUCTION_START_INTENT_PHRASES = [
  '开始正式建站',
  '新建 production run',
  '创建生产站',
  '开始生产运行',
  '正式开始这个站',
];

const FIELD_LABELS = {
  关键词: 'keyword',
  目标域名: 'target_domain',
  UI参考: 'ui_reference',
  UX参考: 'ux_reference',
  额外想法: 'extra_notes',
  限制: 'extra_notes',
  模仿点: 'extra_notes',
  额外要求: 'extra_notes',
  补充要求: 'extra_notes',
  其他要求: 'extra_notes',
  '额外想法/限制/模仿点': 'extra_notes',
};

const REQUIRED_FIELDS = [
  ['keyword', '关键词'],
  ['target_domain', '目标域名'],
  ['ui_reference', 'UI 参考'],
  ['ux_reference', 'UX 参考'],
  ['extra_notes', '额外想法 / 限制 / 模仿点'],
];

function parseArgs(argv) {
  const options = {
    inboxPath: DEFAULT_HERMES_INBOX,
    remoteStatePath: DEFAULT_HERMES_REMOTE_STATE,
    json: false,
    freshAfter: '',
    allowExistingIntake: false,
    requireProductionStartIntent: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--inbox' || arg === '--inbox-path') {
      options.inboxPath = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--remote-state' || arg === '--remote-state-path') {
      options.remoteStatePath = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--fresh-after') {
      options.freshAfter = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--allow-existing-intake') {
      options.allowExistingIntake = true;
    } else if (arg === '--require-production-start-intent') {
      options.requireProductionStartIntent = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function readRemoteMode(remoteStatePath) {
  let data;
  try {
    data = JSON.parse(await readFile(remoteStatePath, 'utf8'));
  } catch {
    return false;
  }
  return data && data.remote_mode === true;
}

async function readJsonl(filePath) {
  let text;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }

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

function normalizeLabel(label) {
  return String(label || '')
    .replace(/^[\s>*#\-.•\d）)、.]+/, '')
    .replace(/\s+/g, '')
    .replace(/[／/]+/g, '/')
    .toUpperCase();
}

function fieldForLabel(label) {
  return FIELD_LABELS[normalizeLabel(label)] || '';
}

function assignField(result, field, value) {
  const clean = String(value || '').trim();
  if (!field || !clean) return;
  if (field === 'extra_notes' && result.extra_notes) {
    result.extra_notes = `${result.extra_notes}；${clean}`;
    return;
  }
  result[field] = clean;
}

export function parseIntakeText(text) {
  const result = {
    keyword: '',
    target_domain: '',
    ui_reference: '',
    ux_reference: '',
    extra_notes: '',
  };
  let currentField = '';

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const colonIndex = line.search(/[:：]/);
    if (colonIndex !== -1) {
      const label = line.slice(0, colonIndex);
      const field = fieldForLabel(label);
      if (field) {
        currentField = field;
        assignField(result, field, line.slice(colonIndex + 1));
        continue;
      }
    }

    if (currentField && line) {
      assignField(result, currentField, line);
    }
  }

  return result;
}

export function intakeTextForMessage(message) {
  const text = String(message?.text || '').trim();
  const caption = String(message?.caption || '').trim();
  if (text && caption && text !== caption) return `${text}\n${caption}`;
  return text || caption;
}

export function suggestedSiteIdFromDomain(domain) {
  let clean = String(domain || '').trim().toLowerCase();
  clean = clean.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  clean = clean.split('/')[0] || clean;
  clean = clean.split('?')[0] || clean;
  clean = clean.split('#')[0] || clean;
  clean = clean.split(':')[0] || clean;
  clean = clean.replace(/^www\./, '');

  const labels = clean.split('.').filter(Boolean);
  if (labels.length > 1) labels.pop();
  const base = labels.join('-') || clean;

  return base
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function missingFields(parsed) {
  return REQUIRED_FIELDS
    .filter(([key]) => !String(parsed[key] || '').trim())
    .map(([, label]) => label);
}

function hasAnyIntakeField(parsed) {
  return REQUIRED_FIELDS.some(([key]) => String(parsed[key] || '').trim());
}

function messageCreatedAt(message) {
  return String(message?.created_at || '').trim();
}

export function intakeMessageKey(message) {
  return [
    String(message?.source || ''),
    String(message?.chat_id || ''),
    String(message?.message_id || ''),
    messageCreatedAt(message),
  ].join(':');
}

export function hasProductionStartIntent(text) {
  const body = String(text || '');
  return PRODUCTION_START_INTENT_PHRASES.some((phrase) => body.includes(phrase));
}

export function intakeRequiresAttachment(text) {
  const body = String(text || '');
  if (/参考我发的.*(?:图|图片|插画)|用我发的.*(?:图|图片|插画)|黑白人物插画|附图|截图|插画参考/.test(body)) {
    return true;
  }
  return [
    '用我发的图',
    '用我发的图片',
    '参考我发的图',
    '参考我发的图片',
    '参考我发的插画',
    '附图',
    '截图',
    '插画参考',
    '按附件',
    '按照附件',
    '见附件',
  ].some((phrase) => body.includes(phrase));
}

function isFreshMessage(message, freshAfter) {
  if (!freshAfter) return true;
  const messageTime = Date.parse(messageCreatedAt(message));
  const startTime = Date.parse(freshAfter);
  if (Number.isNaN(messageTime) || Number.isNaN(startTime)) return false;
  return messageTime >= startTime;
}

function sourceForMessage(message) {
  return {
    message_id: String(message.message_id || ''),
    chat_id: String(message.chat_id || ''),
    created_at: String(message.created_at || ''),
    key: intakeMessageKey(message),
  };
}

function normalizeAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;
  const kind = String(attachment.kind || '').trim();
  const localPath = String(attachment.local_path || '').trim();
  if (!kind || !localPath) return null;
  return {
    kind,
    telegram_file_id: String(attachment.telegram_file_id || ''),
    local_path: localPath,
    mime_type: String(attachment.mime_type || ''),
    file_name: String(attachment.file_name || ''),
    width: attachment.width ?? null,
    height: attachment.height ?? null,
  };
}

function attachmentsForMessage(message) {
  if (!Array.isArray(message?.attachments)) return [];
  return message.attachments.map(normalizeAttachment).filter(Boolean);
}

function buildResultFromMessage(message, parsed) {
  const missing = missingFields(parsed);
  const found = missing.length === 0;
  const attachments = attachmentsForMessage(message);
  const intakeText = intakeTextForMessage(message);
  return {
    found,
    keyword: parsed.keyword,
    target_domain: parsed.target_domain,
    ui_reference: parsed.ui_reference,
    ux_reference: parsed.ux_reference,
    extra_notes: parsed.extra_notes,
    suggested_site_id: found ? suggestedSiteIdFromDomain(parsed.target_domain) : '',
    remote_mode: true,
    source: sourceForMessage(message),
    production_start_intent: hasProductionStartIntent(intakeText),
    attachment_required: intakeRequiresAttachment(intakeText),
    attachments,
    ...(found ? {} : { missing_fields: missing }),
  };
}

export function selectIntakeMessage(
  messages,
  { freshAfter = '', allowExistingIntake = true, requireProductionStartIntent = false } = {},
) {
  const candidates = messages
    .filter((message) => message && message.type === 'user_message')
    .map((message) => ({ message, parsed: parseIntakeText(intakeTextForMessage(message)) }))
    .filter(({ parsed }) => hasAnyIntakeField(parsed));

  if (candidates.length === 0) {
    return {
      found: false,
      code: 'no-intake',
      message: NO_INTAKE_MESSAGE,
      remote_mode: true,
    };
  }

  const newestCandidate = candidates.at(-1);
  const freshCandidates = allowExistingIntake
    ? candidates
    : candidates.filter(({ message }) => isFreshMessage(message, freshAfter));

  if (freshCandidates.length === 0) {
    return {
      found: false,
      code: 'stale-intake',
      message: STALE_INTAKE_REJECTED,
      remote_mode: true,
      source: sourceForMessage(newestCandidate.message),
    };
  }

  const intentCandidates = requireProductionStartIntent
    ? freshCandidates.filter(({ message }) => hasProductionStartIntent(intakeTextForMessage(message)))
    : freshCandidates;

  if (intentCandidates.length === 0) {
    return {
      found: false,
      code: 'missing-production-start-intent',
      message: MISSING_PRODUCTION_START_INTENT,
      remote_mode: true,
      source: sourceForMessage(freshCandidates.at(-1).message),
    };
  }

  const completeCandidates = intentCandidates.filter(({ parsed }) => missingFields(parsed).length === 0);
  const selected = completeCandidates.at(-1) || intentCandidates.at(-1);
  const result = buildResultFromMessage(selected.message, selected.parsed);
  if (!result.found) {
    return {
      ...result,
      code: 'incomplete-intake',
      message: INCOMPLETE_INTAKE,
    };
  }
  if (result.attachment_required && result.attachments.length === 0) {
    return {
      ...result,
      found: false,
      code: 'missing-required-attachment',
      message: MISSING_REQUIRED_ATTACHMENT,
    };
  }
  return result;
}

export async function readHermesIntake({
  inboxPath = DEFAULT_HERMES_INBOX,
  remoteStatePath = DEFAULT_HERMES_REMOTE_STATE,
  freshAfter = '',
  allowExistingIntake = true,
  requireProductionStartIntent = false,
} = {}) {
  const remoteMode = await readRemoteMode(remoteStatePath);
  if (!remoteMode) {
    return {
      found: false,
      remote_mode: false,
      code: 'remote-disabled',
      message: REMOTE_DISABLED_MESSAGE,
    };
  }

  const messages = await readJsonl(inboxPath);
  if (messages === null) {
    return {
      found: false,
      remote_mode: true,
      code: 'inbox-missing',
      message: INBOX_MISSING_MESSAGE,
    };
  }

  const result = selectIntakeMessage(messages, {
    freshAfter,
    allowExistingIntake,
    requireProductionStartIntent,
  });
  if (result.code === 'no-intake') {
    return {
      found: false,
      remote_mode: true,
      code: 'no-intake',
      message: NO_INTAKE_MESSAGE,
    };
  }
  return result;
}

function formatHuman(result) {
  if (result.code === 'remote-disabled') return REMOTE_DISABLED_MESSAGE;
  if (result.code === 'inbox-missing') return INBOX_MISSING_MESSAGE;
  if (result.code === 'no-intake') return NO_INTAKE_MESSAGE;
  if (result.code === 'stale-intake') return STALE_INTAKE_REJECTED;
  if (result.code === 'missing-production-start-intent') return MISSING_PRODUCTION_START_INTENT;
  if (result.code === 'missing-required-attachment') return MISSING_REQUIRED_ATTACHMENT;

  if (!result.found) {
    return [
      'Hermes intake incomplete:',
      '',
      `关键词: ${result.keyword || ''}`,
      `目标域名: ${result.target_domain || ''}`,
      `UI 参考: ${result.ui_reference || ''}`,
      `UX 参考: ${result.ux_reference || ''}`,
      `额外想法 / 限制 / 模仿点: ${result.extra_notes || ''}`,
      '',
      'missing_fields:',
      ...result.missing_fields.map((field) => `- ${field}`),
    ].join('\n');
  }

  return [
    'Hermes intake found:',
    '',
    `关键词: ${result.keyword}`,
    `目标域名: ${result.target_domain}`,
    `UI 参考: ${result.ui_reference}`,
    `UX 参考: ${result.ux_reference}`,
    `额外想法 / 限制 / 模仿点: ${result.extra_notes}`,
    ...(result.attachments?.length
      ? [
          '',
          '附件:',
          ...result.attachments.map((attachment) => `- ${attachment.kind}: ${attachment.local_path}`),
        ]
      : []),
    '',
    `建议 site-id: ${result.suggested_site_id}`,
  ].join('\n');
}

function usage() {
  return [
    'Usage:',
    '  node scripts/run/read-hermes-intake.mjs',
    '  node scripts/run/read-hermes-intake.mjs --json',
    '  node scripts/run/read-hermes-intake.mjs --inbox <path> --remote-state <path>',
    '  node scripts/run/read-hermes-intake.mjs --fresh-after <ISO> --require-production-start-intent',
  ].join('\n');
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }

    const result = await readHermesIntake(options);
    if (options.json && result.code !== 'remote-disabled') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatHuman(result));
    }

    if (!result.found) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
