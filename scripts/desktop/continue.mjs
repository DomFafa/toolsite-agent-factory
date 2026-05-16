#!/usr/bin/env node
import { access, appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readDesktopState, writeDesktopState } from './run.mjs';
import { runAgent25ExternalDesignProofGate } from '../run/check-agent25-external-design-proof.mjs';
import { runAgent25LineageGate } from '../run/check-agent25-lineage.mjs';
import { runAgent25OptionImagesGate } from '../run/check-agent25-option-images.mjs';
import { gatePasses, writeGateResult } from '../run/gate-result-utils.mjs';
import { runSelectedAssetsGate } from '../qa/check-selected-assets.mjs';

export const REVIEW_RESOLVED = 'REVIEW_RESOLVED';
export const SPEC_NOT_CONFIRMED = 'SPEC_NOT_CONFIRMED';
export const INVALID_REPLY = 'INVALID_REPLY';
export const NO_OPEN_REVIEW = 'NO_OPEN_REVIEW';
export const INVALID_UI_OPTION = 'INVALID_UI_OPTION';
export const UI_REVIEW_REQUIRED = 'UI_REVIEW_REQUIRED';
export const AGENT25_OUTPUT_MISSING = 'AGENT25_OUTPUT_MISSING';
export const AGENT25_EXTERNAL_PROOF_REQUIRED = 'AGENT25_EXTERNAL_PROOF_REQUIRED';
export const AGENT25_OPTION_IMAGE_REQUIRED = 'AGENT25_OPTION_IMAGE_REQUIRED';
export const SELECTED_ASSETS_NOT_READY = 'SELECTED_ASSETS_NOT_READY';

