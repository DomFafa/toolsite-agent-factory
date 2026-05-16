#!/usr/bin/env node
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readDesktopState, writeDesktopState } from './run.mjs';

export const REVIEW_RESOLVED = 'REVIEW_RESOLVED';
export const SPEC_NOT_CONFIRMED = 'SPEC_NOT_CONFIRMED';
export const INVALID_REPLY = 'INVALID_REPLY';
export const NO_OPEN_REVIEW = 'NO_OPEN_REVIEW';

const UI_OPTION_REVIEW_TYPES = new Set([
  'ui-option-selection',
  'agent25_option_selection',
  'desktop_ui_option_selection',
]);

function nowIso() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    } else if (arg === '--review') {
      args.review = argv[index + 1];
      index += 1;
    } else if (arg === '--reply') {
      args.reply = argv[index + 1];
      index += 1;
    } else if (arg === '--option') {
      args.review = args.review || 'ui-option-selection';
      args.reply = argv[index + 1];
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.help && (!args.runDir || !args.review || !args.reply)) {
    throw new Error('Usage: node scripts/desktop/continue.mjs --run-dir runs/<site-id> --review <review-type> --reply <reply>');
  }
  return args;
}

async function readEvents(runDir) {
  const text = await readFile(path.join(runDir, 'human-review-events.jsonl'), 'utf8').catch(() => '');
  return text.trim()
    ? text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
    : [];
}

function reviewTypeMatches(event, reviewType) {
  if (event.review_type === reviewType) return true;
  if (UI_OPTION_REVIEW_TYPES.has(reviewType)) {
    return UI_OPTION_REVIEW_TYPES.has(event.review_type) || event.id === 'agent25-option-selection';
  }
  return false;
}

function latestOpenReview(events, reviewType) {
  return [...events].reverse().find((event) =>
    event.type === 'human_review' &&
    reviewTypeMatches(event, reviewType) &&
    event.status === 'open');
}

function validateReply(reviewType, reply) {
  const value = String(reply || '').trim();
  if (reviewType === 'spec-confirmation') return value === '确认 SPEC' || /^修改[:：]/.test(value);
  if (UI_OPTION_REVIEW_TYPES.has(reviewType)) return /^[ABC]$/i.test(value) || /^重做[:：]/.test(value);
  if (reviewType === 'pre-deploy-approval') return value === '确认部署' || /^修改[:：]/.test(value);
  return false;
}

function nextStateFor(reviewType, reply, state) {
  if (reviewType === 'spec-confirmation') {
    if (reply === '确认 SPEC') {
      return {
        ...state,
        stage: 'agent2',
        last_completed_stage: 'spec-review',
        next_action: 'Run desktop:agent2.',
        blocking_reason: null,
      };
    }
    return {
      ...state,
      stage: 'pre-agent2',
      next_action: 'Apply SPEC change request before regenerating SPEC.',
      blocking_reason: 'spec-change-requested',
    };
  }
  if (UI_OPTION_REVIEW_TYPES.has(reviewType)) {
    if (/^[ABC]$/i.test(reply)) {
      return {
        ...state,
        stage: 'implement',
        last_completed_stage: 'ui-review',
        next_action: 'Run desktop:implement with the selected option.',
        blocking_reason: null,
      };
    }
    return {
      ...state,
      stage: 'agent25',
      next_action: 'Regenerate UI options before implementation.',
      blocking_reason: 'ui-options-rejected',
    };
  }
  if (reviewType === 'pre-deploy-approval') {
    if (reply === '确认部署') {
      return {
        ...state,
        stage: 'deploy',
        last_completed_stage: 'deploy-review',
        next_action: 'Run desktop:deploy.',
        blocking_reason: null,
      };
    }
    return {
      ...state,
      stage: 'qa',
      next_action: 'Apply deployment change request before asking again.',
      blocking_reason: 'deploy-change-requested',
    };
  }
  return state;
}

export async function continueDesktopRun({ runDir, review, reply, now = nowIso } = {}) {
  const state = await readDesktopState(runDir);
  const events = await readEvents(runDir);
  if (state.stage === 'spec-review' && review !== 'spec-confirmation') {
    return { ok: false, code: SPEC_NOT_CONFIRMED, review };
  }
  const openReview = latestOpenReview(events, review);
  if (!openReview) return { ok: false, code: NO_OPEN_REVIEW, review };
  if (!validateReply(review, reply)) return { ok: false, code: INVALID_REPLY, review };

  const resolvedAt = now();
  const resolved = {
    ...openReview,
    status: 'resolved',
    blocking: false,
    resolved_at: resolvedAt,
    resolved_by: 'desktop-user',
    resolution_text: reply,
    selected_option: review === 'ui-option-selection' && /^[ABC]$/i.test(reply) ? reply.toUpperCase() : undefined,
    created_at: resolvedAt,
    created_by: 'codex',
  };
  await appendFile(path.join(runDir, 'human-review-events.jsonl'), `${JSON.stringify(resolved)}\n`);
  await writeDesktopState(runDir, nextStateFor(review, reply, state));
  return { ok: true, code: REVIEW_RESOLVED, review, next_stage: (await readDesktopState(runDir)).stage };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/desktop/continue.mjs --run-dir runs/<site-id> --review <review-type> --reply <reply>');
    return;
  }
  const result = await continueDesktopRun(args);
  console.log(result.code);
  if (result.next_stage) console.log(`next_stage: ${result.next_stage}`);
  process.exitCode = result.ok ? 0 : 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
