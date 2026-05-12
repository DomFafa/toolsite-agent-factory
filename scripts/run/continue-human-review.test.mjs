import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  continueHumanReview,
  GATES_BLOCKED,
  INVALID_REPLY,
  NO_OPEN_REVIEW,
  NO_REPLY_FOUND,
  REVIEW_RESOLVED,
  SMOKE_NOT_DEPLOYABLE,
} from './continue-human-review.mjs';

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'continue-human-review-'));
  const runDir = path.join(root, 'runs', 'sample-site');
  const inboxPath = path.join(root, 'hermes-home/state/toolsite-inbox.jsonl');
  await mkdir(runDir, { recursive: true });
  await mkdir(path.dirname(inboxPath), { recursive: true });
  return {
    root,
    runDir,
    inboxPath,
    eventPath: path.join(runDir, 'human-review-events.jsonl'),
  };
}

async function writeJsonl(filePath, records) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, records.length > 0 ? `${records.map((record) => JSON.stringify(record)).join('\n')}\n` : '');
}

async function readEvents(eventPath) {
  const text = await readFile(eventPath, 'utf8');
  return text
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function review(overrides = {}) {
  return {
    schema_version: 'human-review-event.v1',
    type: 'human_review',
    review_type: 'pre_agent2_spec_confirmation',
    id: 'pre-agent2-spec-confirmation',
    site_id: 'sample-site',
    run_dir: 'runs/sample-site',
    phase: 'pre-agent2',
    agent: 'pre-agent2-toolsite-spec',
    status: 'open',
    blocking: true,
    blocks: 'agent-2',
    title: 'Confirm SPEC',
    message: '请确认 SPEC。',
    expected_reply: '确认 SPEC / 修改：...',
    attachments: [],
    created_at: '2026-05-11T10:00:00.000Z',
    created_by: 'codex',
    ...overrides,
  };
}

function inbox(overrides = {}) {
  return {
    type: 'user_message',
    source: 'telegram',
    chat_id: '123',
    message_id: '456',
    text: '确认 SPEC',
    created_at: '2026-05-11T10:05:00.000Z',
    handled: false,
    ...overrides,
  };
}

test('no open review exits cleanly', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, []);
  await writeJsonl(inboxPath, [inbox()]);

  const result = await continueHumanReview({ runDir, inboxPath });

  assert.equal(result.ok, true);
  assert.equal(result.code, NO_OPEN_REVIEW);
});

test('no inbox reply exits cleanly', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [review()]);
  await writeJsonl(inboxPath, []);

  const result = await continueHumanReview({ runDir, inboxPath });

  assert.equal(result.ok, false);
  assert.equal(result.code, NO_REPLY_FOUND);
});

test('invalid option reply does not advance or resolve', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [
    review({
      review_type: 'agent25_option_selection',
      id: 'agent25-option-selection',
      phase: 'agent-2.5',
      blocks: 'agent-3',
      expected_reply: 'A / B / C',
    }),
  ]);
  await writeJsonl(inboxPath, [inbox({ text: '7' })]);
  const stages = [];

  const result = await continueHumanReview({
    runDir,
    inboxPath,
    advance: async (stage) => {
      stages.push(stage);
      return { ok: true };
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, INVALID_REPLY);
  assert.deepEqual(stages, []);
  assert.equal((await readEvents(eventPath)).length, 1);
});

test('consumes 确认 SPEC and resolves pre-agent2-spec-confirmation', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [review()]);
  await writeJsonl(inboxPath, [inbox({ text: '确认 SPEC' })]);
  const stages = [];

  const result = await continueHumanReview({
    runDir,
    inboxPath,
    now: () => '2026-05-11T10:10:00.000Z',
    advance: async (stage) => {
      stages.push(stage);
      return { ok: true, stage };
    },
  });

  const events = await readEvents(eventPath);
  assert.equal(result.ok, true);
  assert.equal(result.code, REVIEW_RESOLVED);
  assert.deepEqual(stages, ['agent-2']);
  assert.equal(events.length, 2);
  assert.equal(events.at(-1).status, 'resolved');
  assert.equal(events.at(-1).resolution_text, '确认 SPEC');
});