const UI_OPTION_REVIEW_TYPES = new Set([
  'ui-option-selection',
  'agent25_option_selection',
  'desktop_ui_option_selection',
]);
const PRE_DEPLOY_REVIEW_TYPES = new Set([
  'pre-deploy-approval',
  'pre_deploy_approval',
]);
const OPTIONS_BOARD_PATH = 'agent-2-5-output/chat-delivery/options-board.png';
const ACTION_RECEIPT_PATH = 'agent-2-5-output/external-design-evidence/action-receipt.json';
const SELECTED_DESIGN_DIR = 'agent-2-5-output/selected-design';

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

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function reviewTypeMatches(event, reviewType) {
  if (event.review_type === reviewType) return true;
  if (UI_OPTION_REVIEW_TYPES.has(reviewType)) {
    return UI_OPTION_REVIEW_TYPES.has(event.review_type) || event.id === 'agent25-option-selection';
  }
  if (PRE_DEPLOY_REVIEW_TYPES.has(reviewType)) {
    return PRE_DEPLOY_REVIEW_TYPES.has(event.review_type) || event.id === 'pre-deploy-approval';
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
  if (UI_OPTION_REVIEW_TYPES.has(reviewType)) return /^[ABC]$/i.test(value);
  if (PRE_DEPLOY_REVIEW_TYPES.has(reviewType)) return value === '确认部署' || /^修改[:：]/.test(value);
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
  if (PRE_DEPLOY_REVIEW_TYPES.has(reviewType)) {
    if (reply === '确认部署') {
      return {
        ...state,
        stage: 'deploy-review',
        last_completed_stage: 'qa',
        next_action: 'run desktop:deploy',
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

function normalizedUiOption(option) {
  const value = String(option || '').trim().toUpperCase();
  return /^[ABC]$/.test(value) ? value : '';
}

async function blockUiReview(runDir, state, { blockingReason, nextAction, now = nowIso } = {}) {
  await writeDesktopState(runDir, {
    ...state,
    stage: 'ui-review',
    last_completed_stage: state.last_completed_stage || 'agent25',
    next_action: nextAction || 'repair Agent2.5 UI selection prerequisites before rerunning desktop:select-ui',
    blocking_reason: blockingReason,
    updated_at: now(),
  });
}

async function runRequiredAgent25Gates(runDir) {
  const externalProof = await runAgent25ExternalDesignProofGate({ runDir });
  await writeGateResult(runDir, 'agent25-external-design-proof.json', externalProof);
  if (!gatePasses(externalProof)) {
    return {
      ok: false,
      code: AGENT25_EXTERNAL_PROOF_REQUIRED,
      blocking_reason: 'agent25-external-design-proof',
      gates: { externalProof },
    };
  }

  const optionImages = await runAgent25OptionImagesGate({ runDir });
  await writeGateResult(runDir, 'agent25-option-images.json', optionImages);
  if (!gatePasses(optionImages)) {
    return {
      ok: false,
      code: AGENT25_OPTION_IMAGE_REQUIRED,
      blocking_reason: 'agent25-option-images',
      gates: { externalProof, optionImages },
    };
  }

  return { ok: true, gates: { externalProof, optionImages } };
}

async function writeSelectedDesignArtifacts({ runDir, option, selectedAt }) {
  const selectedDesign = `Option ${option}`;
  const selectedDir = path.join(runDir, SELECTED_DESIGN_DIR);
  await mkdir(selectedDir, { recursive: true });

  const selectedOption = {
    selected_option: option,
    selected_design: selectedDesign,
    source_options_board: OPTIONS_BOARD_PATH,
    external_action_receipt: ACTION_RECEIPT_PATH,
    selected_at: selectedAt,
    selection_source: 'desktop:select-ui',
  };
  await writeFile(
    path.join(selectedDir, 'selected-option.json'),
    `${JSON.stringify(selectedOption, null, 2)}\n`,
    'utf8',
  );

  await writeFile(
    path.join(selectedDir, 'selected-design-lineage.md'),
    [
      '# Selected Design Lineage',
      '',
      `- User selected: ${selectedDesign}.`,
      `- Source options board: ${OPTIONS_BOARD_PATH}.`,
      `- External action receipt: ${ACTION_RECEIPT_PATH}.`,
      '- This is not a Codex local self-signed design choice; it is a local human selection linked to Agent2.5 external evidence.',
      '- Agent3 and Agent4 must implement this selected option and must not choose a different A/B/C option.',
      '',
    ].join('\n'),
    'utf8',
  );

  return selectedOption;
}

async function runPostSelectionReadinessGates(runDir) {
  const lineage = await runAgent25LineageGate({ runDir });
  await writeGateResult(runDir, 'agent25-lineage.json', lineage);
  const selectedAssets = await runSelectedAssetsGate({ runDir });
  await writeGateResult(runDir, 'selected-assets.json', selectedAssets);
  return {
    ready: gatePasses(lineage) && gatePasses(selectedAssets),
    lineage,
    selectedAssets,
  };
}

export async function selectDesktopUiOption({ runDir, option, review = 'ui-option-selection', now = nowIso } = {}) {
  const selectedOption = normalizedUiOption(option);
  if (!selectedOption) return { ok: false, code: INVALID_UI_OPTION, review };

  const state = await readDesktopState(runDir);
  if (state.stage !== 'ui-review' || state.last_completed_stage !== 'agent25') {
    return {
      ok: false,
      code: UI_REVIEW_REQUIRED,
      stage: state.stage || '',
      last_completed_stage: state.last_completed_stage || null,
    };
  }

  const events = await readEvents(runDir);
  const openReview = latestOpenReview(events, review);
  if (!openReview) return { ok: false, code: UI_REVIEW_REQUIRED, review };

  const missingOutputs = [];
  for (const relPath of [OPTIONS_BOARD_PATH, ACTION_RECEIPT_PATH]) {
    if (!(await exists(path.join(runDir, relPath)))) missingOutputs.push(relPath);
  }
  if (missingOutputs.length > 0) {
    await blockUiReview(runDir, state, {
      blockingReason: 'agent25-output-missing',
      nextAction: 'restore Agent2.5 option board and action receipt before desktop:select-ui',
      now,
    });
    return { ok: false, code: AGENT25_OUTPUT_MISSING, missing: missingOutputs };
  }

  const requiredGates = await runRequiredAgent25Gates(runDir);
  if (!requiredGates.ok) {
    await blockUiReview(runDir, state, {
      blockingReason: requiredGates.blocking_reason,
      nextAction: 'repair Agent2.5 evidence before desktop:select-ui',
      now,
    });
    return { ok: false, code: requiredGates.code, gates: requiredGates.gates };
  }

  const resolvedAt = now();
  const selectedDesign = `Option ${selectedOption}`;
  const resolved = {
    ...openReview,
    review_type: 'agent25_option_selection',
    id: openReview.id || 'agent25-option-selection',
    status: 'resolved',
    blocking: false,
    resolved_at: resolvedAt,
    resolved_by: 'desktop-user',
    resolution_text: selectedOption,
    selected_option: selectedOption,
    selected_design: selectedDesign,
    created_at: resolvedAt,
    created_by: 'desktop:select-ui',
  };
  await appendFile(path.join(runDir, 'human-review-events.jsonl'), `${JSON.stringify(resolved)}\n`);
  const selectedArtifact = await writeSelectedDesignArtifacts({ runDir, option: selectedOption, selectedAt: resolvedAt });

  const readiness = await runPostSelectionReadinessGates(runDir);
  if (!readiness.ready) {
    await writeDesktopState(runDir, {
      ...state,
      stage: 'ui-review',
      last_completed_stage: 'agent25',
      next_action: 'complete selected-assets / lineage requirements before implement',
      blocking_reason: SELECTED_ASSETS_NOT_READY,
      updated_at: now(),
    });
    return {
      ok: false,
      code: SELECTED_ASSETS_NOT_READY,
      review,
      next_stage: 'ui-review',
      selected_option: selectedOption,
      selected_design: selectedDesign,
      selectedArtifact,
      gates: { ...requiredGates.gates, lineage: readiness.lineage, selectedAssets: readiness.selectedAssets },
    };
  }

  await writeDesktopState(runDir, {
    ...state,
    stage: 'implement',
    last_completed_stage: 'ui-selection',
    next_action: 'run desktop:implement',
    blocking_reason: null,
    updated_at: now(),
  });
  return {
    ok: true,
    code: REVIEW_RESOLVED,
    review,
    next_stage: 'implement',
    selected_option: selectedOption,
    selected_design: selectedDesign,
    selectedArtifact,
    gates: { ...requiredGates.gates, lineage: readiness.lineage, selectedAssets: readiness.selectedAssets },
  };
}

export async function continueDesktopRun({ runDir, review, reply, now = nowIso } = {}) {
  const state = await readDesktopState(runDir);
  const events = await readEvents(runDir);
  if (state.stage === 'spec-review' && review !== 'spec-confirmation') {
    return { ok: false, code: SPEC_NOT_CONFIRMED, review };
  }
  if (UI_OPTION_REVIEW_TYPES.has(review)) {
    return selectDesktopUiOption({ runDir, option: reply, review, now });
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
    console.log([
      'Usage:',
      '  node scripts/desktop/continue.mjs --run-dir runs/<site-id> --review <review-type> --reply <reply>',
      '  node scripts/desktop/continue.mjs --run-dir runs/<site-id> --option A',
      '',
      'desktop:select-ui:',
      '  npm run desktop:select-ui -- --run-dir runs/<site-id> --option A',
      '  Valid options are A, B, and C.',
      '  Resolves the open Agent2.5 option review, writes selected-design artifacts, verifies Agent2.5 gates, and stops before Agent3.',
    ].join('\n'));
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
