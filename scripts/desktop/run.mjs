#!/usr/bin/env node
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  parseRunInput,
  renderSpecReviewCard,
  renderToolsiteSpec,
  splitTelegramMessages,
} from '../run/pre-agent2-telegram-loop.mjs';

export const NO_STAGE_RUNNER_CONFIGURED = 'NO_STAGE_RUNNER_CONFIGURED';
export const SPEC_REVIEW_OPEN = 'SPEC_REVIEW_OPEN';
export const HUMAN_REVIEW_REQUIRED = 'HUMAN_REVIEW_REQUIRED';
export const DESKTOP_STAGE_DONE = 'DESKTOP_STAGE_DONE';
export const DEPLOY_REQUIRES_APPROVAL = 'DEPLOY_REQUIRES_APPROVAL';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const STATE_FILE = 'desktop-run-state.json';
const EVENT_FILE = 'human-review-events.jsonl';

const STAGE_RUNNERS = new Set(['pre-agent2']);

function nowIso() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const args = { rootDir: REPO_ROOT, stage: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    } else if (arg === '--stage') {
      args.stage = argv[index + 1];
      index += 1;
    } else if (arg === '--root-dir') {
      args.rootDir = argv[index + 1];
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.help && !args.runDir) throw new Error('Usage: node scripts/desktop/run.mjs --run-dir runs/<site-id> [--stage <stage>]');
  return args;
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function readJsonOptional(filePath) {
  const text = await readOptional(filePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readEvents(runDir) {
  const text = await readOptional(path.join(runDir, EVENT_FILE));
  return text.trim()
    ? text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
    : [];
}

function latestEventsById(events) {
  const latest = new Map();
  for (const event of events) latest.set(event.id, event);
  return latest;
}

function openReview(events, reviewType) {
  return [...events].reverse().find((event) => event.type === 'human_review' && event.review_type === reviewType && event.status === 'open');
}

function confirmedReview(events, reviewType) {
  return [...events].reverse().find((event) =>
    event.type === 'human_review' &&
    event.review_type === reviewType &&
    event.status === 'resolved' &&
    event.resolution_text === '确认 SPEC');
}

export async function readDesktopState(runDir) {
  return (await readJsonOptional(path.join(runDir, STATE_FILE))) || {
    mode: 'desktop',
    stage: 'pre-agent2',
    last_completed_stage: null,
    next_action: 'Run desktop:run.',
    blocking_reason: null,
    repair_attempts: {},
  };
}

export async function writeDesktopState(runDir, state) {
  await mkdir(runDir, { recursive: true });
  const value = {
    mode: 'desktop',
    stage: state.stage || 'pre-agent2',
    last_completed_stage: state.last_completed_stage || null,
    next_action: state.next_action || '',
    blocking_reason: state.blocking_reason || null,
    repair_attempts: state.repair_attempts || {},
    updated_at: state.updated_at || nowIso(),
  };
  await writeFile(path.join(runDir, STATE_FILE), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return value;
}

async function appendReview(runDir, event) {
  await appendFile(path.join(runDir, EVENT_FILE), `${JSON.stringify(event)}\n`);
}

function siteIdFromRunDir(runDir) {
  return path.basename(path.resolve(runDir));
}

export async function runDesktopPreAgent2({ runDir, now = nowIso } = {}) {
  const inputText = await readFile(path.join(runDir, 'input.md'), 'utf8');
  const intake = parseRunInput(inputText);
  const siteId = siteIdFromRunDir(runDir);
  const specText = renderToolsiteSpec({
    siteId,
    intake,
    answeredEvents: [],
    allowEarlySpec: true,
  });
  const specPath = path.join(runDir, 'toolsite-spec.md');
  await writeFile(specPath, specText, 'utf8');

  const events = await readEvents(runDir);
  const latest = latestEventsById(events);
  const existing = latest.get('spec-confirmation');
  if (!existing || existing.status !== 'open') {
    const message = renderSpecReviewCard({ specText, specPath });
    await appendReview(runDir, {
      schema_version: 'human-review-event.v1',
      type: 'human_review',
      review_type: 'spec-confirmation',
      id: 'spec-confirmation',
      site_id: siteId,
      run_dir: runDir,
      phase: 'pre-agent2',
      agent: 'desktop-pre-agent2',
      status: 'open',
      blocking: true,
      blocks: 'agent-2',
      title: 'Toolsite SPEC confirmation',
      message,
      message_chunks: splitTelegramMessages(message),
      expected_reply: '确认 SPEC / 修改：...',
      attachments: [specPath],
      created_at: now(),
      created_by: 'codex',
    });
  }

  await writeDesktopState(runDir, {
    stage: 'spec-review',
    last_completed_stage: 'pre-agent2',
    next_action: 'Review toolsite-spec.md and confirm SPEC with desktop:continue.',
    blocking_reason: 'spec-confirmation',
    repair_attempts: (await readDesktopState(runDir)).repair_attempts,
  });

  return { ok: true, code: SPEC_REVIEW_OPEN, runDir, stage: 'spec-review', specPath };
}

function configuredStage(stage) {
  return STAGE_RUNNERS.has(stage);
}

export async function runDesktopStage({ runDir, stage = '', now = nowIso } = {}) {
  const state = await readDesktopState(runDir);
  const targetStage = stage || state.stage || 'pre-agent2';
  const events = await readEvents(runDir);

  if (targetStage === 'pre-agent2') return runDesktopPreAgent2({ runDir, now });

  if (targetStage === 'spec-review') {
    if (!confirmedReview(events, 'spec-confirmation')) {
      return { ok: true, code: HUMAN_REVIEW_REQUIRED, stage: 'spec-review', review_type: 'spec-confirmation' };
    }
    await writeDesktopState(runDir, {
      ...state,
      stage: 'agent2',
      last_completed_stage: 'spec-review',
      next_action: 'Run desktop:agent2.',
      blocking_reason: null,
    });
    return { ok: true, code: DESKTOP_STAGE_DONE, stage: 'agent2' };
  }

  if (targetStage === 'deploy') {
    const approval = [...events].reverse().find((event) =>
      event.review_type === 'pre-deploy-approval' &&
      event.status === 'resolved' &&
      event.resolution_text === '确认部署');
    if (!approval) {
      await writeDesktopState(runDir, {
        ...state,
        stage: 'deploy-review',
        next_action: 'Confirm deployment before desktop:deploy.',
        blocking_reason: 'pre-deploy-approval',
      });
      return { ok: false, code: DEPLOY_REQUIRES_APPROVAL, stage: 'deploy-review' };
    }
  }

  if (!configuredStage(targetStage)) {
    await writeDesktopState(runDir, {
      ...state,
      stage: targetStage,
      next_action: `Configure a real runner for ${targetStage}.`,
      blocking_reason: NO_STAGE_RUNNER_CONFIGURED,
    });
    return { ok: false, code: NO_STAGE_RUNNER_CONFIGURED, stage: targetStage };
  }

  return { ok: true, code: DESKTOP_STAGE_DONE, stage: targetStage };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/desktop/run.mjs --run-dir runs/<site-id> [--stage <stage>]');
    return;
  }
  const result = await runDesktopStage(args);
  console.log(result.code);
  if (result.stage) console.log(`stage: ${result.stage}`);
  if (result.specPath) console.log(`spec: ${result.specPath}`);
  process.exitCode = result.ok ? 0 : 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}