test('consumes A and resolves agent25-option-selection with selected_option=A', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [
    review({
      review_type: 'agent25_option_selection',
      id: 'agent25-option-selection',
      phase: 'agent-2.5',
      blocks: 'agent-3',
    }),
  ]);
  await writeJsonl(inboxPath, [inbox({ text: 'A' })]);
  const stages = [];

  const result = await continueHumanReview({
    runDir,
    inboxPath,
    now: () => '2026-05-11T10:10:00.000Z',
    advance: async (stage) => {
      stages.push(stage);
      return { ok: true, stage };
    },
  });

  const events = await readEvents(eventPath);
  assert.equal(result.ok, true);
  assert.deepEqual(stages, ['agent-3']);
  assert.equal(result.selectedOption, 'A');
  assert.equal(events.at(-1).selected_option, 'A');
  assert.equal(events.at(-1).selected_design, 'Option A');
});

test('default Agent2.5 option selection blocks Agent3 when proof gates are missing', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [
    review({
      review_type: 'agent25_option_selection',
      id: 'agent25-option-selection',
      phase: 'agent-2.5',
      blocks: 'agent-3',
    }),
  ]);
  await writeJsonl(inboxPath, [inbox({ text: 'A' })]);

  const result = await continueHumanReview({
    runDir,
    inboxPath,
    now: () => '2026-05-11T10:10:00.000Z',
  });

  const events = await readEvents(eventPath);
  assert.equal(result.ok, false);
  assert.equal(result.code, GATES_BLOCKED);
  assert.equal(result.selectedOption, 'A');
  assert.equal(events.at(-1).status, 'resolved');
  assert.equal(events.at(-1).selected_option, 'A');
  assert.match(result.advanceResult.gateResult.missing.join('\n'), /agent-2-5|agent25|external-design/i);
});

test('duplicate inbox message is not consumed twice', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [review()]);
  await writeJsonl(inboxPath, [inbox({ text: '确认 SPEC' })]);

  const first = await continueHumanReview({ runDir, inboxPath, advance: async () => ({ ok: true }) });
  const second = await continueHumanReview({ runDir, inboxPath, advance: async () => ({ ok: true }) });

  assert.equal(first.ok, true);
  assert.equal(second.code, NO_OPEN_REVIEW);
  assert.equal((await readEvents(eventPath)).filter((event) => event.status === 'resolved').length, 1);
});

test('smoke run cannot deploy', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeFile(path.join(runDir, 'run-meta.json'), JSON.stringify({ run_type: 'smoke', deployable: false }));
  await writeJsonl(eventPath, [
    review({
      review_type: 'pre_deploy_approval',
      id: 'pre-deploy-approval',
      phase: 'agent-5',
      blocks: 'agent-6',
      expected_reply: '确认部署 / 修改：...',
    }),
  ]);
  await writeJsonl(inboxPath, [inbox({ text: '确认部署' })]);

  const result = await continueHumanReview({ runDir, inboxPath });

  assert.equal(result.ok, false);
  assert.equal(result.code, SMOKE_NOT_DEPLOYABLE);
  assert.equal((await readEvents(eventPath)).length, 1);
});

test('production pre-deploy approval still requires gate evidence integrity before Agent6', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeFile(path.join(runDir, 'run-meta.json'), JSON.stringify({ run_type: 'production', deployable: true }));
  await writeJsonl(eventPath, [
    review({
      review_type: 'pre_deploy_approval',
      id: 'pre-deploy-approval',
      phase: 'agent-5',
      blocks: 'agent-6',
      expected_reply: '确认部署 / 修改：...',
    }),
  ]);
  await writeJsonl(inboxPath, [inbox({ text: '确认部署' })]);

  const result = await continueHumanReview({ runDir, inboxPath });

  assert.equal(result.ok, false);
  assert.equal(result.code, GATES_BLOCKED);
  assert.match(result.gateResult.missing.join('\n'), /gate|agent|approval|final/i);
  assert.equal((await readEvents(eventPath)).length, 1);
});

test('does not modify Hermes inbox', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [review()]);
  const inboxText = `${JSON.stringify(inbox({ text: '确认 SPEC' }))}\n`;
  await writeFile(inboxPath, inboxText);

  await continueHumanReview({ runDir, inboxPath, advance: async () => ({ ok: true }) });

  assert.equal(await readFile(inboxPath, 'utf8'), inboxText);
});
