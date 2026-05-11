#!/usr/bin/env node
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { resultFromFailures, writeGateResult } from './gate-result-utils.mjs';

export const AGENT25_OPTION_IMAGES_BLOCK_MESSAGE =
  'Agent2.5 UI Option Selection is blocked because no reviewable UI images were generated.';

const OPTIONS_BOARD_PATH = 'agent-2-5-output/chat-delivery/options-board.png';
const HUMAN_REVIEW_EVENTS_PATH = 'human-review-events.jsonl';
const MIN_IMAGE_BYTES = 10 * 1024;

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
  const args = { write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') {
      args.write = true;
    } else if (arg === '--run-dir') {
      args.runDir = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.runDir && !args.help) {
    throw new Error('Usage: node scripts/run/check-agent25-option-images.mjs --run-dir runs/<site-id> [--write]');
  }
  return args;
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
  const handle = await readFile(filePath);
  return {
    exists: true,
    size: fileStat.size,
    format: isRecognizedImage(handle.subarray(0, 16)),
  };
}

function parseJsonl(text) {
  const events = [];
  for (const [index, rawLine] of String(text || '').split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      events.push({ __invalid: true, line: index + 1 });
    }
  }
  return events;
}

function normalizePath(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function findLatestOptionSelection(events) {
  return events
    .filter(
      (event) =>
        event &&
        !event.__invalid &&
        event.type === 'human_review' &&
        (event.review_type === 'agent25_option_selection' || event.id === 'agent25-option-selection'),
    )
    .at(-1);
}

function hasOptionsBoardImageAttachment(review) {
  const attachments = Array.isArray(review?.attachments) ? review.attachments : [];
  return attachments.some((attachment) => {
    if (!attachment || typeof attachment !== 'object') return false;
    return normalizePath(attachment.path) === OPTIONS_BOARD_PATH && String(attachment.kind || '').toLowerCase() === 'image';
  });
}

export async function runAgent25OptionImagesGate({ runDir }) {
  const absoluteRunDir = path.resolve(runDir);
  const optionsBoardPath = path.join(absoluteRunDir, OPTIONS_BOARD_PATH);
  const failures = [];
  const image = await inspectImage(optionsBoardPath);

  if (!image.exists) {
    failures.push(`missing ${OPTIONS_BOARD_PATH}`);
  } else {
    if (!image.format) failures.push(`${OPTIONS_BOARD_PATH} is not a recognized PNG, JPEG, or WebP image`);
    if (image.size < MIN_IMAGE_BYTES) failures.push(`${OPTIONS_BOARD_PATH} is too small to be a reviewable UI image`);
  }

  const eventsText = await readOptional(path.join(absoluteRunDir, HUMAN_REVIEW_EVENTS_PATH));
  const events = parseJsonl(eventsText);
  const invalidLine = events.find((event) => event.__invalid);
  if (invalidLine) failures.push(`${HUMAN_REVIEW_EVENTS_PATH} contains invalid JSONL at line ${invalidLine.line}`);

  const latestReview = findLatestOptionSelection(events);
  if (!latestReview) {
    failures.push('missing latest agent25-option-selection human_review event');
  } else {
    if (latestReview.status !== 'open') failures.push('latest agent25-option-selection human_review event is not open');
    if (!hasOptionsBoardImageAttachment(latestReview)) {
      failures.push(`latest agent25-option-selection attachments must include ${OPTIONS_BOARD_PATH} with kind: image`);
    }
  }

  return resultFromFailures({
    gate: 'agent25-option-images',
    runDir: absoluteRunDir,
    failures: failures.length > 0 ? [AGENT25_OPTION_IMAGES_BLOCK_MESSAGE, ...failures] : [],
    details: {
      optionsBoard: {
        path: OPTIONS_BOARD_PATH,
        exists: image.exists,
        size: image.size,
        format: image.format || null,
        minBytes: MIN_IMAGE_BYTES,
      },
      latestReview: latestReview
        ? {
            id: latestReview.id || null,
            review_type: latestReview.review_type || null,
            status: latestReview.status || null,
          }
        : null,
    },
    evidence: {
      optionsBoard: OPTIONS_BOARD_PATH,
      humanReviewEvents: HUMAN_REVIEW_EVENTS_PATH,
      output: 'gate-results/agent25-option-images.json',
    },
  });
}

function usage() {
  return 'Usage: node scripts/run/check-agent25-option-images.mjs --run-dir runs/<site-id> [--write]';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const result = await runAgent25OptionImagesGate({ runDir: args.runDir });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'agent25-option-images.json', result);

  if (result.passed) {
    console.log('PASS Agent2.5 UI option images');
  } else {
    console.log(AGENT25_OPTION_IMAGES_BLOCK_MESSAGE);
    for (const failure of result.failures.filter((failure) => failure !== AGENT25_OPTION_IMAGES_BLOCK_MESSAGE)) {
      console.log(`- ${failure}`);
    }
  }
  process.exitCode = result.passed ? 0 : 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 2;
  });
}
