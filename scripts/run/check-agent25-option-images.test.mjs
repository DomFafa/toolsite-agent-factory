import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  AGENT25_OPTION_IMAGES_BLOCK_MESSAGE,
  runAgent25OptionImagesGate,
} from './check-agent25-option-images.mjs';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP_HEADER = Buffer.from('RIFFxxxxWEBP', 'ascii');

async function makeRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'agent25-option-images-'));
  const runDir = path.join(root, 'runs', 'sample-site');
  await mkdir(path.join(runDir, 'agent-2-5-output/chat-delivery'), { recursive: true });
  return runDir;
}

function imageBytes(header, size = 11 * 1024) {
  return Buffer.concat([header, Buffer.alloc(size - header.length, 1)]);
}

async function writeOptionsBoard(runDir, { header = PNG_HEADER, size = 11 * 1024 } = {}) {
  await writeFile(
    path.join(runDir, 'agent-2-5-output/chat-delivery/options-board.png'),
    imageBytes(header, size),
  );
}

async function writeReview(runDir, { attachment = true, kind = 'image', status = 'open', pathValue = 'agent-2-5-output/chat-delivery/options-board.png' } = {}) {
  const attachments = attachment ? [{ label: 'Options board', path: pathValue, kind, required: true }] : [];
  await writeFile(
    path.join(runDir, 'human-review-events.jsonl'),
    `${JSON.stringify({
      schema_version: 'human-review-event.v1',
      type: 'human_review',
      review_type: 'agent25_option_selection',
      id: 'agent25-option-selection',
      site_id: 'sample-site',
      run_dir: 'runs/sample-site',
      phase: 'agent-2.5',
      agent: 'agent-2.5-ui-design-generation',
      status,
      blocking: status === 'open',
      blocks: 'agent-3',
      title: 'Choose UI option',
      message: 'Choose Option A, Option B, or Option C.',
      expected_reply: 'Reply with Option A / Option B / Option C.',
      attachments,
      created_at: '2026-05-11T00:00:00.000Z',
      created_by: 'codex-test',
    })}\n`,
  );
}

test('fails when options-board.png is missing', async () => {
  const runDir = await makeRun();
  await writeReview(runDir);

  const result = await runAgent25OptionImagesGate({ runDir });
  assert.equal(result.passed, false);
  assert.equal(result.failures[0], AGENT25_OPTION_IMAGES_BLOCK_MESSAGE);
  assert.match(result.failures.join('\n'), /missing agent-2-5-output\/chat-delivery\/options-board\.png/);
});

test('fails when options-board.png is not an image', async () => {
  const runDir = await makeRun();
  await writeFile(path.join(runDir, 'agent-2-5-output/chat-delivery/options-board.png'), 'not an image'.repeat(1000));
  await writeReview(runDir);

  const result = await runAgent25OptionImagesGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /not a recognized PNG, JPEG, or WebP image/);
});

test('fails when options-board.png is too small', async () => {
  const runDir = await makeRun();
  await writeOptionsBoard(runDir, { size: 128 });
  await writeReview(runDir);

  const result = await runAgent25OptionImagesGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /too small/);
});

test('fails when latest open review does not attach image options-board.png', async () => {
  const runDir = await makeRun();
  await writeOptionsBoard(runDir);
  await writeReview(runDir, { kind: 'markdown' });

  const result = await runAgent25OptionImagesGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /attachments must include agent-2-5-output\/chat-delivery\/options-board\.png with kind: image/);
});

test('fails when latest option selection review is not open', async () => {
  const runDir = await makeRun();
  await writeOptionsBoard(runDir);
  await writeReview(runDir, { status: 'resolved' });

  const result = await runAgent25OptionImagesGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /not open/);
});

test('passes with a reviewable PNG and image attachment', async () => {
  const runDir = await makeRun();
  await writeOptionsBoard(runDir);
  await writeReview(runDir);

  const result = await runAgent25OptionImagesGate({ runDir });
  assert.equal(result.passed, true);
  assert.equal(result.details.optionsBoard.format, 'png');
});

test('recognizes JPEG and WebP option board files', async () => {
  for (const [header, format] of [
    [JPEG_HEADER, 'jpeg'],
    [WEBP_HEADER, 'webp'],
  ]) {
    const runDir = await makeRun();
    await writeOptionsBoard(runDir, { header });
    await writeReview(runDir);

    const result = await runAgent25OptionImagesGate({ runDir });
    assert.equal(result.passed, true);
    assert.equal(result.details.optionsBoard.format, format);
  }
});
