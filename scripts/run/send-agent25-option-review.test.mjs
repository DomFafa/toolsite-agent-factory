import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  AGENT25_OPTION_IMAGES_BLOCK_MESSAGE,
  sendAgent25OptionReview,
} from './send-agent25-option-review.mjs';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function makeRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'send-agent25-option-review-'));
  const runDir = path.join(root, 'runs', 'sample-site');
  await mkdir(path.join(runDir, 'agent-2-5-output/chat-delivery'), { recursive: true });
  await writeFile(path.join(root, 'telegram.env'), 'TELEGRAM_BOT_TOKEN=fake-token\nTELEGRAM_ALLOWED_USERS=12345,67890\n');
  return { root, runDir, telegramEnvPath: path.join(root, 'telegram.env') };
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function imageBytes(size = 11 * 1024) {
  return Buffer.concat([PNG_HEADER, Buffer.alloc(size - PNG_HEADER.length, 1)]);
}

async function writeOptionsBoard(runDir, bytes = imageBytes()) {
  await writeFile(path.join(runDir, 'agent-2-5-output/chat-delivery/options-board.png'), bytes);
}

async function readEvents(runDir) {
  const text = await readFile(path.join(runDir, 'human-review-events.jsonl'), 'utf8');
  return text.trim().split(/\n+/).map((line) => JSON.parse(line));
}

function fakeSender(calls, result = { chat_id: '12345', message_id: '777' }) {
  return async (payload) => {
    calls.push(payload);
    return result;
  };
}

test('fails when options-board.png is missing', async () => {
  const { runDir } = await makeRun();

  const result = await sendAgent25OptionReview({ runDir });
  assert.equal(result.ok, false);
  assert.equal(result.message, AGENT25_OPTION_IMAGES_BLOCK_MESSAGE);
  assert.match(result.failures.join('\n'), /missing agent-2-5-output\/chat-delivery\/options-board\.png/);
});

test('fails when options-board.png is not an image', async () => {
  const { runDir } = await makeRun();
  await writeOptionsBoard(runDir, Buffer.from('not-an-image'.repeat(1000)));

  const result = await sendAgent25OptionReview({ runDir });
  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /not a recognized PNG, JPEG, or WebP image/);
});

test('fails when options-board.png is too small', async () => {
  const { runDir } = await makeRun();
  await writeOptionsBoard(runDir, imageBytes(128));

  const result = await sendAgent25OptionReview({ runDir });
  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /too small/);
});

test('dry-run does not send Telegram and does not write event', async () => {
  const { runDir, telegramEnvPath } = await makeRun();
  await writeOptionsBoard(runDir);
  const calls = [];

  const result = await sendAgent25OptionReview({
    runDir,
    telegramEnvPath,
    sendPhoto: fakeSender(calls),
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'dry-run');
  assert.equal(result.sent, false);
  assert.equal(result.wrote, false);
  assert.equal(calls.length, 0);
  assert.equal(await exists(path.join(runDir, 'human-review-events.jsonl')), false);
});

test('--send --write appends open human_review after fake sendPhoto succeeds', async () => {
  const { runDir, telegramEnvPath } = await makeRun();
  await writeOptionsBoard(runDir);
  const calls = [];

  const result = await sendAgent25OptionReview({
    runDir,
    telegramEnvPath,
    send: true,
    write: true,
    sendPhoto: fakeSender(calls, { chat_id: '12345', message_id: '998' }),
    now: () => '2026-05-11T00:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'sent-and-written');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].chatId, '12345');
  assert.match(calls[0].caption, /Agent2\.5 UI Option Selection/);
  assert.match(calls[0].caption, /选择 Option A/);

  const [event] = await readEvents(runDir);
  assert.equal(event.schema_version, 'human-review-event.v1');
  assert.equal(event.type, 'human_review');
  assert.equal(event.review_type, 'agent25_option_selection');
  assert.equal(event.id, 'agent25-option-selection');
  assert.equal(event.site_id, 'sample-site');
  assert.equal(event.run_dir.replace(/\\/g, '/').endsWith('/runs/sample-site'), true);
  assert.equal(event.phase, 'agent-2.5');
  assert.equal(event.status, 'open');
  assert.equal(event.blocking, true);
  assert.equal(event.blocks, 'agent-3');
  assert.equal(event.telegram_delivery.chat_id, '12345');
  assert.equal(event.telegram_delivery.message_id, '998');
  assert.equal(event.telegram_delivery.sent_at, '2026-05-11T00:00:00.000Z');
  assert.deepEqual(event.attachments, [
    {
      label: 'Options board',
      path: 'agent-2-5-output/chat-delivery/options-board.png',
      kind: 'image',
      required: true,
    },
  ]);
});

test('uses explicit --chat-id over TELEGRAM_ALLOWED_USERS', async () => {
  const { runDir, telegramEnvPath } = await makeRun();
  await writeOptionsBoard(runDir);
  const calls = [];

  await sendAgent25OptionReview({
    runDir,
    telegramEnvPath,
    chatId: '99999',
    send: true,
    write: true,
    sendPhoto: fakeSender(calls, { chat_id: '99999', message_id: '1000' }),
    now: () => '2026-05-11T00:00:00.000Z',
  });

  assert.equal(calls[0].chatId, '99999');
});

test('does not repeat send when current open agent25-option-selection exists', async () => {
  const { runDir, telegramEnvPath } = await makeRun();
  await writeOptionsBoard(runDir);
  await writeFile(
    path.join(runDir, 'human-review-events.jsonl'),
    `${JSON.stringify({
      schema_version: 'human-review-event.v1',
      type: 'human_review',
      review_type: 'agent25_option_selection',
      id: 'agent25-option-selection',
      status: 'open',
      created_at: '2026-05-11T00:00:00.000Z',
    })}\n`,
  );
  const before = await readFile(path.join(runDir, 'human-review-events.jsonl'), 'utf8');
  const calls = [];

  const result = await sendAgent25OptionReview({
    runDir,
    telegramEnvPath,
    send: true,
    write: true,
    sendPhoto: fakeSender(calls),
  });

  const after = await readFile(path.join(runDir, 'human-review-events.jsonl'), 'utf8');
  assert.equal(result.code, 'already-open');
  assert.equal(result.sent, false);
  assert.equal(result.wrote, false);
  assert.equal(calls.length, 0);
  assert.equal(after, before);
});

test('does not enter Agent3 or create site source', async () => {
  const { runDir, telegramEnvPath } = await makeRun();
  await writeOptionsBoard(runDir);

  await sendAgent25OptionReview({
    runDir,
    telegramEnvPath,
    send: true,
    write: true,
    sendPhoto: fakeSender([]),
    now: () => '2026-05-11T00:00:00.000Z',
  });

  assert.equal(await exists(path.join(runDir, 'agent-3-output')), false);
  assert.equal(await exists(path.join(runDir, 'site')), false);
  assert.equal(await exists(path.join(runDir, 'src')), false);
  assert.equal(await exists(path.join(runDir, 'app')), false);
});
