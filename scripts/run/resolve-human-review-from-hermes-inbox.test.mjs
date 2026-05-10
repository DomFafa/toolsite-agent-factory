import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveHumanReviewFromHermesInbox } from './resolve-human-review-from-hermes-inbox.mjs';

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'human-review-resolve-'));
  const runDir = path.join(root, 'runs', 'sample-site');
  const inboxPath = path.join(root, 'hermes-home', 'state', 'toolsite-inbox.jsonl');
  await mkdir(runDir, { recursive: true });
  await mkdir(path.dirname(inboxPath), { recursive: true });
  return { root, runDir, inboxPath, eventPath: path.join(runDir, 'human-review-events.jsonl') };
}

async function writeJsonl(filePath, records) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
}

function openReview(overrides = {}) {
  return {
    schema_version: 'human-review-event.v1',
    type: 'human_review',
    review_type: 'agent25_option_selection',
    id: 'agent25-option-selection',
    site_id: 'sample-site',
    run_dir: 'runs/sample-site',
    phase: 'agent-2.5',
    agent: 'agent-2.5-ui-design-generation',
    status: 'open',
    blocking: true,
    blocks: 'agent-3',
    title: 'Choose UI option',
    message: 'Please choose Option A, Option B, or Option C.',
    expected_reply: 'Reply with Option A / B / C.',
    attachments: [],
    created_at: '2026-05-11T10:00:00.000Z',
    created_by: 'codex',
    ...overrides,
  };
}

function inboxMessage(overrides = {}) {
  return {
    type: 'user_message',
    source: 'telegram',
    chat_id: '123',
    message_id: '456',
    text: '选择 Option B',
    created_at: '2026-05-11T10:05:00.000Z',
    handled: false,
    ...overrides,
  };
}

async function readEvents(eventPath) {
  const text = await readFile(eventPath, 'utf8');
  return text
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test('dry-run selects the latest usable inbox message without appending', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [openReview()]);
  await writeJsonl(inboxPath, [
    inboxMessage({ message_id: 'old', text: '旧消息', created_at: '2026-05-11T09:59:00.000Z' }),
    inboxMessage({ message_id: 'new', text: '选择 Option C', created_at: '2026-05-11T10:06:00.000Z' }),
  ]);

  const result = await resolveHumanReviewFromHermesInbox({
    runDir,
    inboxPath,
    resolvedAt: '2026-05-11T10:07:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.written, false);
  assert.equal(result.review.id, 'agent25-option-selection');
  assert.equal(result.inboxMessage.text, '选择 Option C');
  assert.equal((await readEvents(eventPath)).length, 1);
});

test('--write appends a resolved event and preserves the open event', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [openReview()]);
  await writeJsonl(inboxPath, [inboxMessage({ text: '选择 Option B' })]);

  const result = await resolveHumanReviewFromHermesInbox({
    runDir,
    inboxPath,
    write: true,
    resolvedAt: '2026-05-11T10:08:00.000Z',
  });

  const events = await readEvents(eventPath);
  assert.equal(result.ok, true);
  assert.equal(result.written, true);
  assert.equal(events.length, 2);
  assert.equal(events[0].status, 'open');
  assert.equal(events[1].status, 'resolved');
  assert.equal(events[1].blocking, false);
  assert.equal(events[1].resolution_text, '选择 Option B');
  assert.equal(events[1].resolution_source, 'hermes_inbox');
  assert.equal(events[1].resolved_by, 'hermes-inbox:telegram:123');
  assert.equal(events[1].inbox_message_key, 'telegram:123:456:2026-05-11T10:05:00.000Z');
});

test('missing inbox returns a friendly no-reply message', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [openReview()]);

  const result = await resolveHumanReviewFromHermesInbox({ runDir, inboxPath });

  assert.equal(result.ok, false);
  assert.equal(result.message, '没有可用于当前审核点的 Hermes inbox 回复');
});

test('multiple open reviews without review id are blocked', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [
    openReview({ id: 'agent25-option-selection' }),
    openReview({ id: 'final-qa-launch-approval', review_type: 'final_qa_launch_approval' }),
  ]);
  await writeJsonl(inboxPath, [inboxMessage({ text: '选择 Option A' })]);

  const result = await resolveHumanReviewFromHermesInbox({ runDir, inboxPath });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'multiple-open-reviews');
  assert.match(result.message, /review:<review-id>/);
  assert.match(result.message, /agent25-option-selection/);
  assert.match(result.message, /final-qa-launch-approval/);
});

test('multiple open reviews resolve the one named by review id', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [
    openReview({ id: 'agent25-option-selection' }),
    openReview({
      id: 'final-qa-launch-approval',
      review_type: 'final_qa_launch_approval',
      title: 'Approve production launch',
      message: 'Final QA has passed.',
    }),
  ]);
  await writeJsonl(inboxPath, [
    inboxMessage({
      text: 'review:final-qa-launch-approval 批准上线',
      message_id: 'launch',
    }),
  ]);

  const result = await resolveHumanReviewFromHermesInbox({
    runDir,
    inboxPath,
    write: true,
    resolvedAt: '2026-05-11T10:08:00.000Z',
  });

  const events = await readEvents(eventPath);
  assert.equal(result.ok, true);
  assert.equal(result.review.id, 'final-qa-launch-approval');
  assert.equal(events.at(-1).id, 'final-qa-launch-approval');
  assert.equal(events.at(-1).resolution_text, 'review:final-qa-launch-approval 批准上线');
});

test('consumed inbox_message_key is not reused', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  const consumedKey = 'telegram:123:456:2026-05-11T10:05:00.000Z';
  await writeJsonl(eventPath, [
    openReview(),
    {
      ...openReview(),
      status: 'resolved',
      blocking: false,
      resolved_at: '2026-05-11T10:08:00.000Z',
      resolution_source: 'hermes_inbox',
      inbox_message_key: consumedKey,
    },
    openReview({ created_at: '2026-05-11T10:09:00.000Z' }),
  ]);
  await writeJsonl(inboxPath, [inboxMessage()]);

  const result = await resolveHumanReviewFromHermesInbox({ runDir, inboxPath });

  assert.equal(result.ok, false);
  assert.equal(result.message, '没有可用于当前审核点的 Hermes inbox 回复');
});
