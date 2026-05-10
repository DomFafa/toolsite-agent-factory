import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_HERMES_INBOX =
  '/Users/dom/agents/hermes-toolsite-monitor/hermes-home/state/toolsite-inbox.jsonl';

function nowIso() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const options = {
    runDir: '',
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run-dir') {
      options.runDir = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--write') {
      options.write = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function readJsonl(filePath, { missingOk = false } = {}) {
  let text = '';
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    if (missingOk && error && error.code === 'ENOENT') return [];
    throw error;
  }

  const records = [];
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
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

function asText(value) {
  return String(value || '').trim();
}

function eventKey(event) {
  return asText(event.id);
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

function extractReviewId(text) {
  const match = asText(text).match(/(?:^|\s)review:([A-Za-z0-9._-]+)/);
  return match ? match[1] : '';
}

export function summarizeReviewEvents(events) {
  const latestById = new Map();
  const consumedInboxKeys = new Set();

  for (const event of events) {
    if (!event || event.type !== 'human_review') continue;
    const key = eventKey(event);
    if (!key) continue;
    latestById.set(key, event);
    if (event.status === 'resolved' && event.inbox_message_key) {
      consumedInboxKeys.add(String(event.inbox_message_key));
    }
  }

  return {
    openReviews: [...latestById.values()].filter((event) => event.status === 'open'),
    consumedInboxKeys,
  };
}

function usableInboxMessages(messages, consumedInboxKeys) {
  return messages
    .filter((message) => message && message.type === 'user_message')
    .filter((message) => asText(message.text))
    .map((message) => ({ ...message, inbox_message_key: inboxMessageKey(message) }))
    .filter((message) => !consumedInboxKeys.has(message.inbox_message_key));
}

function selectForSingleOpenReview(openReview, messages) {
  const candidates = messages.filter((message) => {
    const explicitReviewId = extractReviewId(message.text);
    if (explicitReviewId && explicitReviewId !== openReview.id) return false;
    return hasUsableTime(message.created_at, openReview.created_at);
  });
  return candidates[candidates.length - 1] || null;
}

function selectForMultipleOpenReviews(openReviews, messages) {
  const reviewsById = new Map(openReviews.map((review) => [review.id, review]));
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const reviewId = extractReviewId(message.text);
    if (!reviewId) continue;
    const review = reviewsById.get(reviewId);
    if (!review) continue;
    if (!hasUsableTime(message.created_at, review.created_at)) continue;
    return { review, message };
  }
  return null;
}

export function selectResolution({ openReviews, inboxMessages, consumedInboxKeys }) {
  if (openReviews.length === 0) {
    return {
      ok: false,
      code: 'no-open-review',
      message: '当前没有待处理的人工审核点。',
    };
  }

  const messages = usableInboxMessages(inboxMessages, consumedInboxKeys);
  if (messages.length === 0) {
    return {
      ok: false,
      code: 'no-usable-inbox-message',
      message: '没有可用于当前审核点的 Hermes inbox 回复',
    };
  }

  if (openReviews.length === 1) {
    const review = openReviews[0];
    const message = selectForSingleOpenReview(review, messages);
    if (!message) {
      return {
        ok: false,
        code: 'no-usable-inbox-message',
        message: '没有可用于当前审核点的 Hermes inbox 回复',
      };
    }
    return { ok: true, review, message };
  }

  const selection = selectForMultipleOpenReviews(openReviews, messages);
  if (selection) {
    return { ok: true, ...selection };
  }

  return {
    ok: false,
    code: 'multiple-open-reviews',
    message: [
      '存在多个待处理的人工审核点。Hermes inbox 回复必须带 review id。',
      '格式示例：review:<review-id> 用户回复',
      '当前 open review:',
      ...openReviews.map((review) => `- ${review.id}`),
    ].join('\n'),
  };
}

export function buildResolvedEvent({ openReview, inboxMessage, resolvedAt = nowIso() }) {
  return {
    schema_version: openReview.schema_version || 'human-review-event.v1',
    type: openReview.type,
    review_type: openReview.review_type,
    id: openReview.id,
    site_id: openReview.site_id,
    run_dir: openReview.run_dir,
    phase: openReview.phase,
    agent: openReview.agent || 'codex',
    status: 'resolved',
    blocking: false,
    blocks: openReview.blocks,
    title: openReview.title,
    message: openReview.message,
    expected_reply: openReview.expected_reply,
    attachments: Array.isArray(openReview.attachments) ? openReview.attachments : [],
    created_at: resolvedAt,
    created_by: 'codex',
    resolved_at: resolvedAt,
    resolved_by: `hermes-inbox:${asText(inboxMessage.source)}:${asText(inboxMessage.chat_id)}`,
    resolution_text: String(inboxMessage.text || ''),
    resolution_source: 'hermes_inbox',
    inbox_message: {
      source: asText(inboxMessage.source),
      chat_id: asText(inboxMessage.chat_id),
      message_id: asText(inboxMessage.message_id),
      created_at: asText(inboxMessage.created_at),
    },
    inbox_message_key: inboxMessage.inbox_message_key || inboxMessageKey(inboxMessage),
  };
}

export async function resolveHumanReviewFromHermesInbox({
  runDir,
  inboxPath = DEFAULT_HERMES_INBOX,
  write = false,
  resolvedAt,
}) {
  if (!runDir) {
    throw new Error('--run-dir is required');
  }

  const eventPath = path.join(runDir, 'human-review-events.jsonl');
  const reviewEvents = await readJsonl(eventPath, { missingOk: true });
  const inboxMessages = await readJsonl(inboxPath, { missingOk: true });
  const { openReviews, consumedInboxKeys } = summarizeReviewEvents(reviewEvents);
  const selection = selectResolution({ openReviews, inboxMessages, consumedInboxKeys });

  if (!selection.ok) {
    return {
      ok: false,
      written: false,
      eventPath,
      inboxPath,
      ...selection,
    };
  }

  const resolvedEvent = buildResolvedEvent({
    openReview: selection.review,
    inboxMessage: selection.message,
    resolvedAt,
  });

  if (write) {
    await appendFile(eventPath, `${JSON.stringify(resolvedEvent, null, 0)}\n`, 'utf8');
  }

  return {
    ok: true,
    written: write,
    eventPath,
    inboxPath,
    review: selection.review,
    inboxMessage: selection.message,
    resolvedEvent,
  };
}

function formatResult(result) {
  if (!result.ok) return result.message;

  return [
    result.written
      ? 'Resolved human review event appended.'
      : 'Dry run: no files changed. Run again with --write to append the resolved event.',
    `review id: ${result.review.id}`,
    `review title: ${result.review.title || 'Untitled review'}`,
    `inbox message key: ${result.resolvedEvent.inbox_message_key}`,
    `inbox created_at: ${result.inboxMessage.created_at || 'unknown'}`,
    'resolution_text:',
    String(result.inboxMessage.text || ''),
  ].join('\n');
}

function usage() {
  return [
    'Usage:',
    '  node scripts/run/resolve-human-review-from-hermes-inbox.mjs --run-dir runs/<site-id>',
    '  node scripts/run/resolve-human-review-from-hermes-inbox.mjs --run-dir runs/<site-id> --write',
  ].join('\n');
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    const result = await resolveHumanReviewFromHermesInbox(options);
    console.log(formatResult(result));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
