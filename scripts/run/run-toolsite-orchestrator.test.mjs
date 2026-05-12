import assert from 'node:assert/strict';
import { appendFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { GATES_BLOCKED, REVIEW_RESOLVED, SMOKE_NOT_DEPLOYABLE } from './continue-human-review.mjs';
import {
  DEPLOY_BLOCKED,
  NEXT_STAGE_READY,
  runToolsiteOrchestrator,
  STOPPED_AT_HUMAN_REVIEW,
} from './run-toolsite-orchestrator.mjs';

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'run-toolsite-orchestrator-'));
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

async function appendJsonl(filePath, record) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(record)}\n`);
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
    message: 'Choose Option A, B, or C.',
    expected_reply: 'A / B / C',
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
    text: 'A',
    created_at: '2026-05-11T10:05:00.000Z',
    handled: false,
    ...overrides,
  };
}

test('run:toolsite stops at existing human_review when not remote', async () => {
  const { runDir, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [review()]);

  const result = await runToolsiteOrchestrator({ runDir, remote: false });

  assert.equal(result.ok, true);
  assert.equal(result.code, STOPPED_AT_HUMAN_REVIEW);
  assert.equal(result.openReviews[0].id, 'agent25-option-selection');
});

test('run:toolsite consumes open review in remote mode and stops at next human_review', async () => {
  const { runDir, inboxPath, eventPath } = await makeFixture();
  await writeJsonl(eventPath, [review()]);
  await writeJsonl(inboxPath, [inbox({ text: 'A' })]);

  const result = await runToolsiteOrchestrator({
    runDir,
    inboxPath,
    remote: true,
    continueReview: async () => {
      await appendJsonl(eventPath, { ...review(), status: 'resolved', blocking: false, selected_option: 'A' });
      await appendJsonl(eventPath, {
        ...review({
          id: 'pre-deploy-approval',
          review_type: 'pre_deploy_approval',
          phase: 'agent-5',
          blocks: 'agent-6',
        }),
      });
      return { ok: true, code: REVIEW_RESOLVED };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, STOPPED_AT_HUMAN_REVIEW);
  assert.equal(result.openReviews[0].id, 'pre-deploy-approval');
});

test('run:toolsite starts next stage and stops when that stage opens a review', async () => {
  const { runDir, eventPath } = await makeFixture();
  await writeFile(path.join(runDir, 'toolsite-spec.md'), '# SPEC\n');

  const result = await runToolsiteOrchestrator({
    runDir,
    remote: true,
    stageRunner: async ({ stage }) => {
      assert.equal(stage, 'agent-2');
      await appendJsonl(
        eventPath,
        review({
          id: 'agent2-brief-exception',
          review_type: 'agent2_brief_exception',
          phase: 'agent-2',
          blocks: 'agent-2.5',
        }),
      );
      return { ok: true, stage };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, STOPPED_AT_HUMAN_REVIEW);
  assert.equal(result.stage, 'agent-2');
  assert.equal(result.openReviews[0].id, 'agent2-brief-exception');
});

test('default stage runner reports next stage without creating site source', async () => {
  const { runDir } = await makeFixture();
  await writeFile(path.join(runDir, 'toolsite-spec.md'), '# SPEC\n');

  const result = await runToolsiteOrchestrator({ runDir, remote: true });

  assert.equal(result.ok, true);
  assert.equal(result.code, NEXT_STAGE_READY);
  assert.equal(result.stage, 'agent-2');
});

test('smoke run cannot deploy', async () => {
  const { runDir } = await makeFixture();
  await writeFile(path.join(runDir, 'run-meta.json'), JSON.stringify({ run_type: 'smoke', deployable: false }));
  await mkdir(path.join(runDir, 'agent-5-output'), { recursive: true });
  await writeFile(path.join(runDir, 'toolsite-spec.md'), '# SPEC\n');
  await mkdir(path.join(runDir, 'agent-2-output'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-2-output/site-brief.md'), '# Site brief\n');
  await mkdir(path.join(runDir, 'agent-2-5-output/chat-delivery'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-2-5-output/chat-delivery/options-board.png'), 'png');
  await mkdir(path.join(runDir, 'agent-3-output'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-3-output/implementation-handoff.md'), '# Handoff\n');
  await mkdir(path.join(runDir, 'site'), { recursive: true });
  await writeFile(path.join(runDir, 'site/package.json'), '{}\n');
  await writeFile(path.join(runDir, 'agent-5-output/final-qa-report.md'), '# Final QA\n');

  const result = await runToolsiteOrchestrator({ runDir, remote: true });

  assert.equal(result.ok, false);
  assert.equal(result.code, DEPLOY_BLOCKED);
  assert.match(result.message, /Smoke runs are not deployable/);
});

test('production run still requires gate evidence integrity before Agent6', async () => {
  const { runDir } = await makeFixture();
  await writeFile(path.join(runDir, 'run-meta.json'), JSON.stringify({ run_type: 'production', deployable: true }));
  await mkdir(path.join(runDir, 'agent-5-output'), { recursive: true });
  await writeFile(path.join(runDir, 'toolsite-spec.md'), '# SPEC\n');
  await mkdir(path.join(runDir, 'agent-2-output'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-2-output/site-brief.md'), '# Site brief\n');
  await mkdir(path.join(runDir, 'agent-2-5-output/chat-delivery'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-2-5-output/chat-delivery/options-board.png'), 'png');
  await mkdir(path.join(runDir, 'agent-3-output'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-3-output/implementation-handoff.md'), '# Handoff\n');
  await mkdir(path.join(runDir, 'site'), { recursive: true });
  await writeFile(path.join(runDir, 'site/package.json'), '{}\n');
  await writeFile(path.join(runDir, 'agent-5-output/final-qa-report.md'), '# Final QA\n');

  const result = await runToolsiteOrchestrator({ runDir, remote: true });

  assert.equal(result.ok, false);
  assert.equal(result.code, DEPLOY_BLOCKED);
  assert.equal(result.gateResult.allowed, false);
});

test('does not deploy unless pre_deploy_approval is explicitly confirmed on production run', async () => {
  const { runDir, eventPath } = await makeFixture();
  await writeFile(path.join(runDir, 'run-meta.json'), JSON.stringify({ run_type: 'production', deployable: true }));
  await writeJsonl(eventPath, [
    review({
      id: 'pre-deploy-approval',
      review_type: 'pre_deploy_approval',
      phase: 'agent-5',
      blocks: 'agent-6',
    }),
  ]);
  let stageRunnerCalled = false;

  const result = await runToolsiteOrchestrator({
    runDir,
    remote: false,
    stageRunner: async () => {
      stageRunnerCalled = true;
      return { ok: true };
    },
  });

  assert.equal(result.code, STOPPED_AT_HUMAN_REVIEW);
  assert.equal(stageRunnerCalled, false);
  assert.equal((await readEvents(eventPath)).filter((event) => event.status === 'resolved').length, 0);
});
