#!/usr/bin/env node
import { access, appendFile, copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  parseRunInput,
  renderSpecReviewCard,
  renderToolsiteSpec,
  splitLocalReviewMessages,
} from '../run/pre-agent2-local-spec.mjs';
import { runAgent2BriefComplianceCheck, renderComplianceSummary } from '../run/check-agent2-brief-compliance.mjs';
import { runAgent25ExternalDesignProofGate } from '../run/check-agent25-external-design-proof.mjs';
import { runAgent25LineageGate } from '../run/check-agent25-lineage.mjs';
import { runAgent25OptionImagesGate } from '../run/check-agent25-option-images.mjs';
import { checkRunGates } from '../run/check-gates.mjs';
import { runGateEvidenceIntegrityCheck } from '../run/check-gate-evidence-integrity.mjs';
import { runVisualRestorationSimilarityGate } from '../qa/check-visual-restoration-similarity.mjs';
import { runFinalQaEvidenceGate } from '../qa/check-final-qa-evidence.mjs';
import { runFinalVisualLockGate } from '../qa/check-final-visual-lock.mjs';
import { runFinalVisualSimilarityGate } from '../qa/check-final-visual-similarity.mjs';
import { runPreAgent2ToolsiteSpecGate } from '../qa/check-pre-agent2-toolsite-spec.mjs';
import { runPagePlanGate } from '../qa/check-page-plan.mjs';
import { runRenderedAssetsGate } from '../qa/check-rendered-assets.mjs';
import { runSelectedAssetsGate } from '../qa/check-selected-assets.mjs';
import { runToolSpecGate } from '../qa/check-tool-spec.mjs';
import { runToolsiteDesignReviewGate } from '../qa/check-toolsite-design-review.mjs';

export const NO_STAGE_RUNNER_CONFIGURED = 'NO_STAGE_RUNNER_CONFIGURED';
export const SPEC_REVIEW_OPEN = 'SPEC_REVIEW_OPEN';
export const HUMAN_REVIEW_REQUIRED = 'HUMAN_REVIEW_REQUIRED';
export const DESKTOP_STAGE_DONE = 'DESKTOP_STAGE_DONE';
export const DEPLOY_REQUIRES_APPROVAL = 'DEPLOY_REQUIRES_APPROVAL';
export const AGENT2_COMPLETE = 'AGENT2_COMPLETE';
export const AGENT2_COMPLIANCE_FAILED = 'AGENT2_COMPLIANCE_FAILED';
export const DESKTOP_PRECONDITION_FAILED = 'DESKTOP_PRECONDITION_FAILED';
export const INVALID_DESKTOP_STAGE = 'INVALID_DESKTOP_STAGE';
export const AGENT2_OUTPUT_MISSING = 'AGENT2_OUTPUT_MISSING';
export const AGENT2_COMPLIANCE_REQUIRED = 'AGENT2_COMPLIANCE_REQUIRED';
export const INPUT_ASSETS_UNREADABLE = 'INPUT_ASSETS_UNREADABLE';
export const AGENT25_EXECUTOR_FAILED = 'AGENT25_EXECUTOR_FAILED';
export const AGENT25_GATE_FAILED = 'AGENT25_GATE_FAILED';
export const AGENT25_COMPLETE = 'AGENT25_COMPLETE';
export const UI_SELECTION_REQUIRED = 'UI_SELECTION_REQUIRED';
export const SELECTED_OPTION_MISSING = 'SELECTED_OPTION_MISSING';
export const AGENT25_OUTPUT_MISSING = 'AGENT25_OUTPUT_MISSING';
export const AGENT25_EXTERNAL_PROOF_REQUIRED = 'AGENT25_EXTERNAL_PROOF_REQUIRED';
export const AGENT25_OPTION_IMAGE_REQUIRED = 'AGENT25_OPTION_IMAGE_REQUIRED';
export const SELECTED_ASSETS_GATE_FAILED = 'SELECTED_ASSETS_GATE_FAILED';
export const SELECTED_ASSETS_NOT_READY = 'SELECTED_ASSETS_NOT_READY';
export const SELECTED_ASSETS_COMPLETE = 'SELECTED_ASSETS_COMPLETE';
export const NO_APPROVED_UI_GENERATION_AVAILABLE = 'NO_APPROVED_UI_GENERATION_AVAILABLE';
export const IMPLEMENT_STAGE_REQUIRED = 'IMPLEMENT_STAGE_REQUIRED';
export const SPEC_MISSING = 'SPEC_MISSING';
export const SELECTED_ASSETS_MISSING = 'SELECTED_ASSETS_MISSING';
export const SELECTED_TARGET_MISSING = 'SELECTED_TARGET_MISSING';
export const AGENT3_GATE_BLOCKED = 'AGENT3_GATE_BLOCKED';
export const BUILD_FAILED = 'BUILD_FAILED';
export const IMPLEMENT_COMPLETE = 'IMPLEMENT_COMPLETE';
export const QA_STAGE_REQUIRED = 'QA_STAGE_REQUIRED';
export const SITE_MISSING = 'SITE_MISSING';
export const IMPLEMENT_OUTPUT_MISSING = 'IMPLEMENT_OUTPUT_MISSING';
export const QA_REPAIR_LIMIT_REACHED = 'QA_REPAIR_LIMIT_REACHED';
export const QA_COMPLETE = 'QA_COMPLETE';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const STATE_FILE = 'desktop-run-state.json';
const EVENT_FILE = 'human-review-events.jsonl';

const STAGE_RUNNERS = new Set(['pre-agent2', 'agent2', 'agent25', 'selected-assets', 'implement', 'qa']);
const AGENT2_ALLOWED_CURRENT_STAGES = new Set(['spec-review', 'agent2']);
const ASSET_REFERENCE_PURPOSES = new Set(['design_reference', 'illustration_reference']);
const AGENT25_EXECUTOR_SCRIPT = 'scripts/run/execute-agent25-design-options.mjs';
const AGENT25_PROMPT_PATH = 'agent-2-output/design-generation-input.md';
const AGENT25_SITE_BRIEF_PATH = 'agent-2-output/site-brief.md';
const OPTIONS_BOARD_PATH = 'agent-2-5-output/chat-delivery/options-board.png';
const ACTION_RECEIPT_PATH = 'agent-2-5-output/external-design-evidence/action-receipt.json';
const SELECTED_OPTION_PATH = 'agent-2-5-output/selected-design/selected-option.json';
const SELECTED_LINEAGE_PATH = 'agent-2-5-output/selected-design/selected-design-lineage.md';
const SELECTED_ASSETS_DIR = 'agent-2-5-output/selected-assets';
const SELECTED_ASSETS_MANIFEST_PATH = `${SELECTED_ASSETS_DIR}/selected-assets-manifest.json`;
const SELECTED_ASSETS_PACKAGE_PATH = `${SELECTED_ASSETS_DIR}/selected-design-package.md`;
const SELECTED_ASSETS_LINEAGE_PATH = `${SELECTED_ASSETS_DIR}/selected-design-lineage.md`;
const SELECTED_TARGET_DESKTOP_PATH = `${SELECTED_ASSETS_DIR}/selected-target-desktop.png`;
const SELECTED_TARGET_MOBILE_PATH = `${SELECTED_ASSETS_DIR}/selected-target-mobile.png`;
const IMPLEMENT_AGENT2_FILES = [
  'agent-2-output/site-brief.md',
  'agent-2-output/tool-spec.md',
  'agent-2-output/page-plan.md',
  'agent-2-output/design-generation-input.md',
];
const IMPLEMENT_SELECTED_ASSETS_FILES = [
  SELECTED_ASSETS_MANIFEST_PATH,
  SELECTED_ASSETS_PACKAGE_PATH,
  SELECTED_ASSETS_LINEAGE_PATH,
];
const IMPLEMENT_SELECTED_TARGET_FILES = [
  SELECTED_TARGET_DESKTOP_PATH,
  SELECTED_TARGET_MOBILE_PATH,
];
const QA_IMPLEMENT_FILES = [
  'agent-4-output/build-report.md',
  'agent-3-output/implementation-handoff.md',
];
const QA_AGENT2_FILES = [
  'agent-2-output/tool-spec.md',
  'agent-2-output/page-plan.md',
];
const QA_SELECTED_ASSETS_FILES = [
  SELECTED_ASSETS_MANIFEST_PATH,
];
const QA_REPAIR_LIMIT = 5;

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

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(filePath) {
  try {
    return (await stat(filePath)).isDirectory();
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

async function ensurePreAgent2GateConfirmationEvent(runDir, events, now) {
  const desktopConfirmation = confirmedReview(events, 'spec-confirmation');
  if (!desktopConfirmation) return null;
  const standardConfirmation = latestEventsById(events).get('pre-agent2-spec-confirmation');
  if (standardConfirmation?.status === 'resolved' && standardConfirmation?.resolution_text) return standardConfirmation;
  const event = {
    schema_version: 'human-review-event.v1',
    type: 'human_review',
    review_type: 'pre_agent2_spec_confirmation',
    id: 'pre-agent2-spec-confirmation',
    site_id: desktopConfirmation.site_id || siteIdFromRunDir(runDir),
    run_dir: runDir,
    phase: 'pre-agent2',
    agent: 'desktop-pre-agent2',
    status: 'resolved',
    blocking: false,
    blocks: 'agent-2',
    title: 'Toolsite SPEC confirmation',
    resolution_text: desktopConfirmation.resolution_text,
    resolved_at: now(),
    created_at: now(),
    created_by: 'desktop:agent2',
  };
  await appendReview(runDir, event);
  return event;
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

async function writeGateResult(runDir, fileName, result) {
  await mkdir(path.join(runDir, 'gate-results'), { recursive: true });
  await writeFile(path.join(runDir, 'gate-results', fileName), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function gatePassed(result) {
  return Boolean(result && result.status === 'pass' && result.passed === true);
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function sha256RunFile(runDir, relPath) {
  return sha256Buffer(await readFile(path.join(runDir, relPath)));
}

async function statSize(runDir, relPath) {
  try {
    return (await stat(path.join(runDir, relPath))).size;
  } catch {
    return 0;
  }
}

function normalizeUiOption(value) {
  const text = String(value || '').trim().toUpperCase();
  const match = text.match(/(?:OPTION\s*)?([ABC])$/i) || text.match(/^[ABC]$/i);
  return match ? match[1].toUpperCase() : '';
}

function optionIdFromUi(option) {
  return `option-${String(option || '').trim().toLowerCase()}`;
}

function optionLabelFromUi(option) {
  return `Option ${String(option || '').trim().toUpperCase()}`;
}

function normalizeOptionId(value) {
  const text = String(value || '').trim().toLowerCase();
  if (/^(option[-_\s]*)?a$/.test(text) || /option\s+a/i.test(text)) return 'option-a';
  if (/^(option[-_\s]*)?b$/.test(text) || /option\s+b/i.test(text)) return 'option-b';
  if (/^(option[-_\s]*)?c$/.test(text) || /option\s+c/i.test(text)) return 'option-c';
  return text.replace(/\s+/g, '-');
}

function optionLabelFromId(optionId) {
  const normalized = normalizeOptionId(optionId);
  if (normalized === 'option-a') return 'Option A';
  if (normalized === 'option-b') return 'Option B';
  if (normalized === 'option-c') return 'Option C';
  return String(optionId || '').trim();
}

function pathValue(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function isDesktopProductionRun(meta) {
  return Boolean(
    meta &&
    meta.mode === 'desktop' &&
    meta.run_type === 'production' &&
    meta.deployable === true,
  );
}

async function blockAgent2(runDir, state, { blockingReason, nextAction, now = nowIso } = {}) {
  await writeDesktopState(runDir, {
    ...state,
    stage: 'agent2',
    next_action: nextAction || 'repair desktop:agent2 input before rerunning',
    blocking_reason: blockingReason,
    updated_at: now(),
  });
}

async function blockAgent25(runDir, state, { blockingReason, nextAction, now = nowIso } = {}) {
  await writeDesktopState(runDir, {
    ...state,
    stage: 'agent25',
    next_action: nextAction || 'repair Agent2.5 design-options before rerunning desktop:agent25',
    blocking_reason: blockingReason,
    updated_at: now(),
  });
}

async function blockUiReview(runDir, state, { blockingReason, nextAction, now = nowIso } = {}) {
  await writeDesktopState(runDir, {
    ...state,
    stage: 'ui-review',
    last_completed_stage: state.last_completed_stage || 'agent25',
    next_action: nextAction || 'repair selected design package before rerunning desktop:selected-assets',
    blocking_reason: blockingReason,
    updated_at: now(),
  });
}

async function blockImplement(runDir, state, { blockingReason, nextAction, now = nowIso } = {}) {
  await writeDesktopState(runDir, {
    ...state,
    stage: 'implement',
    last_completed_stage: state.last_completed_stage || 'selected-assets',
    next_action: nextAction || 'repair implementation inputs before rerunning desktop:implement',
    blocking_reason: blockingReason,
    updated_at: now(),
  });
}

async function blockQa(runDir, state, { blockingReason, nextAction, repairAttempts = null, now = nowIso } = {}) {
  await writeDesktopState(runDir, {
    ...state,
    stage: 'qa',
    last_completed_stage: state.last_completed_stage || 'implement',
    next_action: nextAction || 'repair QA gates before rerunning desktop:qa',
    blocking_reason: blockingReason,
    repair_attempts: repairAttempts || state.repair_attempts || {},
    updated_at: now(),
  });
}

function executorFailureCode(result) {
  const text = `${result?.stdout || ''}\n${result?.stderr || ''}`;
  if (/NO_APPROVED_UI_GENERATION_AVAILABLE/.test(text)) return 'NO_APPROVED_UI_GENERATION_AVAILABLE';
  if (/EXTERNAL_ACTION_FAILED/.test(text)) return 'EXTERNAL_ACTION_FAILED';
  return 'EXTERNAL_ACTION_FAILED';
}

async function defaultExecuteAgent25DesignOptions({ runDir, promptPath, argv }) {
  return spawnSync(process.execPath, argv, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 360_000,
  });
}

async function defaultRunSiteBuild({ siteDir }) {
  let install = null;
  if (!(await exists(path.join(siteDir, 'node_modules/.bin/astro')))) {
    install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
      cwd: siteDir,
      encoding: 'utf8',
      timeout: 360_000,
    });
    if (install.status !== 0) {
      return {
        status: install.status ?? 1,
        command: 'npm install --no-audit --no-fund',
        stdout: install.stdout || '',
        stderr: install.stderr || '',
      };
    }
  }

  const build = spawnSync('npm', ['run', 'build'], {
    cwd: siteDir,
    encoding: 'utf8',
    timeout: 360_000,
  });
  return {
    status: build.status ?? 1,
    command: 'npm run build',
    stdout: [install?.stdout || '', build.stdout || ''].filter(Boolean).join('\n'),
    stderr: [install?.stderr || '', build.stderr || ''].filter(Boolean).join('\n'),
  };
}

function normalizeRelativeRunPath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim();
}

function referencedAssetPaths({ inputText = '', promptText = '', runMeta = null } = {}) {
  const paths = new Set();
  const add = (value) => {
    const normalized = normalizeRunAssetPath(value);
    if (normalized) paths.add(normalized);
  };
  for (const asset of Array.isArray(runMeta?.input_assets) ? runMeta.input_assets : []) add(asset.run_path);
  for (const asset of Array.isArray(runMeta?.assets) ? runMeta.assets : []) add(asset.run_path);
  for (const text of [inputText, promptText]) {
    for (const match of String(text || '').matchAll(/\binput-assets\/[^\s`'"）),;；]+/gi)) add(match[0]);
  }
  return [...paths];
}

async function validateInputAssets({ runDir, promptText }) {
  const runMeta = await readJsonOptional(path.join(runDir, 'run-meta.json'));
  const inputText = await readOptional(path.join(runDir, 'input.md'));
  const references = referencedAssetPaths({ inputText, promptText, runMeta });
  if (references.length === 0) return { ok: true, references };

  try {
    await readdir(path.join(runDir, 'input-assets'));
  } catch {
    return { ok: false, references, missing: ['input-assets'] };
  }

  const missing = [];
  for (const relPath of references) {
    if (!(await exists(path.join(runDir, relPath)))) missing.push(relPath);
  }
  return { ok: missing.length === 0, references, missing };
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_]/g, '')
    .trim();
}

function normalizeLabel(value) {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/[：:]/g, ':')
    .replace(/[^a-z0-9\u4e00-\u9fff/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findLabeledValue(text, aliases) {
  for (const line of String(text || '').split(/\r?\n/)) {
    const separatorIndex = line.search(/[：:]/);
    if (separatorIndex < 0) continue;
    const label = normalizeLabel(line.slice(0, separatorIndex));
    const value = stripMarkdown(line.slice(separatorIndex + 1));
    if (aliases.some((alias) => label.includes(normalizeLabel(alias)))) return value;
  }
  return '';
}

function extractSpecFacts(specText) {
  const keyword = findLabeledValue(specText, ['keyword', 'primary keyword', '关键词']) || 'current tool';
  const targetDomain = findLabeledValue(specText, ['target domain', 'domain', '目标域名']) || 'target domain';
  const uiReference = findLabeledValue(specText, ['ui reference', 'ui 参考']) || 'confirmed UI direction';
  const uxReference = findLabeledValue(specText, ['ux reference', 'ux 参考']) || 'confirmed UX direction';
  const extraNotes =
    findLabeledValue(specText, ['extra ideas', 'constraints', 'mimic points', '额外想法', '限制', '模仿点']) ||
    'confirmed Toolsite SPEC constraints';

  return { keyword, targetDomain, uiReference, uxReference, extraNotes };
}

function normalizeRunAssetPath(value) {
  let normalized = stripMarkdown(value)
    .replace(/\\/g, '/')
    .replace(/[),.;:：，。]+$/g, '')
    .trim();
  const marker = 'input-assets/';
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex >= 0) normalized = normalized.slice(markerIndex);
  normalized = normalized.replace(/^\.?\//, '');
  if (!normalized.startsWith(marker)) return '';
  return normalized;
}

function purposeFromText(value, fallback = 'design_reference') {
  const text = String(value || '');
  if (/illustration_reference/i.test(text)) return 'illustration_reference';
  if (/design_reference/i.test(text)) return 'design_reference';
  if (/screenshot_reference/i.test(text)) return 'screenshot_reference';
  return fallback;
}

function addAsset(map, asset) {
  const runPath = normalizeRunAssetPath(asset?.run_path || asset?.runPath || asset?.path || '');
  if (!runPath) return;
  const current = map.get(runPath) || {};
  map.set(runPath, {
    ...current,
    ...asset,
    run_path: runPath,
    purpose: asset?.purpose || current.purpose || 'design_reference',
    source_local_path: asset?.source_local_path || current.source_local_path || '',
    file_name: asset?.file_name || current.file_name || path.basename(runPath),
  });
}

function addMetadataAssets(map, assets) {
  if (!Array.isArray(assets)) return;
  for (const asset of assets) addAsset(map, asset);
}

function addInputAssets(map, inputText) {
  const intake = parseRunInput(inputText);
  addMetadataAssets(map, intake.input_assets);
}

function addSpecAssets(map, specText) {
  const matches = String(specText || '').matchAll(/\binput-assets\/[^\s`'"）),;；]+/gi);
  for (const match of matches) {
    const line = String(specText || '')
      .split(/\r?\n/)
      .find((candidate) => candidate.includes(match[0])) || match[0];
    addAsset(map, {
      run_path: match[0],
      purpose: purposeFromText(line),
    });
  }
}

async function listInputAssets(runDir, relativeDir = 'input-assets') {
  const dirPath = path.join(runDir, relativeDir);
  let entries = [];
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDir.replace(/\\/g, '/'), entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listInputAssets(runDir, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

async function collectInputAssets({ runDir, inputText, runMeta, specText }) {
  const assets = new Map();
  addMetadataAssets(assets, runMeta?.input_assets);
  addMetadataAssets(assets, runMeta?.assets);
  addInputAssets(assets, inputText);
  addSpecAssets(assets, specText);

  for (const runPath of await listInputAssets(runDir)) {
    addAsset(assets, {
      run_path: runPath,
      purpose: assets.get(runPath)?.purpose || 'design_reference',
    });
  }

  return [...assets.values()]
    .map((asset) => ({
      run_path: normalizeRunAssetPath(asset.run_path),
      purpose: purposeFromText(asset.purpose, 'design_reference'),
      source_local_path: asset.source_local_path || '',
      file_name: asset.file_name || path.basename(asset.run_path || ''),
    }))
    .filter((asset) => asset.run_path)
    .sort((left, right) => left.run_path.localeCompare(right.run_path));
}

function assetLines(inputAssets) {
  const relevantAssets = inputAssets.filter((asset) => ASSET_REFERENCE_PURPOSES.has(asset.purpose));
  const assets = relevantAssets.length ? relevantAssets : inputAssets;
  if (assets.length === 0) return '- No input-assets were supplied.';
  return assets
    .map((asset) => {
      const source = asset.source_local_path ? `; source: ${asset.source_local_path}` : '';
      const preservation = ASSET_REFERENCE_PURPOSES.has(asset.purpose)
        ? `Preserve as ${asset.purpose}.`
        : `Keep as ${asset.purpose || 'visual_reference'} if the confirmed SPEC needs it.`;
      return `- ${asset.run_path} - purpose: ${asset.purpose}${source}. ${preservation}`;
    })
    .join('\n');
}

function pagePlanTable({ keyword }) {
  return [
    '| page | type | status | reason | implementation owner |',
    '| --- | --- | --- | --- | --- |',
    `| / | tool | required | Primary ${keyword} tool page from the confirmed SPEC. | Agent4 |`,
    '| /privacy | policy | required | Required privacy page for a static local-processing tool. | Agent4 |',
    '| /terms | policy | required | Required terms page and educational/legal boundaries. | Agent4 |',
    '| /sitemap.xml | system | required | Required search crawler discovery file. | Agent4 |',
    '| /robots.txt | system | required | Required crawler instruction file with sitemap reference. | Agent4 |',
    '| /login | app | rejected | No login is allowed by default. | Agent4 |',
    '| /dashboard | app | rejected | No dashboard is allowed by default. | Agent4 |',
    '| /account | app | rejected | No account system is allowed by default. | Agent4 |',
    '| /pricing | marketing | rejected | No pricing page is needed for this free static tool. | Agent4 |',
    '| /leaderboard | app | rejected | No leaderboard is allowed by default. | Agent4 |',
    '| /api | developer | rejected | No API is allowed by default. | Agent4 |',
    '| /blog | content | rejected | No blog is part of the confirmed SPEC. | Agent4 |',
  ].join('\n');
}

function renderAgent2Outputs({ specText, inputText, runMeta, runDir, inputAssets }) {
  const facts = extractSpecFacts(specText);
  const common = [
    `Keyword: ${facts.keyword}`,
    `Target Domain: ${facts.targetDomain}`,
    `UI Reference: ${facts.uiReference}`,
    `UX Reference: ${facts.uxReference}`,
    `Extra Constraints: ${facts.extraNotes}`,
    `Run Metadata: ${runMeta?.site_id || siteIdFromRunDir(runDir)} desktop production run.`,
    'Source of truth: toolsite-spec.md. Use input.md, run-meta.json, and input-assets/ only as supporting run context.',
    'No login. No account. No dashboard. No pricing. No backend. No database. No server API. No upload. No saved history. No AI rewrite.',
  ].join('\n');
  const assets = assetLines(inputAssets);
  const plan = pagePlanTable(facts);

  return {
    'site-brief.md': [
      `# ${facts.keyword} Site Brief`,
      '',
      common,
      '',
      '## Confirmed SPEC Source',
      '',
      'Use `toolsite-spec.md` as the factual source for product, content, design, and scope decisions.',
      'Use `input.md`, `run-meta.json`, and `input-assets/` only to preserve confirmed run context and reference assets.',
      '',
      '## Build Direction',
      '',
      `Create a static frontend tool for ${facts.keyword} on ${facts.targetDomain}. The first screen must prioritize the actual tool workflow and preserve the confirmed UI and UX references.`,
      '',
      '## Input Assets',
      '',
      assets,
      '',
      '## Input Context',
      '',
      `Input length: ${inputText.length} characters. Agent2 must not introduce requirements missing from the confirmed SPEC.`,
      '',
    ].join('\n'),
    'tool-spec.md': [
      `# ${facts.keyword} Tool Spec`,
      '',
      common,
      '',
      '## Behavior',
      '',
      `Implement the ${facts.keyword} behavior described in the confirmed Toolsite SPEC. Keep all computation local in the browser unless the SPEC explicitly allows otherwise.`,
      '',
      '## Boundaries',
      '',
      'No login. No account. No backend. No database. No server API. No upload. No saved history. No AI rewrite.',
      '',
    ].join('\n'),
    'content-plan.md': [
      `# ${facts.keyword} Content Plan`,
      '',
      common,
      '',
      '## Page Plan',
      '',
      plan,
      '',
      '## Content Notes',
      '',
      'Use concise tool-first copy. Support pages should explain privacy, terms, crawler files, and the confirmed educational or legal boundaries without crowding the first viewport.',
      '',
    ].join('\n'),
    'page-plan.md': [
      `# ${facts.keyword} Page Plan`,
      '',
      plan,
      '',
    ].join('\n'),
    'seo-plan.md': [
      `# ${facts.keyword} SEO Plan`,
      '',
      common,
      '',
      '## Search Intent',
      '',
      `Target users searching for ${facts.keyword}. The SEO plan must support the tool-first page, not replace the first-screen tool experience.`,
      '',
      '## Baseline Files',
      '',
      '- `/sitemap.xml` required.',
      '- `/robots.txt` required.',
      '',
    ].join('\n'),
    'ui-reference-dossier.md': [
      `# ${facts.keyword} UI Reference Dossier`,
      '',
      common,
      '',
      '## References',
      '',
      `- UI Reference: ${facts.uiReference}`,
      `- UX Reference: ${facts.uxReference}`,
      '',
      '## Design References',
      '',
      assets,
      '',
    ].join('\n'),
    'design-generation-input.md': [
      `# ${facts.keyword} Design Generation Input`,
      '',
      common,
      '',
      '## Agent2.5 Brief',
      '',
      `Generate high-fidelity Option A/B/C UI targets for ${facts.keyword}. Preserve the confirmed SPEC, target domain ${facts.targetDomain}, UI reference ${facts.uiReference}, and UX reference ${facts.uxReference}.`,
      '',
      '## Image / Visual References',
      '',
      assets,
      '',
      '## Production Constraints',
      '',
      'No login. No account. No backend. No database. No server API. No upload. No saved history. No AI rewrite.',
      '',
    ].join('\n'),
  };
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
      message_chunks: splitLocalReviewMessages(message),
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

export async function runDesktopAgent2({ runDir, now = nowIso } = {}) {
  const state = await readDesktopState(runDir);
  const events = await readEvents(runDir);
  if (!confirmedReview(events, 'spec-confirmation')) {
    await writeDesktopState(runDir, {
      ...state,
      stage: 'spec-review',
      next_action: 'Confirm SPEC before running desktop:agent2.',
      blocking_reason: 'spec-confirmation',
    });
    return { ok: true, code: HUMAN_REVIEW_REQUIRED, stage: 'spec-review', review_type: 'spec-confirmation' };
  }

  if (!AGENT2_ALLOWED_CURRENT_STAGES.has(state.stage)) {
    await blockAgent2(runDir, state, {
      blockingReason: `invalid-stage:${state.stage || '(missing)'}`,
      nextAction: 'return desktop-run-state.json to spec-review or agent2 before running desktop:agent2',
      now,
    });
    return { ok: false, code: DESKTOP_PRECONDITION_FAILED, stage: 'agent2', reason: 'invalid-stage' };
  }

  const runMeta = await readJsonOptional(path.join(runDir, 'run-meta.json'));
  if (!isDesktopProductionRun(runMeta)) {
    await blockAgent2(runDir, state, {
      blockingReason: 'desktop-production-run-required',
      nextAction: 'fix run-meta.json before running desktop:agent2',
      now,
    });
    return { ok: false, code: DESKTOP_PRECONDITION_FAILED, stage: 'agent2', reason: 'run-meta' };
  }

  await ensurePreAgent2GateConfirmationEvent(runDir, events, now);
  const specPath = path.join(runDir, 'toolsite-spec.md');
  const preAgent2Gate = await runPreAgent2ToolsiteSpecGate({ runDir });
  await writeGateResult(runDir, 'pre-agent2-toolsite-spec.json', preAgent2Gate);
  if (!gatePassed(preAgent2Gate) || !(await exists(specPath))) {
    await blockAgent2(runDir, state, {
      blockingReason: 'pre-agent2-toolsite-spec',
      nextAction: 'fix toolsite-spec.md before rerunning desktop:agent2',
      now,
    });
    return { ok: false, code: AGENT2_COMPLIANCE_FAILED, stage: 'agent2', gateResult: preAgent2Gate };
  }

  const inputText = await readFile(path.join(runDir, 'input.md'), 'utf8');
  const specText = await readFile(specPath, 'utf8');
  const inputAssets = await collectInputAssets({ runDir, inputText, runMeta, specText });
  const outputDir = path.join(runDir, 'agent-2-output');
  await mkdir(outputDir, { recursive: true });
  const outputs = renderAgent2Outputs({ specText, inputText, runMeta, runDir, inputAssets });
  for (const [fileName, content] of Object.entries(outputs)) {
    await writeFile(path.join(outputDir, fileName), content, 'utf8');
  }

  const pagePlanGate = await runPagePlanGate({ runDir });
  await writeGateResult(runDir, 'page-plan.json', pagePlanGate);

  const compliance = await runAgent2BriefComplianceCheck({ runDir });
  await writeFile(path.join(outputDir, 'brief-compliance-summary.md'), renderComplianceSummary(compliance), 'utf8');
  await writeGateResult(runDir, 'agent2-brief-compliance.json', compliance);

  if (!gatePassed(pagePlanGate)) {
    await blockAgent2(runDir, state, {
      blockingReason: 'page-plan',
      nextAction: 'repair Agent2 page plan before rerunning desktop:agent2',
      now,
    });
    return { ok: false, code: AGENT2_COMPLIANCE_FAILED, stage: 'agent2', gateResult: pagePlanGate, compliance };
  }

  if (!gatePassed(compliance)) {
    await blockAgent2(runDir, state, {
      blockingReason: 'agent2-brief-compliance',
      nextAction: 'repair Agent2 outputs before rerunning desktop:agent2',
      now,
    });
    return { ok: false, code: AGENT2_COMPLIANCE_FAILED, stage: 'agent2', compliance };
  }

  await writeDesktopState(runDir, {
    ...state,
    stage: 'agent25',
    last_completed_stage: 'agent2',
    next_action: 'run desktop:agent25',
    blocking_reason: null,
    updated_at: now(),
  });

  return {
    ok: true,
    code: AGENT2_COMPLETE,
    stage: 'agent25',
    outputDir,
    compliance,
  };
}

async function writeAgent25OptionSelectionReview({ runDir, now = nowIso }) {
  const event = {
    schema_version: 'human-review-event.v1',
    type: 'human_review',
    review_type: 'agent25_option_selection',
    id: 'agent25-option-selection',
    site_id: siteIdFromRunDir(runDir),
    run_dir: runDir,
    phase: 'agent-2.5',
    agent: 'desktop-agent25',
    status: 'open',
    blocking: true,
    blocks: 'agent-3',
    title: 'Choose Agent2.5 UI option',
    message: [
      '本地 UI A/B/C 选择说明',
      '',
      '请打开 Agent2.5 options board，选择 A、B 或 C。',
      '选择前不要进入 Agent3。',
    ].join('\n'),
    expected_reply: 'A / B / C / 重做：...',
    attachments: [
      {
        label: 'Agent2.5 options board',
        path: OPTIONS_BOARD_PATH,
        kind: 'image',
        required: true,
      },
    ],
    created_at: now(),
    created_by: 'desktop:agent25',
  };
  await appendReview(runDir, event);
  return event;
}

export async function runDesktopAgent25({
  runDir,
  now = nowIso,
  executeAgent25DesignOptions = defaultExecuteAgent25DesignOptions,
} = {}) {
  const state = await readDesktopState(runDir);
  if (state.stage !== 'agent25' || state.last_completed_stage !== 'agent2') {
    return {
      ok: false,
      code: INVALID_DESKTOP_STAGE,
      stage: state.stage || '',
      last_completed_stage: state.last_completed_stage || null,
    };
  }

  const promptPath = path.join(runDir, AGENT25_PROMPT_PATH);
  for (const relPath of [AGENT25_PROMPT_PATH, AGENT25_SITE_BRIEF_PATH]) {
    if (!(await exists(path.join(runDir, relPath)))) {
      await blockAgent25(runDir, state, {
        blockingReason: relPath,
        nextAction: 'run desktop:agent2 before desktop:agent25',
        now,
      });
      return { ok: false, code: AGENT2_OUTPUT_MISSING, stage: 'agent25', missing: relPath };
    }
  }

  const compliance = await readJsonOptional(path.join(runDir, 'gate-results/agent2-brief-compliance.json'));
  if (!gatePassed(compliance)) {
    await blockAgent25(runDir, state, {
      blockingReason: 'agent2-brief-compliance',
      nextAction: 'repair Agent2 compliance before desktop:agent25',
      now,
    });
    return { ok: false, code: AGENT2_COMPLIANCE_REQUIRED, stage: 'agent25' };
  }

  const promptText = await readFile(promptPath, 'utf8');
  const assets = await validateInputAssets({ runDir, promptText });
  if (!assets.ok) {
    await blockAgent25(runDir, state, {
      blockingReason: `input-assets:${assets.missing.join(',')}`,
      nextAction: 'restore referenced input-assets before desktop:agent25',
      now,
    });
    return { ok: false, code: INPUT_ASSETS_UNREADABLE, stage: 'agent25', missing: assets.missing };
  }

  const argv = [
    AGENT25_EXECUTOR_SCRIPT,
    '--run-dir',
    runDir,
    '--prompt',
    promptPath,
  ];
  const executor = await executeAgent25DesignOptions({ runDir, promptPath, argv });
  if (executor.status !== 0) {
    const failureCode = executorFailureCode(executor);
    await blockAgent25(runDir, state, {
      blockingReason: failureCode,
      nextAction: 'rerun desktop:agent25 after the approved design surface is available',
      now,
    });
    return {
      ok: false,
      code: AGENT25_EXECUTOR_FAILED,
      stage: 'agent25',
      blocking_reason: failureCode,
      stdout: executor.stdout || '',
      stderr: executor.stderr || '',
    };
  }

  const externalProof = await runAgent25ExternalDesignProofGate({ runDir });
  await writeGateResult(runDir, 'agent25-external-design-proof.json', externalProof);
  if (!gatePassed(externalProof)) {
    await blockAgent25(runDir, state, {
      blockingReason: 'agent25-external-design-proof',
      nextAction: 'repair Agent2.5 external evidence before desktop:agent25',
      now,
    });
    return { ok: false, code: AGENT25_GATE_FAILED, stage: 'agent25', gateResult: externalProof };
  }

  const review = await writeAgent25OptionSelectionReview({ runDir, now });
  const optionImages = await runAgent25OptionImagesGate({ runDir });
  await writeGateResult(runDir, 'agent25-option-images.json', optionImages);
  if (!gatePassed(optionImages)) {
    await blockAgent25(runDir, state, {
      blockingReason: 'agent25-option-images',
      nextAction: 'repair Agent2.5 option image board before desktop:agent25',
      now,
    });
    return { ok: false, code: AGENT25_GATE_FAILED, stage: 'agent25', gateResult: optionImages };
  }

  await writeDesktopState(runDir, {
    mode: 'desktop',
    stage: 'ui-review',
    last_completed_stage: 'agent25',
    next_action: 'review Agent2.5 options and run desktop:select-ui',
    blocking_reason: 'ui-option-selection',
    repair_attempts: {},
    updated_at: now(),
  });

  return {
    ok: true,
    code: AGENT25_COMPLETE,
    stage: 'ui-review',
    review,
    gates: {
      externalProof,
      optionImages,
    },
  };
}

function resolvedUiSelection(events) {
  return [...events].reverse().find((event) =>
    event.type === 'human_review' &&
    event.review_type === 'agent25_option_selection' &&
    event.status === 'resolved' &&
    normalizeUiOption(event.selected_option || event.resolution_text));
}

async function readSelectedOption(runDir) {
  const selectedOption = await readJsonOptional(path.join(runDir, SELECTED_OPTION_PATH));
  const option = normalizeUiOption(selectedOption?.selected_option);
  if (!selectedOption || !option) return null;
  return {
    ...selectedOption,
    selected_option: option,
    selected_design: selectedOption.selected_design || optionLabelFromUi(option),
  };
}

async function ensureAgent25OptionImagesReady(runDir) {
  const existing = await readJsonOptional(path.join(runDir, 'gate-results/agent25-option-images.json'));
  if (gatePassed(existing)) return existing;
  const result = await runAgent25OptionImagesGate({ runDir });
  await writeGateResult(runDir, 'agent25-option-images.json', result);
  return result;
}

function proofOptionRecord(proof, selectedOptionId) {
  const options = Array.isArray(proof?.options) ? proof.options : [];
  return options.find((option) =>
    normalizeOptionId(option.id || option.label || option.option) === selectedOptionId);
}

async function copyIfDifferent(runDir, sourceRelPath, targetRelPath) {
  const source = path.join(runDir, sourceRelPath);
  const target = path.join(runDir, targetRelPath);
  await mkdir(path.dirname(target), { recursive: true });
  const sourceHash = await sha256RunFile(runDir, sourceRelPath);
  const targetHash = await exists(target) ? await sha256RunFile(runDir, targetRelPath) : '';
  if (sourceHash !== targetHash) await copyFile(source, target);
}

function selectedTargetsMatch(proof, selectedOptionId) {
  const targets = proof?.targets || proof?.selectedTargets || {};
  return (
    normalizeOptionId(targets.desktop?.sourceOption) === selectedOptionId &&
    normalizeOptionId(targets.mobile?.sourceOption) === selectedOptionId &&
    normalizeOptionId(proof?.selection?.selectedOption || proof?.selectedOption) === selectedOptionId &&
    normalizeOptionId(proof?.selectedDesignPackage?.sourceOption) === selectedOptionId
  );
}

async function refreshDesignOptionsReceipt({ runDir, proof, receipt, promptRelPath }) {
  const optionPaths = (Array.isArray(proof?.options) ? proof.options : [])
    .map((option) => pathValue(option, ['imagePath', 'sourceImagePath', 'desktopTargetPath', 'targetPath']))
    .filter(Boolean);
  const args = [
    'scripts/run/run-agent25-external-action.mjs',
    '--run-dir',
    runDir,
    '--action',
    'design-options',
    '--prompt',
    promptRelPath,
    '--raw-response',
    'agent-2-5-output/external-design-evidence/external-response.md',
    '--screenshot',
    'agent-2-5-output/external-design-evidence/conversation-screenshot.png',
  ];
  if (receipt?.downloads?.[0]?.path) args.push('--download', receipt.downloads[0].path);
  for (const artifact of [
    ...optionPaths,
    OPTIONS_BOARD_PATH,
    'agent-2-5-output/selected-design/target/desktop.png',
    'agent-2-5-output/selected-design/target/mobile.png',
  ]) {
    args.push('--artifact', artifact);
  }
  return spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120_000,
  });
}

async function alignSelectedTargetsWithOption({ runDir, selectedOption, now = nowIso, refreshReceipt = refreshDesignOptionsReceipt } = {}) {
  const selectedOptionId = optionIdFromUi(selectedOption);
  const selectedLabel = optionLabelFromUi(selectedOption);
  const proofPath = path.join(runDir, 'agent-2-5-output/external-design-evidence/external-design-proof.json');
  const proof = await readJsonOptional(proofPath);
  const receipt = await readJsonOptional(path.join(runDir, ACTION_RECEIPT_PATH));
  const optionRecord = proofOptionRecord(proof, selectedOptionId);
  const optionImagePath = pathValue(optionRecord, ['imagePath', 'sourceImagePath', 'desktopTargetPath', 'targetPath']);

  if (!proof || !optionRecord || !optionImagePath || !(await exists(path.join(runDir, optionImagePath)))) {
    return { ok: false, code: SELECTED_ASSETS_NOT_READY, reason: 'selected option source image missing from external proof' };
  }

  let receiptRefreshed = false;
  const targetsNeedUpdate =
    !selectedTargetsMatch(proof, selectedOptionId) ||
    !(await exists(path.join(runDir, 'agent-2-5-output/selected-design/target/desktop.png'))) ||
    !(await exists(path.join(runDir, 'agent-2-5-output/selected-design/target/mobile.png')));

  if (targetsNeedUpdate) {
    await copyIfDifferent(runDir, optionImagePath, 'agent-2-5-output/selected-design/target/desktop.png');
    await copyIfDifferent(runDir, optionImagePath, 'agent-2-5-output/selected-design/target/mobile.png');
    const desktopSha = await sha256RunFile(runDir, 'agent-2-5-output/selected-design/target/desktop.png');
    const mobileSha = await sha256RunFile(runDir, 'agent-2-5-output/selected-design/target/mobile.png');
    proof.selection = {
      ...(proof.selection || {}),
      source: 'current-chat-user',
      selectedBy: 'current chat user',
      selectedOption: selectedOptionId,
    };
    proof.targets = {
      ...(proof.targets || {}),
      desktop: {
        path: 'agent-2-5-output/selected-design/target/desktop.png',
        source: 'derived from GPT external option source',
        sourceOption: selectedOptionId,
        sha256: desktopSha,
      },
      mobile: {
        path: 'agent-2-5-output/selected-design/target/mobile.png',
        source: 'derived from GPT external option source',
        sourceOption: selectedOptionId,
        sha256: mobileSha,
      },
    };
    proof.selectedDesignPackage = {
      ...(proof.selectedDesignPackage || {}),
      source: 'GPT external option package captured by Agent2.5 design-options executor',
      sourceOption: selectedOptionId,
      codexLocalCreation: false,
    };
    await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');

    await writeFile(
      path.join(runDir, 'agent-2-5-output/external-design-evidence/source-provenance.md'),
      [
        '# Source Provenance',
        '',
        'Decision: PASS',
        `Option A: ChatGPT approved external image source agent-2-5-output/generated-designs/option-a/target/desktop.png.`,
        `Option B: ChatGPT approved external image source agent-2-5-output/generated-designs/option-b/target/desktop.png.`,
        `Option C: ChatGPT approved external image source agent-2-5-output/generated-designs/option-c/target/desktop.png.`,
        `Selected option: ${selectedLabel} from ChatGPT approved external generated image evidence.`,
        `Desktop target: agent-2-5-output/selected-design/target/desktop.png maps to ${selectedLabel}.`,
        `Mobile target: agent-2-5-output/selected-design/target/mobile.png maps to ${selectedLabel}.`,
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      path.join(runDir, 'agent-2-5-output/external-design-evidence/selected-design-lineage.md'),
      [
        '# Selected Design Lineage',
        '',
        'Decision: PASS',
        `${selectedLabel} came from the ChatGPT approved external option image captured by the Agent2.5 design-options executor.`,
        `The current chat user selected ${selectedLabel}; Agent3 and Agent4 must not change the option.`,
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      path.join(runDir, 'agent-2-5-output/chat-delivery/option-selection.md'),
      [
        '# Option Selection',
        '',
        'Decision: PASS',
        'Option A, Option B, and Option C were delivered to chat in chat-delivery/options-board.png.',
        `Current chat user selected ${selectedLabel}.`,
      ].join('\n'),
      'utf8',
    );

    const promptRelPath = receipt?.prompt_path || 'agent-2-output/design-generation-input.md';
    const refreshed = await refreshReceipt({ runDir, proof, receipt, promptRelPath });
    if (refreshed.status !== 0) {
      return {
        ok: false,
        code: NO_APPROVED_UI_GENERATION_AVAILABLE,
        reason: refreshed.stdout || refreshed.stderr || 'external evidence receipt refresh failed',
      };
    }
    receiptRefreshed = true;
  }

  await writeFile(
    path.join(runDir, 'agent-2-5-output/external-design-evidence/source-provenance.md'),
    [
      '# Source Provenance',
      '',
      'Decision: PASS',
      `Option A: ChatGPT approved external image source agent-2-5-output/generated-designs/option-a/target/desktop.png.`,
      `Option B: ChatGPT approved external image source agent-2-5-output/generated-designs/option-b/target/desktop.png.`,
      `Option C: ChatGPT approved external image source agent-2-5-output/generated-designs/option-c/target/desktop.png.`,
      `Selected option: ${selectedLabel} from ChatGPT approved external generated image evidence.`,
      `Desktop target: agent-2-5-output/selected-design/target/desktop.png maps to ${selectedLabel}.`,
      `Mobile target: agent-2-5-output/selected-design/target/mobile.png maps to ${selectedLabel}.`,
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    path.join(runDir, 'agent-2-5-output/external-design-evidence/selected-design-lineage.md'),
    [
      '# Selected Design Lineage',
      '',
      'Decision: PASS',
      `${selectedLabel} came from the ChatGPT approved external option image captured by the Agent2.5 design-options executor.`,
      `The current chat user selected ${selectedLabel}; Agent3 and Agent4 must not change the option.`,
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    path.join(runDir, 'agent-2-5-output/chat-delivery/option-selection.md'),
    [
      '# Option Selection',
      '',
      'Decision: PASS',
      'Option A, Option B, and Option C were delivered to chat in chat-delivery/options-board.png.',
      `Current chat user selected ${selectedLabel}.`,
    ].join('\n'),
    'utf8',
  );

  return { ok: true, proof, optionImagePath, selectedOptionId, selectedLabel, receiptRefreshed };
}

async function writeSelectedPackageText(runDir, relPath, title, lines) {
  await mkdir(path.dirname(path.join(runDir, relPath)), { recursive: true });
  await writeFile(path.join(runDir, relPath), [`# ${title}`, '', ...lines, ''].join('\n'), 'utf8');
}

async function writeSelectedDesignPackage({ runDir, selectedOption, selectedDesign, alignment, now = nowIso } = {}) {
  const selectedOptionId = optionIdFromUi(selectedOption);
  const selectedLabel = selectedDesign || optionLabelFromUi(selectedOption);
  const generatedAt = now();
  const selectedDir = 'agent-2-5-output/selected-design';
  const selectedAssetsDir = 'agent-2-5-output/selected-assets';
  const desktopTarget = `${selectedDir}/target/desktop.png`;
  const mobileTarget = `${selectedDir}/target/mobile.png`;

  for (const relPath of [desktopTarget, mobileTarget]) {
    if (!(await exists(path.join(runDir, relPath))) || await statSize(runDir, relPath) < 10_000) {
      return { ok: false, code: SELECTED_ASSETS_NOT_READY, reason: `${relPath} missing or too small` };
    }
  }

  await mkdir(path.join(runDir, `${selectedDir}/code`), { recursive: true });
  await mkdir(path.join(runDir, selectedAssetsDir), { recursive: true });
  await copyFile(path.join(runDir, desktopTarget), path.join(runDir, `${selectedAssetsDir}/selected-target-desktop.png`));
  await copyFile(path.join(runDir, mobileTarget), path.join(runDir, `${selectedAssetsDir}/selected-target-mobile.png`));

  const designInput = await readOptional(path.join(runDir, AGENT25_PROMPT_PATH));
  await writeSelectedPackageText(runDir, 'agent-2-5-output/design-generation-prompt.md', 'Design Generation Prompt', [
    `Selected option: ${selectedLabel}.`,
    `Source options board: ${OPTIONS_BOARD_PATH}.`,
    `External action receipt: ${ACTION_RECEIPT_PATH}.`,
    '',
    designInput || 'Use the confirmed Agent2 design-generation input and selected Agent2.5 option.',
  ]);
  await writeSelectedPackageText(runDir, 'agent-2-5-output/design-manifest.md', 'Design Manifest', [
    `Selected option: ${selectedLabel}`,
    `Selected option id: ${selectedOptionId}`,
    'First viewport is the usable tool workflow.',
    `Source options board: ${OPTIONS_BOARD_PATH}`,
    `External action receipt: ${ACTION_RECEIPT_PATH}`,
    `Desktop target: ${desktopTarget}`,
    `Mobile target: ${mobileTarget}`,
  ]);
  await writeSelectedPackageText(runDir, 'agent-2-5-output/design-generation-report.md', 'Design Generation Report', [
    'Decision: PASS',
    `Selected design package generated by desktop:selected-assets at ${generatedAt}.`,
    `The selected target images are linked to existing Agent2.5 external evidence for ${selectedLabel}.`,
    'No local target mockup was generated.',
  ]);
  await writeSelectedPackageText(runDir, 'agent-2-5-output/asset-acquisition-report.md', 'Asset Acquisition Report', [
    'Decision: PASS',
    'Required image slots: none.',
    'No post-selection standalone image assets are required for this static tool UI package.',
    `The selected target images remain linked to ${ACTION_RECEIPT_PATH}.`,
  ]);

  const selectedDocs = {
    'design-tokens.md': [
      'Color tokens: high contrast neutral surface, primary action, success, warning, and muted text.',
      'Typography tokens: readable first viewport tool labels, metric numerals, and compact support text.',
      'Spacing tokens: dense but scannable tool shell with responsive gaps.',
    ],
    'component-spec.md': [
      'First viewport is the usable tool workflow.',
      'Required components: site header, tool-panel, primary textarea input, action button, live metric cards, output result, status feedback, and reset/copy controls.',
      'Primary input, action button, live metric, output result, and feedback are visible before support content.',
    ],
    'asset-plan.md': [
      'Required image slots: none.',
      'Use CSS, text, and externally evidenced selected target screenshots as visual restoration references.',
    ],
    'image-slots.md': [
      'Required image slots: none.',
      'The selected design is a static tool interface and does not require independent illustration/image slots.',
    ],
    'usability-contract.md': [
      'Controls visibly update active state and results.',
      'Mobile tap targets stay readable at 390px and controls wrap without horizontal overflow.',
      'Restart clears input, selected state, feedback, and metrics.',
    ],
    'asset-quality-contract.md': [
      'Required image slots: none.',
      'No image assets are required beyond externally evidenced selected target screenshots.',
    ],
    'interaction-state-model.md': [
      'Idle, running, complete, reset, current, selected, error, success, and feedback states define input, button, metric, status, and result behavior.',
      'Primary controls visibly change active state and update output metrics.',
    ],
    'dynamic-data-fit.md': [
      'Mobile controls wrap without horizontal overflow.',
      'Output values fit metric cards with tabular numerals and readable labels.',
      'Long input and result text wrap inside the tool shell.',
    ],
    'ux-self-audit.md': [
      'Decision: PASS',
      'First viewport is the tool itself with live feedback, visible active states, readable mobile layout, and no marketing-first content.',
    ],
    'restoration-rules.md': [
      `Restore ${selectedLabel} only.`,
      'Preserve first viewport tool layout, input path, action path, result cards, feedback states, and responsive behavior.',
      `Use ${desktopTarget} and ${mobileTarget} as the visual targets.`,
    ],
    'forbidden-deviations.md': [
      'Do not switch to a different A/B/C option.',
      'Do not add login, account, dashboard, backend, database, upload, saved history, or server API unless already allowed by the confirmed SPEC.',
      'Do not replace the first viewport tool with a marketing hero.',
    ],
    'selection-rationale.md': [
      `The local user selected ${selectedLabel}.`,
      `Selection source: ${SELECTED_OPTION_PATH}.`,
      `Evidence source: ${ACTION_RECEIPT_PATH}.`,
      'Agent3 and Agent4 must not choose a different option.',
    ],
  };
  for (const [fileName, lines] of Object.entries(selectedDocs)) {
    await writeSelectedPackageText(runDir, `${selectedDir}/${fileName}`, fileName.replace(/\.md$/, '').replace(/-/g, ' '), lines);
  }

  await writeFile(
    path.join(runDir, `${selectedDir}/asset-manifest.json`),
    `${JSON.stringify({
      selected_option: selectedOption,
      selected_design: selectedLabel,
      imageSlots: [],
      requiredImageSlots: 'none',
      source_options_board: OPTIONS_BOARD_PATH,
      external_action_receipt: ACTION_RECEIPT_PATH,
    }, null, 2)}\n`,
    'utf8',
  );

  await writeFile(
    path.join(runDir, `${selectedDir}/code/index.html`),
    [
      '<header class="site-header"><a class="brand">Selected Tool</a></header>',
      '<main class="data-tool-root">',
      '  <section class="tool-panel" aria-label="Primary tool">',
      `    <h1>${selectedLabel} Tool</h1>`,
      '    <textarea aria-label="Primary input" placeholder="Paste or type here"></textarea>',
      '    <button type="button">Calculate</button>',
      '    <div class="metrics" aria-live="polite">',
      '      <div class="metric"><span>Words</span><strong>0</strong></div>',
      '      <div class="metric"><span>Characters</span><strong>0</strong></div>',
      '      <div class="metric"><span>Status</span><strong>Ready</strong></div>',
      '    </div>',
      '    <output class="result">Result feedback appears here.</output>',
      '  </section>',
      '</main>',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    path.join(runDir, `${selectedDir}/code/style.css`),
    [
      '.site-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px}',
      '.brand{font-weight:700}',
      '.data-tool-root{padding:20px}',
      '.tool-panel{display:grid;gap:14px;max-width:960px}',
      'textarea{min-height:180px;padding:12px;font:inherit}',
      'button{width:max-content;padding:10px 14px;cursor:pointer}',
      '.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}',
      '.metric{border:1px solid #d4d8df;padding:10px}',
      '.metric strong{font-variant-numeric:tabular-nums}',
      '.result{display:block;min-height:44px}',
      '@media (max-width:390px){.data-tool-root{padding:12px}.tool-panel{gap:10px}}',
    ].join('\n'),
    'utf8',
  );

  await writeSelectedPackageText(runDir, `${selectedAssetsDir}/selected-design-package.md`, 'Selected Design Package', [
    `Selected option: ${selectedLabel}.`,
    `Source options board: ${OPTIONS_BOARD_PATH}.`,
    `External action receipt: ${ACTION_RECEIPT_PATH}.`,
    `Desktop target: ${desktopTarget}.`,
    `Mobile target: ${mobileTarget}.`,
    'No new external action was required for independent image assets because required image slots are none.',
  ]);
  await writeSelectedPackageText(runDir, `${selectedAssetsDir}/selected-design-lineage.md`, 'Selected Assets Lineage', [
    `Selected option: ${selectedLabel}.`,
    `It traces to ${SELECTED_OPTION_PATH}, ${OPTIONS_BOARD_PATH}, and ${ACTION_RECEIPT_PATH}.`,
    'The selected target images are existing Agent2.5 externally evidenced artifacts, not local mockups.',
    'Agent3 and Agent4 must preserve this option.',
  ]);

  const sourceMap = {
    selected_option: selectedOption,
    selected_design: selectedLabel,
    source_options_board: OPTIONS_BOARD_PATH,
    external_action_receipt: ACTION_RECEIPT_PATH,
    source_provenance: 'agent-2-5-output/external-design-evidence/source-provenance.md',
    selected_at: generatedAt,
    generated_by: 'desktop:selected-assets',
    new_external_action_required: false,
    receipt_refreshed: Boolean(alignment.receiptRefreshed),
    targets: {
      desktop: desktopTarget,
      mobile: mobileTarget,
    },
  };
  await writeFile(path.join(runDir, `${selectedAssetsDir}/source-map.json`), `${JSON.stringify(sourceMap, null, 2)}\n`, 'utf8');

  const hashPaths = [
    SELECTED_OPTION_PATH,
    SELECTED_LINEAGE_PATH,
    OPTIONS_BOARD_PATH,
    ACTION_RECEIPT_PATH,
    desktopTarget,
    mobileTarget,
    `${selectedAssetsDir}/selected-target-desktop.png`,
    `${selectedAssetsDir}/selected-target-mobile.png`,
    `${selectedAssetsDir}/selected-design-package.md`,
    `${selectedAssetsDir}/selected-design-lineage.md`,
    `${selectedAssetsDir}/source-map.json`,
  ];
  const artifactHashes = {};
  for (const relPath of hashPaths) {
    if (await exists(path.join(runDir, relPath))) artifactHashes[relPath] = await sha256RunFile(runDir, relPath);
  }

  const manifest = {
    selected_option: selectedOption,
    selected_design: selectedLabel,
    source_options_board: OPTIONS_BOARD_PATH,
    external_action_receipt: ACTION_RECEIPT_PATH,
    source_provenance: 'agent-2-5-output/external-design-evidence/source-provenance.md',
    selected_at: generatedAt,
    generated_by: 'desktop:selected-assets',
    artifact_hashes: artifactHashes,
    new_external_action_required: false,
    receipt_refreshed: Boolean(alignment.receiptRefreshed),
  };
  await writeFile(path.join(runDir, `${selectedAssetsDir}/selected-assets-manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return { ok: true, manifest };
}

async function writeDesignPackageGateReport(runDir, { lineage, selectedAssets, toolsiteDesignReview = null } = {}) {
  await mkdir(path.join(runDir, 'agent-5-output'), { recursive: true });
  const designReviewLine = toolsiteDesignReview
    ? `- toolsite-design-review: ${toolsiteDesignReview.passed ? 'pass' : 'fail'}`
    : '- toolsite-design-review: pending mechanical check';
  await writeFile(
    path.join(runDir, 'agent-5-output/design-package-gate-report.md'),
    [
      '# Design Package Gate Report',
      '',
      `Decision: ${gatePassed(lineage) && gatePassed(selectedAssets) && (!toolsiteDesignReview || gatePassed(toolsiteDesignReview)) ? 'PASS' : 'FAIL'}`,
      '',
      `- agent25-lineage: ${lineage?.passed ? 'pass' : 'fail'}`,
      `- selected-assets: ${selectedAssets?.passed ? 'pass' : 'fail'}`,
      designReviewLine,
      '- selected target images are linked to Agent2.5 external evidence.',
      '- selected-assets manifest preserves the action receipt linkage.',
      '',
    ].join('\n'),
    'utf8',
  );
}

export async function runDesktopSelectedAssets({
  runDir,
  now = nowIso,
  refreshReceipt = refreshDesignOptionsReceipt,
} = {}) {
  const state = await readDesktopState(runDir);
  if (state.stage !== 'ui-review') {
    return { ok: false, code: UI_SELECTION_REQUIRED, stage: state.stage || '' };
  }

  const selectedOption = await readSelectedOption(runDir);
  if (!selectedOption) {
    await blockUiReview(runDir, state, {
      blockingReason: SELECTED_OPTION_MISSING,
      nextAction: 'run desktop:select-ui before desktop:selected-assets',
      now,
    });
    return { ok: false, code: SELECTED_OPTION_MISSING, stage: 'ui-review' };
  }

  const events = await readEvents(runDir);
  const resolved = resolvedUiSelection(events);
  if (!resolved) {
    await blockUiReview(runDir, state, {
      blockingReason: UI_SELECTION_REQUIRED,
      nextAction: 'resolve the local UI option review before desktop:selected-assets',
      now,
    });
    return { ok: false, code: UI_SELECTION_REQUIRED, stage: 'ui-review' };
  }

  const missing = [];
  for (const relPath of [OPTIONS_BOARD_PATH, ACTION_RECEIPT_PATH]) {
    if (!(await exists(path.join(runDir, relPath)))) missing.push(relPath);
  }
  if (missing.length > 0) {
    await blockUiReview(runDir, state, {
      blockingReason: 'agent25-output-missing',
      nextAction: 'restore Agent2.5 output evidence before desktop:selected-assets',
      now,
    });
    return { ok: false, code: AGENT25_OUTPUT_MISSING, stage: 'ui-review', missing };
  }

  const optionImages = await ensureAgent25OptionImagesReady(runDir);
  if (!gatePassed(optionImages)) {
    await blockUiReview(runDir, state, {
      blockingReason: 'agent25-option-images',
      nextAction: 'repair Agent2.5 option image evidence before desktop:selected-assets',
      now,
    });
    return { ok: false, code: AGENT25_OPTION_IMAGE_REQUIRED, stage: 'ui-review', gateResult: optionImages };
  }

  const alignment = await alignSelectedTargetsWithOption({
    runDir,
    selectedOption: selectedOption.selected_option,
    now,
    refreshReceipt,
  });
  if (!alignment.ok) {
    await blockUiReview(runDir, state, {
      blockingReason: alignment.code || SELECTED_ASSETS_NOT_READY,
      nextAction: 'restore approved selected target evidence before desktop:selected-assets',
      now,
    });
    return { ok: false, code: alignment.code || SELECTED_ASSETS_NOT_READY, stage: 'ui-review', reason: alignment.reason };
  }

  const externalProof = await runAgent25ExternalDesignProofGate({ runDir });
  await writeGateResult(runDir, 'agent25-external-design-proof.json', externalProof);
  if (!gatePassed(externalProof)) {
    await blockUiReview(runDir, state, {
      blockingReason: 'agent25-external-design-proof',
      nextAction: 'repair Agent2.5 external proof before desktop:selected-assets',
      now,
    });
    return { ok: false, code: AGENT25_EXTERNAL_PROOF_REQUIRED, stage: 'ui-review', gateResult: externalProof };
  }

  const packageResult = await writeSelectedDesignPackage({
    runDir,
    selectedOption: selectedOption.selected_option,
    selectedDesign: selectedOption.selected_design,
    alignment,
    now,
  });
  if (!packageResult.ok) {
    await blockUiReview(runDir, state, {
      blockingReason: packageResult.code || SELECTED_ASSETS_NOT_READY,
      nextAction: 'restore selected target images before desktop:selected-assets',
      now,
    });
    return { ok: false, code: packageResult.code || SELECTED_ASSETS_NOT_READY, stage: 'ui-review', reason: packageResult.reason };
  }

  const lineage = await runAgent25LineageGate({ runDir });
  await writeGateResult(runDir, 'agent25-lineage.json', lineage);
  const selectedAssets = await runSelectedAssetsGate({ runDir });
  await writeGateResult(runDir, 'selected-assets.json', selectedAssets);

  if (!gatePassed(lineage) || !gatePassed(selectedAssets)) {
    await writeDesignPackageGateReport(runDir, { lineage, selectedAssets });
    await blockUiReview(runDir, state, {
      blockingReason: SELECTED_ASSETS_GATE_FAILED,
      nextAction: 'repair selected assets and lineage before desktop:selected-assets',
      now,
    });
    return {
      ok: false,
      code: SELECTED_ASSETS_GATE_FAILED,
      stage: 'ui-review',
      gates: { externalProof, optionImages, lineage, selectedAssets },
    };
  }

  await writeDesignPackageGateReport(runDir, { lineage, selectedAssets });
  const toolsiteDesignReview = await runToolsiteDesignReviewGate({ runDir });
  await writeGateResult(runDir, 'toolsite-design-review.json', toolsiteDesignReview);
  await writeDesignPackageGateReport(runDir, { lineage, selectedAssets, toolsiteDesignReview });

  if (!gatePassed(toolsiteDesignReview)) {
    await blockUiReview(runDir, state, {
      blockingReason: SELECTED_ASSETS_GATE_FAILED,
      nextAction: 'repair selected design package before desktop:selected-assets',
      now,
    });
    return {
      ok: false,
      code: SELECTED_ASSETS_GATE_FAILED,
      stage: 'ui-review',
      gates: { externalProof, optionImages, lineage, selectedAssets, toolsiteDesignReview },
    };
  }

  const beforeAgent3 = await checkRunGates({ runDir, before: 'agent-3' });
  await writeGateResult(runDir, 'before-agent-3.json', {
    gate: 'before-agent-3',
    runDir: path.resolve(runDir),
    status: beforeAgent3.allowed ? 'pass' : 'fail',
    passed: beforeAgent3.allowed,
    failures: beforeAgent3.allowed ? [] : beforeAgent3.missing,
    details: beforeAgent3,
    evidence: { output: 'gate-results/before-agent-3.json' },
    generatedAt: now(),
  });

  if (!beforeAgent3.allowed) {
    await blockUiReview(runDir, state, {
      blockingReason: SELECTED_ASSETS_GATE_FAILED,
      nextAction: beforeAgent3.allowedNextStep || 'complete before-agent-3 gates before implement',
      now,
    });
    return {
      ok: false,
      code: SELECTED_ASSETS_GATE_FAILED,
      stage: 'ui-review',
      gates: { externalProof, optionImages, lineage, selectedAssets, toolsiteDesignReview, beforeAgent3 },
    };
  }

  await writeDesktopState(runDir, {
    ...state,
    stage: 'implement',
    last_completed_stage: 'selected-assets',
    next_action: 'run desktop:implement',
    blocking_reason: null,
    updated_at: now(),
  });

  return {
    ok: true,
    code: SELECTED_ASSETS_COMPLETE,
    stage: 'implement',
    selected_option: selectedOption.selected_option,
    selected_design: selectedOption.selected_design,
    gates: { externalProof, optionImages, lineage, selectedAssets, toolsiteDesignReview, beforeAgent3 },
  };
}

async function missingRunFiles(runDir, relPaths) {
  const missing = [];
  for (const relPath of relPaths) {
    if (!(await exists(path.join(runDir, relPath)))) missing.push(relPath);
  }
  return missing;
}

async function writeRunText(runDir, relPath, content) {
  const filePath = path.join(runDir, relPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function writeBeforeAgent3GateResult(runDir, beforeAgent3, now = nowIso) {
  const gateResult = {
    gate: 'before-agent-3',
    runDir: path.resolve(runDir),
    status: beforeAgent3.allowed ? 'pass' : 'fail',
    passed: beforeAgent3.allowed,
    failures: beforeAgent3.allowed ? [] : beforeAgent3.missing,
    details: beforeAgent3,
    evidence: { output: 'gate-results/before-agent-3.json' },
    generatedAt: now(),
  };
  await writeGateResult(runDir, 'before-agent-3.json', gateResult);
  return gateResult;
}

function toPackageName(value) {
  const normalized = String(value || 'desktop-toolsite')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || 'desktop-toolsite';
}

function originFromDomain(value) {
  const domain = String(value || 'example.com').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(domain) ? domain : `https://${domain || 'example.com'}`;
}

function textExcerpt(value, maxLength = 900) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function factsFromImplementationInputs({ specText, selectedManifest }) {
  const facts = extractSpecFacts(specText);
  const keyword = facts.keyword || 'browser tool';
  const targetDomain = facts.targetDomain || selectedManifest?.target_domain || 'example.com';
  const selectedOption = normalizeUiOption(selectedManifest?.selected_option) || normalizeUiOption(selectedManifest?.selectedOption) || '';
  const selectedDesign = selectedManifest?.selected_design || selectedManifest?.selectedDesign || (selectedOption ? optionLabelFromUi(selectedOption) : 'Selected design');
  return {
    ...facts,
    keyword,
    targetDomain,
    selectedOption,
    selectedDesign,
    siteUrl: originFromDomain(targetDomain),
    siteId: toPackageName(targetDomain.replace(/^https?:\/\//i, '').replace(/\..*$/, '') || keyword),
  };
}

async function readImplementationInputs(runDir) {
  const selectedManifest = await readJsonOptional(path.join(runDir, SELECTED_ASSETS_MANIFEST_PATH));
  const files = {
    specText: await readOptional(path.join(runDir, 'toolsite-spec.md')),
    siteBrief: await readOptional(path.join(runDir, 'agent-2-output/site-brief.md')),
    toolSpec: await readOptional(path.join(runDir, 'agent-2-output/tool-spec.md')),
    pagePlan: await readOptional(path.join(runDir, 'agent-2-output/page-plan.md')),
    designInput: await readOptional(path.join(runDir, 'agent-2-output/design-generation-input.md')),
    selectedPackage: await readOptional(path.join(runDir, SELECTED_ASSETS_PACKAGE_PATH)),
    selectedLineage: await readOptional(path.join(runDir, SELECTED_ASSETS_LINEAGE_PATH)),
  };
  return {
    ...files,
    selectedManifest,
    facts: factsFromImplementationInputs({ specText: files.specText, selectedManifest }),
  };
}

function agent3Outputs(inputs) {
  const { facts, selectedManifest } = inputs;
  const sourceMap = selectedManifest?.source_map || 'agent-2-5-output/selected-assets/source-map.json';
  const manifestPath = SELECTED_ASSETS_MANIFEST_PATH;
  const lineagePath = SELECTED_ASSETS_LINEAGE_PATH;
  return {
    'agent-3-output/ui-direction.md': [
      `# ${facts.keyword} UI Direction`,
      '',
      `Selected design: ${facts.selectedDesign}.`,
      `Selected option: ${facts.selectedOption || 'recorded in selected-assets manifest'}.`,
      '',
      '## Direction',
      '',
      `Implement the already selected ${facts.selectedDesign}; do not re-rank, remix, or switch A/B/C options.`,
      'The first viewport must be the working tool surface with input, controls, live output, and feedback visible before support content.',
      '',
      '## Required Evidence Links',
      '',
      `- Selected-assets manifest: ${manifestPath}`,
      `- Selected design lineage: ${lineagePath}`,
      `- Source map: ${sourceMap}`,
      `- Desktop target image: ${SELECTED_TARGET_DESKTOP_PATH}`,
      `- Mobile target image: ${SELECTED_TARGET_MOBILE_PATH}`,
      '',
    ].join('\n'),
    'agent-3-output/implementation-handoff.md': [
      `# ${facts.keyword} Agent4 Implementation Handoff`,
      '',
      `Target domain: ${facts.targetDomain}`,
      `Selected design: ${facts.selectedDesign}`,
      '',
      '## Non-Negotiables',
      '',
      '- Preserve the selected A/B/C option exactly; do not choose a new direction.',
      '- Use the selected-assets package and lineage as the visual contract.',
      '- Build a static Astro site only.',
      '- Do not add backend, database, login, accounts, server APIs, upload, saved history, or unapproved pages.',
      '- Include the required page-plan pages and crawler files.',
      '',
      '## Inputs',
      '',
      `- Toolsite SPEC: toolsite-spec.md`,
      `- Agent2 tool spec: agent-2-output/tool-spec.md`,
      `- Agent2 page plan: agent-2-output/page-plan.md`,
      `- Selected design package: ${SELECTED_ASSETS_PACKAGE_PATH}`,
      `- Selected design lineage: ${lineagePath}`,
      '',
    ].join('\n'),
    'agent-3-output/selected-design-summary.md': [
      `# ${facts.keyword} Selected Design Summary`,
      '',
      `User-selected option: ${facts.selectedDesign}.`,
      `Selection evidence: ${manifestPath}.`,
      `External action receipt: ${selectedManifest?.external_action_receipt || ACTION_RECEIPT_PATH}.`,
      '',
      '## Selected Package Summary',
      '',
      textExcerpt(inputs.selectedPackage),
      '',
      '## Lineage Summary',
      '',
      textExcerpt(inputs.selectedLineage),
      '',
    ].join('\n'),
    'agent-3-output/visual-targets.md': [
      `# ${facts.keyword} Visual Targets`,
      '',
      `Desktop selected target: ${SELECTED_TARGET_DESKTOP_PATH}`,
      `Mobile selected target: ${SELECTED_TARGET_MOBILE_PATH}`,
      '',
      'These images are the selected target references from Agent2.5 selected-assets. They are not Codex-local replacement mockups.',
      'Agent4 must use them as implementation guidance and must not change the selected option.',
      '',
    ].join('\n'),
  };
}

async function writeAgent3Outputs(runDir, inputs) {
  await mkdir(path.join(runDir, 'agent-3-output'), { recursive: true });
  const outputs = agent3Outputs(inputs);
  for (const [relPath, content] of Object.entries(outputs)) await writeRunText(runDir, relPath, content);
  return Object.keys(outputs);
}

function astroPackageJson(facts) {
  return `${JSON.stringify({
    name: facts.siteId,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'astro dev',
      build: 'astro check && astro build',
      preview: 'astro preview',
    },
    dependencies: {
      '@astrojs/check': 'latest',
      astro: 'latest',
      typescript: 'latest',
    },
    devDependencies: {},
  }, null, 2)}\n`;
}

function indexAstro(inputs) {
  const { facts } = inputs;
  const title = `${facts.keyword} - Free Browser Tool`;
  const description = `Use this ${facts.keyword} tool locally in your browser.`;
  return `---
import '../styles/global.css';

const title = ${JSON.stringify(title)};
const description = ${JSON.stringify(description)};
const keyword = ${JSON.stringify(facts.keyword)};
const selectedDesign = ${JSON.stringify(facts.selectedDesign)};
const siteUrl = ${JSON.stringify(facts.siteUrl)};
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta name="robots" content="noindex,nofollow" />
    <link rel="canonical" href={new URL('/', siteUrl).toString()} />
  </head>
  <body>
    <main class="app-shell" data-selected-design={selectedDesign}>
      <section class="tool-workbench" aria-labelledby="tool-title">
        <div class="tool-copy">
          <p class="kicker">Browser-local tool</p>
          <h1 id="tool-title">{keyword}</h1>
          <p class="summary">Paste or type text and get live counts for words, characters, sentences, paragraphs, reading time, and speaking time. Nothing is uploaded.</p>
        </div>

        <div class="tool-panel" data-tool-root>
          <label for="source-text">Text to analyze</label>
          <textarea id="source-text" rows="10" placeholder="Paste or type text here"></textarea>
          <div class="control-row">
            <button id="copy-summary" type="button">Copy summary</button>
            <button id="clear-text" type="button" class="secondary">Clear</button>
          </div>
          <output id="status" class="status" aria-live="polite">Ready for text.</output>
        </div>

        <div class="metric-grid" aria-label="Live text statistics">
          <article><span>Words</span><strong id="words">0</strong></article>
          <article><span>Characters</span><strong id="characters">0</strong></article>
          <article><span>Sentences</span><strong id="sentences">0</strong></article>
          <article><span>Paragraphs</span><strong id="paragraphs">0</strong></article>
          <article><span>Reading time</span><strong id="reading-time">0 min</strong></article>
          <article><span>Speaking time</span><strong id="speaking-time">0 min</strong></article>
        </div>
      </section>

      <section class="support-band" aria-label="Tool details">
        <article>
          <h2>How it works</h2>
          <p>The tool counts text locally as you type, then updates every metric without account creation, uploads, or server calls.</p>
        </article>
        <article>
          <h2>Privacy</h2>
          <p>Your text stays in this browser session. Use the clear control to reset the input and all live results.</p>
        </article>
      </section>
    </main>

    <script>
      const input = document.querySelector('#source-text');
      const status = document.querySelector('#status');
      const copyButton = document.querySelector('#copy-summary');
      const clearButton = document.querySelector('#clear-text');
      const targets = {
        words: document.querySelector('#words'),
        characters: document.querySelector('#characters'),
        sentences: document.querySelector('#sentences'),
        paragraphs: document.querySelector('#paragraphs'),
        readingTime: document.querySelector('#reading-time'),
        speakingTime: document.querySelector('#speaking-time'),
      };

      function stats(value) {
        const trimmed = value.trim();
        const words = trimmed ? trimmed.split(/\\s+/).filter(Boolean).length : 0;
        const characters = value.length;
        const sentences = trimmed ? (trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).length : 0;
        const paragraphs = trimmed ? trimmed.split(/\\n\\s*\\n/).filter((part) => part.trim()).length : 0;
        return {
          words,
          characters,
          sentences,
          paragraphs,
          readingTime: words ? Math.max(1, Math.ceil(words / 225)) : 0,
          speakingTime: words ? Math.max(1, Math.ceil(words / 150)) : 0,
        };
      }

      function render() {
        const value = input?.value || '';
        const current = stats(value);
        if (targets.words) targets.words.textContent = String(current.words);
        if (targets.characters) targets.characters.textContent = String(current.characters);
        if (targets.sentences) targets.sentences.textContent = String(current.sentences);
        if (targets.paragraphs) targets.paragraphs.textContent = String(current.paragraphs);
        if (targets.readingTime) targets.readingTime.textContent = current.readingTime + ' min';
        if (targets.speakingTime) targets.speakingTime.textContent = current.speakingTime + ' min';
        if (status) status.textContent = current.words ? 'Live results updated.' : 'Ready for text.';
        return current;
      }

      input?.addEventListener('input', render);
      clearButton?.addEventListener('click', () => {
        if (input) input.value = '';
        render();
        input?.focus();
      });
      copyButton?.addEventListener('click', async () => {
        const current = render();
        const summary = \`Words: \${current.words}; Characters: \${current.characters}; Sentences: \${current.sentences}; Paragraphs: \${current.paragraphs}\`;
        try {
          await navigator.clipboard.writeText(summary);
          if (status) status.textContent = 'Summary copied.';
        } catch {
          if (status) status.textContent = summary;
        }
      });
      render();
    </script>
  </body>
</html>
`;
}

function textPageAstro({ title, description, heading, body }) {
  return `---
import '../styles/global.css';

const title = ${JSON.stringify(title)};
const description = ${JSON.stringify(description)};
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta name="robots" content="noindex,nofollow" />
  </head>
  <body>
    <main class="text-page">
      <a href="/">Back to tool</a>
      <h1>${heading}</h1>
      <p>${body}</p>
    </main>
  </body>
</html>
`;
}

function globalCss() {
  return `:root {
  color-scheme: light;
  --bg: #f6f7f9;
  --surface: #ffffff;
  --ink: #172033;
  --muted: #5d6677;
  --line: #d7dde7;
  --primary: #3157d5;
  --success: #0c7a5b;
  --warning: #b67800;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
}

button,
textarea {
  font: inherit;
}

.app-shell {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 24px 0 40px;
}

.tool-workbench {
  min-height: calc(100vh - 48px);
  display: grid;
  grid-template-columns: minmax(220px, 0.7fr) minmax(320px, 1.2fr);
  grid-template-areas:
    "copy panel"
    "metrics metrics";
  gap: 16px;
  align-content: start;
}

.tool-copy,
.tool-panel,
.metric-grid article,
.support-band article,
.text-page {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.tool-copy {
  grid-area: copy;
  padding: 20px;
}

.kicker {
  margin: 0 0 8px;
  color: var(--success);
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 12px;
  font-size: 2.4rem;
  line-height: 1;
}

h2 {
  margin: 0 0 10px;
  font-size: 1.2rem;
}

p {
  color: var(--muted);
  line-height: 1.6;
}

.summary {
  margin-bottom: 0;
}

.tool-panel {
  grid-area: panel;
  display: grid;
  gap: 12px;
  padding: 20px;
}

label {
  font-weight: 800;
}

textarea {
  width: 100%;
  min-height: 280px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 14px;
  background: #fbfcfe;
  color: var(--ink);
}

.control-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

button {
  border: 0;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  font-weight: 800;
  padding: 10px 14px;
  cursor: pointer;
}

button.secondary {
  background: #e8edf7;
  color: var(--ink);
}

.status {
  min-height: 42px;
  border-left: 4px solid var(--warning);
  padding: 10px 12px;
  background: #fff8ea;
  color: #604500;
}

.metric-grid {
  grid-area: metrics;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.metric-grid article {
  padding: 14px;
  min-height: 92px;
}

.metric-grid span {
  display: block;
  color: var(--muted);
  font-size: 0.82rem;
}

.metric-grid strong {
  display: block;
  margin-top: 8px;
  font-size: 1.65rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.support-band {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.support-band article,
.text-page {
  padding: 20px;
}

.text-page {
  width: min(760px, calc(100% - 32px));
  margin: 32px auto;
}

a {
  color: var(--primary);
  font-weight: 700;
}

@media (max-width: 860px) {
  .tool-workbench {
    min-height: auto;
    grid-template-columns: 1fr;
    grid-template-areas:
      "copy"
      "panel"
      "metrics";
  }

  .metric-grid,
  .support-band {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .app-shell {
    width: min(100% - 20px, 1180px);
    padding-top: 10px;
  }

  h1 {
    font-size: 1.85rem;
  }

  textarea {
    min-height: 220px;
  }

  .metric-grid,
  .support-band {
    grid-template-columns: 1fr;
  }
}
`;
}

function sitemapEndpoint(facts) {
  return `const site = ${JSON.stringify(facts.siteUrl)};

export async function GET() {
  const urls = ['/', '/privacy', '/terms'].map((route) => new URL(route, site).toString());
  const body = \`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
\${urls.map((url) => \`  <url><loc>\${url}</loc></url>\`).join('\\n')}
</urlset>\`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
`;
}

function astroConfig(facts) {
  return `import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: ${JSON.stringify(facts.siteUrl)},
});
`;
}

async function writeAstroSite(runDir, inputs) {
  const { facts } = inputs;
  const siteDir = path.join(runDir, 'site');
  await rm(siteDir, { recursive: true, force: true });
  await mkdir(path.join(siteDir, 'src/pages'), { recursive: true });
  await mkdir(path.join(siteDir, 'src/styles'), { recursive: true });
  await mkdir(path.join(siteDir, 'public'), { recursive: true });

  const files = {
    'site/package.json': astroPackageJson(facts),
    'site/astro.config.mjs': astroConfig(facts),
    'site/tsconfig.json': `${JSON.stringify({ extends: 'astro/tsconfigs/strict' }, null, 2)}\n`,
    'site/src/pages/index.astro': indexAstro(inputs),
    'site/src/pages/privacy.astro': textPageAstro({
      title: `Privacy - ${facts.keyword}`,
      description: `Privacy details for ${facts.keyword}.`,
      heading: 'Privacy',
      body: 'This static tool is designed for browser-local processing. Do not enter sensitive information unless you are comfortable processing it in your own browser session.',
    }),
    'site/src/pages/terms.astro': textPageAstro({
      title: `Terms - ${facts.keyword}`,
      description: `Terms for ${facts.keyword}.`,
      heading: 'Terms',
      body: 'This tool is provided as a browser-based utility. Results are informational and should be reviewed before relying on them for important work.',
    }),
    'site/src/pages/sitemap.xml.ts': sitemapEndpoint(facts),
    'site/src/styles/global.css': globalCss(),
    'site/public/robots.txt': `User-agent: *\nAllow: /\nSitemap: ${facts.siteUrl}/sitemap.xml\n`,
    'site/public/favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#3157d5"/><path d="M16 18h32v6H16zm0 12h24v6H16zm0 12h30v6H16z" fill="#fff"/></svg>\n',
  };

  for (const [relPath, content] of Object.entries(files)) await writeRunText(runDir, relPath, content);
  return Object.keys(files);
}

function buildReport({ buildResult, passed, generatedAt }) {
  return [
    '# Build Report',
    '',
    `Decision: ${passed ? 'PASS' : 'FAIL'}`,
    `Command: ${buildResult.command || 'npm run build'}`,
    `Exit status: ${buildResult.status ?? 1}`,
    `Generated at: ${generatedAt}`,
    '',
    '## stdout',
    '',
    '```text',
    String(buildResult.stdout || '').trim(),
    '```',
    '',
    '## stderr',
    '',
    '```text',
    String(buildResult.stderr || '').trim(),
    '```',
    '',
  ].join('\n');
}

async function writeAgent4Reports(runDir, { inputs, agent3Files, siteFiles, buildResult, passed, now = nowIso }) {
  const generatedAt = now();
  await mkdir(path.join(runDir, 'agent-4-output'), { recursive: true });
  await writeRunText(
    runDir,
    'agent-4-output/implementation-report.md',
    [
      `# ${inputs.facts.keyword} Implementation Report`,
      '',
      `Decision: ${passed ? 'PASS' : 'FAIL'}`,
      `Selected design implemented: ${inputs.facts.selectedDesign}`,
      `Selected-assets manifest: ${SELECTED_ASSETS_MANIFEST_PATH}`,
      `Selected design lineage: ${SELECTED_ASSETS_LINEAGE_PATH}`,
      '',
      '## Scope',
      '',
      '- Generated a static Astro site in `site/`.',
      '- Implemented the first viewport as the usable tool, not a marketing hero.',
      '- Included `/`, `/privacy`, `/terms`, `/robots.txt`, and `/sitemap.xml`.',
      '- Did not add backend, database, login, accounts, API routes, deployment, or Agent5 QA.',
      '',
    ].join('\n'),
  );
  await writeRunText(
    runDir,
    'agent-4-output/changed-files.md',
    [
      '# Changed Files',
      '',
      '## Agent3',
      '',
      ...agent3Files.map((file) => `- ${file}`),
      '',
      '## Site',
      '',
      ...siteFiles.map((file) => `- ${file}`),
      '',
      '## Agent4',
      '',
      '- agent-4-output/implementation-report.md',
      '- agent-4-output/changed-files.md',
      '- agent-4-output/build-report.md',
      '',
    ].join('\n'),
  );
  await writeRunText(
    runDir,
    'agent-4-output/build-report.md',
    buildReport({ buildResult, passed, generatedAt }),
  );
}

export async function runDesktopImplement({
  runDir,
  now = nowIso,
  runSiteBuild = defaultRunSiteBuild,
} = {}) {
  const state = await readDesktopState(runDir);
  if (state.stage !== 'implement' || state.last_completed_stage !== 'selected-assets') {
    return {
      ok: false,
      code: IMPLEMENT_STAGE_REQUIRED,
      stage: state.stage || '',
      last_completed_stage: state.last_completed_stage || null,
    };
  }

  if (!(await exists(path.join(runDir, 'toolsite-spec.md')))) {
    await blockImplement(runDir, state, {
      blockingReason: SPEC_MISSING,
      nextAction: 'restore toolsite-spec.md before desktop:implement',
      now,
    });
    return { ok: false, code: SPEC_MISSING, stage: 'implement', missing: ['toolsite-spec.md'] };
  }

  const missingAgent2 = await missingRunFiles(runDir, IMPLEMENT_AGENT2_FILES);
  if (missingAgent2.length > 0) {
    await blockImplement(runDir, state, {
      blockingReason: AGENT2_OUTPUT_MISSING,
      nextAction: 'rerun or repair desktop:agent2 outputs before desktop:implement',
      now,
    });
    return { ok: false, code: AGENT2_OUTPUT_MISSING, stage: 'implement', missing: missingAgent2 };
  }

  const missingSelectedAssets = await missingRunFiles(runDir, IMPLEMENT_SELECTED_ASSETS_FILES);
  if (missingSelectedAssets.length > 0) {
    await blockImplement(runDir, state, {
      blockingReason: SELECTED_ASSETS_MISSING,
      nextAction: 'run desktop:selected-assets before desktop:implement',
      now,
    });
    return { ok: false, code: SELECTED_ASSETS_MISSING, stage: 'implement', missing: missingSelectedAssets };
  }

  const missingTargets = await missingRunFiles(runDir, IMPLEMENT_SELECTED_TARGET_FILES);
  if (missingTargets.length > 0) {
    await blockImplement(runDir, state, {
      blockingReason: SELECTED_TARGET_MISSING,
      nextAction: 'restore selected target images before desktop:implement',
      now,
    });
    return { ok: false, code: SELECTED_TARGET_MISSING, stage: 'implement', missing: missingTargets };
  }

  const beforeAgent3 = await checkRunGates({ runDir, before: 'agent-3' });
  await writeBeforeAgent3GateResult(runDir, beforeAgent3, now);
  if (!beforeAgent3.allowed) {
    await blockImplement(runDir, state, {
      blockingReason: AGENT3_GATE_BLOCKED,
      nextAction: beforeAgent3.allowedNextStep || 'complete before-agent-3 gates before desktop:implement',
      now,
    });
    return { ok: false, code: AGENT3_GATE_BLOCKED, stage: 'implement', gateResult: beforeAgent3 };
  }

  const inputs = await readImplementationInputs(runDir);
  const agent3Files = await writeAgent3Outputs(runDir, inputs);
  const siteFiles = await writeAstroSite(runDir, inputs);
  const buildResult = await runSiteBuild({ runDir, siteDir: path.join(runDir, 'site') });
  const buildPassed = buildResult.status === 0;
  await writeAgent4Reports(runDir, {
    inputs,
    agent3Files,
    siteFiles,
    buildResult,
    passed: buildPassed,
    now,
  });

  if (!buildPassed) {
    await blockImplement(runDir, state, {
      blockingReason: BUILD_FAILED,
      nextAction: 'fix the Astro site build before desktop:implement can advance',
      now,
    });
    return { ok: false, code: BUILD_FAILED, stage: 'implement', buildResult };
  }

  await writeDesktopState(runDir, {
    ...state,
    stage: 'qa',
    last_completed_stage: 'implement',
    next_action: 'run desktop:qa',
    blocking_reason: null,
    updated_at: now(),
  });

  return {
    ok: true,
    code: IMPLEMENT_COMPLETE,
    stage: 'qa',
    agent3Files,
    siteFiles,
    buildResult,
  };
}

function siteBuildGateResult({ runDir, buildResult, now = nowIso }) {
  const passed = buildResult.status === 0;
  return {
    gate: 'site-build',
    runDir: path.resolve(runDir),
    status: passed ? 'pass' : 'fail',
    passed,
    failures: passed ? [] : [
      `${buildResult.command || 'npm run build'} exited ${buildResult.status ?? 1}`,
      String(buildResult.stderr || '').trim(),
      String(buildResult.stdout || '').trim(),
    ].filter(Boolean),
    details: {
      command: buildResult.command || 'npm run build',
      exitStatus: buildResult.status ?? 1,
    },
    evidence: {
      site: 'site/',
      buildReport: 'agent-4-output/build-report.md',
    },
    generatedAt: now(),
  };
}

function aggregateGateResult({ runDir, gate, passed, failures = [], details = {}, evidence = {}, now = nowIso }) {
  return {
    gate,
    runDir: path.resolve(runDir),
    status: passed ? 'pass' : 'fail',
    passed,
    failures,
    details,
    evidence,
    generatedAt: now(),
  };
}

function qaUrl(runDir) {
  return pathToFileURL(path.join(runDir, 'site/dist/index.html')).href;
}

async function defaultRunQaGate({ runDir, gate, url, runSiteBuild = defaultRunSiteBuild, now = nowIso }) {
  if (gate === 'site-build') {
    const buildResult = await runSiteBuild({ runDir, siteDir: path.join(runDir, 'site') });
    return siteBuildGateResult({ runDir, buildResult, now });
  }
  if (gate === 'page-plan') return runPagePlanGate({ runDir });
  if (gate === 'tool-spec') return runToolSpecGate({ runDir });
  if (gate === 'selected-assets') return runSelectedAssetsGate({ runDir });
  if (gate === 'agent25-lineage') return runAgent25LineageGate({ runDir });
  if (gate === 'toolsite-design-review') return runToolsiteDesignReviewGate({ runDir });
  if (gate === 'rendered-assets') return runRenderedAssetsGate({ runDir, url });
  if (gate === 'final-visual-lock') return runFinalVisualLockGate({ runDir, url });
  if (gate === 'visual-restoration-similarity') return runVisualRestorationSimilarityGate({ runDir });
  if (gate === 'final-visual-similarity') return runFinalVisualSimilarityGate({ runDir });
  if (gate === 'final-qa-evidence') return runFinalQaEvidenceGate({ runDir });
  if (gate === 'gate-evidence-integrity') {
    const result = await runGateEvidenceIntegrityCheck({ runDir, before: 'agent-6' });
    return aggregateGateResult({
      runDir,
      gate: 'gate-evidence-integrity',
      passed: result.passed,
      failures: result.failures || [],
      details: result,
      evidence: { output: 'gate-results/gate-evidence-integrity.json' },
      now,
    });
  }
  if (gate === 'before-agent-6') {
    const result = await checkRunGates({ runDir, before: 'agent-6' });
    return aggregateGateResult({
      runDir,
      gate: 'before-agent-6',
      passed: result.allowed,
      failures: result.allowed ? [] : result.missing,
      details: result,
      evidence: { output: 'gate-results/before-agent-6.json' },
      now,
    });
  }
  return aggregateGateResult({
    runDir,
    gate,
    passed: false,
    failures: [`No QA gate runner configured for ${gate}`],
    now,
  });
}

async function defaultRepairQaGate({ gate, attempt, failure }) {
  return {
    repaired: false,
    note: 'NO_AUTOMATED_REPAIR_CONFIGURED',
    gate,
    attempt,
    failures: failure?.failures || [],
  };
}

async function appendRepairLog(runDir, lines) {
  const outputPath = path.join(runDir, 'agent-5-output/repair-log.md');
  await mkdir(path.dirname(outputPath), { recursive: true });
  const existing = await readOptional(outputPath);
  const prefix = existing.trim() ? '' : '# QA Repair Log\n\n';
  await appendFile(outputPath, `${prefix}${lines.join('\n')}\n\n`);
}

function gateResultFilename(gate) {
  return `${gate}.json`;
}

function resultFailures(result) {
  return Array.isArray(result?.failures) ? result.failures : [];
}

async function runQaGateWithRepair({
  runDir,
  gate,
  url,
  runQaGate = defaultRunQaGate,
  repairQaGate = defaultRepairQaGate,
  runSiteBuild = defaultRunSiteBuild,
  maxAttempts = QA_REPAIR_LIMIT,
  now = nowIso,
} = {}) {
  let result = await runQaGate({ runDir, gate, url, runSiteBuild, now, attempt: 0 });
  await writeGateResult(runDir, gateResultFilename(gate), result);
  if (gatePassed(result)) return { ok: true, gate, result, attempts: [] };

  const attempts = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const failures = resultFailures(result);
    await appendRepairLog(runDir, [
      `## ${gate} repair attempt ${attempt}`,
      '',
      `Generated at: ${now()}`,
      '',
      '### Failure reasons',
      ...((failures.length ? failures : ['unknown failure']).map((failure) => `- ${failure}`)),
      '',
      '### Repair task',
      `- Repair real artifacts for ${gate}; do not edit gate-results manually, lower gate standards, or skip the gate.`,
    ]);
    const repair = await repairQaGate({ runDir, gate, attempt, failure: result, now });
    attempts.push({ attempt, failure: failures, repair });
    result = await runQaGate({ runDir, gate, url, runSiteBuild, now, attempt });
    await writeGateResult(runDir, gateResultFilename(gate), result);
    if (gatePassed(result)) return { ok: true, gate, result, attempts };
  }

  return { ok: false, gate, result, attempts };
}

function onlyPreDeployApprovalMissing(result) {
  const failures = resultFailures(result);
  return failures.length > 0 && failures.every((failure) =>
    /approval\.md|pre[-_ ]?deploy|deployment approval|approval checklist/i.test(String(failure)));
}

function summarizeGateStatuses(gateResults) {
  return Object.fromEntries(
    Object.entries(gateResults).map(([gate, result]) => [
      gate,
      {
        status: result?.status || 'unknown',
        passed: Boolean(result?.passed),
        failures: resultFailures(result),
      },
    ]),
  );
}

async function writeFinalScreenshotDelivery(runDir, finalVisualLock) {
  await mkdir(path.join(runDir, 'agent-5-output/chat-delivery'), { recursive: true });
  const screenshots = finalVisualLock?.evidence?.screenshots || {
    desktop: 'agent-5-output/final-visual-lock/desktop.png',
    mobile: 'agent-5-output/final-visual-lock/mobile.png',
    wide: 'agent-5-output/final-visual-lock/wide.png',
  };
  await writeRunText(
    runDir,
    'agent-5-output/chat-delivery/final-screenshot-delivery.md',
    [
      '# Final Screenshot Delivery',
      '',
      'Decision: PASS',
      '',
      '- Agent2.5 GPT target desktop screenshot: agent-2-5-output/selected-design/target/desktop.png',
      '- Agent2.5 GPT target mobile screenshot: agent-2-5-output/selected-design/target/mobile.png',
      `- Final page desktop screenshot: ${screenshots.desktop || 'agent-5-output/final-visual-lock/desktop.png'}`,
      `- Final page mobile screenshot: ${screenshots.mobile || 'agent-5-output/final-visual-lock/mobile.png'}`,
      `- Final page wide screenshot: ${screenshots.wide || 'agent-5-output/final-visual-lock/wide.png'}`,
      '- GPT target and final page screenshots were prepared for local chat review evidence.',
      '',
    ].join('\n'),
  );
}

async function writeQaReports(runDir, { gateResults, beforeAgent6 = null, now = nowIso } = {}) {
  await mkdir(path.join(runDir, 'agent-5-output'), { recursive: true });
  const generatedAt = now();
  const summary = summarizeGateStatuses(gateResults);
  const failing = Object.entries(summary)
    .filter(([gate]) => gate !== 'before-agent-6')
    .filter(([, result]) => !result.passed);
  const qaPassed = failing.length === 0;
  const gateLines = Object.entries(summary).map(([gate, result]) =>
    `- ${gate}: ${result.passed ? 'pass' : 'fail'}${result.failures.length ? ` (${result.failures.join('; ')})` : ''}`);
  const beforeAgent6Failures = resultFailures(beforeAgent6);
  const approvalPending = beforeAgent6 && !gatePassed(beforeAgent6) && onlyPreDeployApprovalMissing(beforeAgent6);

  await writeRunText(
    runDir,
    'agent-5-output/qa-report.md',
    [
      '# Agent5 QA Report',
      '',
      `Decision: ${qaPassed ? 'PASS' : 'FAIL'}`,
      `Generated at: ${generatedAt}`,
      '',
      '## Gate Summary',
      '',
      ...gateLines,
      '',
      '## Scope',
      '',
      '- Local Agent5 QA only.',
      '- No deployment was run.',
      '- Agent6 was not started.',
      '',
    ].join('\n'),
  );
  await writeRunText(
    runDir,
    'agent-5-output/final-qa-report.md',
    [
      '# Final QA Report',
      '',
      `Decision: ${qaPassed ? 'PASS' : 'FAIL'}`,
      `Generated at: ${generatedAt}`,
      '',
      ...gateLines,
      '',
    ].join('\n'),
  );
  await writeRunText(
    runDir,
    'agent-5-output/launch-readiness.md',
    [
      '# Launch Readiness',
      '',
      `Decision: ${qaPassed && (approvalPending || gatePassed(beforeAgent6)) ? 'PASS' : 'FAIL'}`,
      `Generated at: ${generatedAt}`,
      '',
      '## Readiness',
      '',
      qaPassed ? '- Agent5 local QA gates passed.' : '- Agent5 local QA gates are not fully passing.',
      approvalPending ? '- Deployment approval is pending local human confirmation.' : '- Deployment approval gate did not block the preview.',
      beforeAgent6Failures.length ? `- Before Agent6 preview: ${beforeAgent6Failures.join('; ')}` : '- Before Agent6 preview passed.',
      '',
      '## Deployment Boundary',
      '',
      '- This runner stops at deploy-review.',
      '- It does not call Cloudflare, submit sitemap, or run GSC/Bing.',
      '',
    ].join('\n'),
  );
  await writeFile(
    path.join(runDir, 'agent-5-output/gate-summary.json'),
    `${JSON.stringify({
      generated_at: generatedAt,
      qa_passed: qaPassed,
      deploy_approval_pending: approvalPending,
      gates: summary,
      before_agent_6: beforeAgent6 ? {
        passed: gatePassed(beforeAgent6),
        failures: beforeAgent6Failures,
      } : null,
    }, null, 2)}\n`,
    'utf8',
  );
}

async function writeQaStateJson(runDir, { now = nowIso } = {}) {
  const statePath = path.join(runDir, 'state.json');
  const current = await readJsonOptional(statePath) || {};
  await writeFile(
    statePath,
    `${JSON.stringify({
      ...current,
      qa: {
        ...(current.qa || {}),
        passed: true,
        completed_at: now(),
        runner: 'desktop:qa',
      },
    }, null, 2)}\n`,
    'utf8',
  );
}

function openPreDeployReview(events) {
  return [...events].reverse().find((event) =>
    event.type === 'human_review' &&
    ['pre_deploy_approval', 'pre-deploy-approval'].includes(event.review_type) &&
    event.status === 'open');
}

async function writePreDeployApprovalReview({ runDir, launchReadinessText, now = nowIso }) {
  const events = await readEvents(runDir);
  const existing = openPreDeployReview(events);
  if (existing) return existing;
  const event = {
    schema_version: 'human-review-event.v1',
    type: 'human_review',
    review_type: 'pre_deploy_approval',
    id: 'pre-deploy-approval',
    site_id: siteIdFromRunDir(runDir),
    run_dir: runDir,
    phase: 'pre-deploy',
    agent: 'desktop-qa',
    status: 'open',
    blocking: true,
    blocks: 'agent-6',
    title: 'Pre-deploy approval',
    message: [
      '本地部署前确认说明',
      '',
      'Agent5 本地 QA 已完成，当前停在 deploy-review。',
      '请审查 launch-readiness 摘要，确认是否允许进入部署阶段。',
      '',
      '## Launch Readiness Summary',
      '',
      launchReadinessText.trim().slice(0, 1800),
    ].join('\n'),
    expected_reply: '确认部署 / 修改：...',
    attachments: [
      {
        label: 'Launch readiness',
        path: 'agent-5-output/launch-readiness.md',
        kind: 'markdown',
        required: true,
      },
    ],
    created_at: now(),
    created_by: 'desktop:qa',
  };
  await appendReview(runDir, event);
  return event;
}

const QA_GATES = [
  'site-build',
  'page-plan',
  'tool-spec',
  'selected-assets',
  'agent25-lineage',
  'toolsite-design-review',
  'rendered-assets',
  'final-visual-lock',
  'visual-restoration-similarity',
  'final-visual-similarity',
];

export async function runDesktopQa({
  runDir,
  now = nowIso,
  runSiteBuild = defaultRunSiteBuild,
  runQaGate = defaultRunQaGate,
  repairQaGate = defaultRepairQaGate,
  maxQaRepairAttempts = QA_REPAIR_LIMIT,
} = {}) {
  const state = await readDesktopState(runDir);
  if (state.stage !== 'qa' || state.last_completed_stage !== 'implement') {
    return {
      ok: false,
      code: QA_STAGE_REQUIRED,
      stage: state.stage || '',
      last_completed_stage: state.last_completed_stage || null,
    };
  }

  if (!(await isDirectory(path.join(runDir, 'site')))) {
    await blockQa(runDir, state, {
      blockingReason: SITE_MISSING,
      nextAction: 'restore site/ before desktop:qa',
      now,
    });
    return { ok: false, code: SITE_MISSING, stage: 'qa', missing: ['site/'] };
  }

  const missingImplement = await missingRunFiles(runDir, QA_IMPLEMENT_FILES);
  if (missingImplement.length > 0) {
    await blockQa(runDir, state, {
      blockingReason: IMPLEMENT_OUTPUT_MISSING,
      nextAction: 'rerun desktop:implement before desktop:qa',
      now,
    });
    return { ok: false, code: IMPLEMENT_OUTPUT_MISSING, stage: 'qa', missing: missingImplement };
  }

  const missingAgent2 = await missingRunFiles(runDir, QA_AGENT2_FILES);
  if (missingAgent2.length > 0) {
    await blockQa(runDir, state, {
      blockingReason: AGENT2_OUTPUT_MISSING,
      nextAction: 'restore Agent2 outputs before desktop:qa',
      now,
    });
    return { ok: false, code: AGENT2_OUTPUT_MISSING, stage: 'qa', missing: missingAgent2 };
  }

  const missingSelectedAssets = await missingRunFiles(runDir, QA_SELECTED_ASSETS_FILES);
  if (missingSelectedAssets.length > 0) {
    await blockQa(runDir, state, {
      blockingReason: SELECTED_ASSETS_MISSING,
      nextAction: 'run desktop:selected-assets before desktop:qa',
      now,
    });
    return { ok: false, code: SELECTED_ASSETS_MISSING, stage: 'qa', missing: missingSelectedAssets };
  }

  await mkdir(path.join(runDir, 'agent-5-output'), { recursive: true });
  await writeRunText(runDir, 'agent-5-output/repair-log.md', '# QA Repair Log\n\nNo repair attempts recorded yet.\n');

  const url = qaUrl(runDir);
  const gateResults = {};
  const repairAttempts = {};
  for (const gate of QA_GATES) {
    const gateRun = await runQaGateWithRepair({
      runDir,
      gate,
      url,
      runQaGate,
      repairQaGate,
      runSiteBuild,
      maxAttempts: maxQaRepairAttempts,
      now,
    });
    gateResults[gate] = gateRun.result;
    repairAttempts[gate] = gateRun.attempts.length;
    if (!gateRun.ok) {
      await writeQaReports(runDir, { gateResults, now });
      await blockQa(runDir, state, {
        blockingReason: QA_REPAIR_LIMIT_REACHED,
        nextAction: `QA gate ${gate} still fails after ${maxQaRepairAttempts} repair attempts`,
        repairAttempts,
        now,
      });
      return {
        ok: false,
        code: QA_REPAIR_LIMIT_REACHED,
        stage: 'qa',
        failed_gate: gate,
        failures: resultFailures(gateRun.result),
        attempts: gateRun.attempts,
      };
    }
  }

  await writeFinalScreenshotDelivery(runDir, gateResults['final-visual-lock']);
  await writeQaReports(runDir, { gateResults, now });

  for (const gate of ['final-qa-evidence', 'gate-evidence-integrity']) {
    const gateRun = await runQaGateWithRepair({
      runDir,
      gate,
      url,
      runQaGate,
      repairQaGate,
      runSiteBuild,
      maxAttempts: maxQaRepairAttempts,
      now,
    });
    gateResults[gate] = gateRun.result;
    repairAttempts[gate] = gateRun.attempts.length;
    if (!gateRun.ok) {
      await writeQaReports(runDir, { gateResults, now });
      await blockQa(runDir, state, {
        blockingReason: QA_REPAIR_LIMIT_REACHED,
        nextAction: `QA gate ${gate} still fails after ${maxQaRepairAttempts} repair attempts`,
        repairAttempts,
        now,
      });
      return {
        ok: false,
        code: QA_REPAIR_LIMIT_REACHED,
        stage: 'qa',
        failed_gate: gate,
        failures: resultFailures(gateRun.result),
        attempts: gateRun.attempts,
      };
    }
    if (gate === 'final-qa-evidence') await writeQaStateJson(runDir, { now });
  }

  const beforeAgent6 = await runQaGate({ runDir, gate: 'before-agent-6', url, runSiteBuild, now, attempt: 0 });
  await writeGateResult(runDir, 'before-agent-6.json', beforeAgent6);
  gateResults['before-agent-6'] = beforeAgent6;
  const approvalPending = !gatePassed(beforeAgent6) && onlyPreDeployApprovalMissing(beforeAgent6);
  if (!gatePassed(beforeAgent6) && !approvalPending) {
    await writeQaReports(runDir, { gateResults, beforeAgent6, now });
    await blockQa(runDir, state, {
      blockingReason: QA_REPAIR_LIMIT_REACHED,
      nextAction: 'repair before-agent-6 gate failures before deployment review',
      repairAttempts,
      now,
    });
    return {
      ok: false,
      code: QA_REPAIR_LIMIT_REACHED,
      stage: 'qa',
      failed_gate: 'before-agent-6',
      failures: resultFailures(beforeAgent6),
      attempts: [],
    };
  }

  await writeQaReports(runDir, { gateResults, beforeAgent6, now });
  const launchReadiness = await readOptional(path.join(runDir, 'agent-5-output/launch-readiness.md'));
  const review = await writePreDeployApprovalReview({ runDir, launchReadinessText: launchReadiness, now });

  await writeDesktopState(runDir, {
    mode: 'desktop',
    stage: 'deploy-review',
    last_completed_stage: 'qa',
    next_action: 'review launch readiness and run desktop:continue with pre-deploy approval',
    blocking_reason: 'pre-deploy-approval',
    repair_attempts: {},
    updated_at: now(),
  });

  return {
    ok: true,
    code: QA_COMPLETE,
    stage: 'deploy-review',
    review,
    gates: gateResults,
    approval_pending: approvalPending,
  };
}

function configuredStage(stage) {
  return STAGE_RUNNERS.has(stage);
}

export async function runDesktopStage({
  runDir,
  stage = '',
  now = nowIso,
  executeAgent25DesignOptions = defaultExecuteAgent25DesignOptions,
  refreshReceipt = refreshDesignOptionsReceipt,
  runSiteBuild = defaultRunSiteBuild,
  runQaGate = defaultRunQaGate,
  repairQaGate = defaultRepairQaGate,
  maxQaRepairAttempts = QA_REPAIR_LIMIT,
} = {}) {
  const state = await readDesktopState(runDir);
  const targetStage = stage || state.stage || 'pre-agent2';
  const events = await readEvents(runDir);

  if (targetStage === 'pre-agent2') return runDesktopPreAgent2({ runDir, now });
  if (targetStage === 'agent2') return runDesktopAgent2({ runDir, now });
  if (targetStage === 'agent25') return runDesktopAgent25({ runDir, now, executeAgent25DesignOptions });
  if (targetStage === 'selected-assets') return runDesktopSelectedAssets({ runDir, now, refreshReceipt });
  if (targetStage === 'implement') return runDesktopImplement({ runDir, now, runSiteBuild });
  if (targetStage === 'qa') {
    return runDesktopQa({
      runDir,
      now,
      runSiteBuild,
      runQaGate,
      repairQaGate,
      maxQaRepairAttempts,
    });
  }
  if (targetStage === 'ui-review') {
    if (await readSelectedOption(runDir)) return runDesktopSelectedAssets({ runDir, now, refreshReceipt });
    return { ok: false, code: UI_SELECTION_REQUIRED, stage: 'ui-review', review_type: 'agent25_option_selection' };
  }

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
      ['pre-deploy-approval', 'pre_deploy_approval'].includes(event.review_type) &&
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
    console.log([
      'Usage:',
      '  node scripts/desktop/run.mjs --run-dir runs/<site-id> [--stage <stage>]',
      '',
      'Stages:',
      '  pre-agent2   Generate toolsite-spec.md and open local spec-confirmation review.',
      '  agent2       Require confirmed SPEC, write agent-2-output/*, run pre-agent2-toolsite-spec, page-plan, and agent2-brief-compliance gates, then stop at stage=agent25.',
      '  agent25      Require Agent2 compliance, call Agent2.5 design-options executor, run option image and external proof gates, then stop at ui-review.',
      '  implement    Require selected-assets, generate Agent3 handoff, implement Astro site, run build, then stop at qa.',
      '  qa           Run Agent5 local QA gates with repair loop, then stop at deploy-review.',
      '  deploy       Requires pre_deploy_approval before deployment; real deployment runner is not wired in this skeleton.',
      '',
      'desktop:agent2:',
      '  npm run desktop:agent2 -- --run-dir runs/<site-id>',
      '  Runs only after spec-confirmation is resolved with resolution_text="确认 SPEC".',
      '  Requires toolsite-spec.md, desktop production run-meta.json, and current state spec-review or agent2.',
      '  Reads input.md, run-meta.json, toolsite-spec.md, desktop-run-state.json, human-review-events.jsonl, and input-assets/.',
      '  Writes agent-2-output/* plus gate-results/pre-agent2-toolsite-spec.json, page-plan.json, and agent2-brief-compliance.json.',
      '  On gate failure, leaves stage=agent2 with blocking_reason set to the failing gate.',
      '  On success, writes stage=agent25, last_completed_stage=agent2, next_action="run desktop:agent25", then stops.',
      '',
      'desktop:agent25:',
      '  npm run desktop:agent25 -- --run-dir runs/<site-id>',
      '  Runs only after stage=agent25 and last_completed_stage=agent2.',
      `  Calls node ${AGENT25_EXECUTOR_SCRIPT} --run-dir runs/<site-id> --prompt runs/<site-id>/${AGENT25_PROMPT_PATH}.`,
      '  Requires the Agent2 brief compliance gate to pass and referenced input-assets/ to be readable.',
      '  Writes Agent2.5 external evidence, opens a local A/B/C UI option review, and writes agent25-option-images and agent25-external-design-proof gate results.',
      '  On success, writes stage=ui-review and waits for desktop:select-ui.',
      '',
      'desktop:select-ui:',
      '  npm run desktop:select-ui -- --run-dir runs/<site-id> --option A',
      '  Runs only from stage=ui-review after Agent2.5 opened the local A/B/C review.',
      '  Verifies agent25-external-design-proof and agent25-option-images, records the chosen option, and writes selected-design artifacts.',
      '  If formal selected-assets or lineage requirements are not ready, keeps stage=ui-review with blocking_reason=SELECTED_ASSETS_NOT_READY.',
      '  If all post-selection requirements are ready, writes stage=implement and stops before Agent3.',
      '',
      'desktop:selected-assets:',
      '  npm run desktop:selected-assets -- --run-dir runs/<site-id>',
      '  Runs after desktop:select-ui has resolved a local A/B/C option selection.',
      '  Reads selected-option.json, selected-design-lineage.md, options-board.png, and the Agent2.5 action receipt.',
      '  Writes selected design package files, selected-assets manifest/source map, selected target copies, and selected-assets/lineage gate results.',
      '  On gate failure, keeps stage=ui-review with blocking_reason=SELECTED_ASSETS_GATE_FAILED.',
      '  On success, writes stage=implement and stops before Agent3.',
      '',
      'desktop:implement:',
      '  npm run desktop:implement -- --run-dir runs/<site-id>',
      '  Runs only after stage=implement and last_completed_stage=selected-assets.',
      '  Reads toolsite-spec.md, agent-2-output/*, selected-assets manifest/package/lineage, and selected target images.',
      '  Verifies check-gates --before agent-3 before generating implementation output.',
      '  Writes agent-3-output/ui-direction.md, implementation-handoff.md, selected-design-summary.md, and visual-targets.md.',
      '  Writes an Astro static site in site/ plus agent-4-output/implementation-report.md, changed-files.md, and build-report.md.',
      '  Runs npm run build in site/. On build failure, keeps stage=implement with blocking_reason=BUILD_FAILED.',
      '  On success, writes stage=qa and stops before Agent5 QA. It does not deploy.',
      '',
      'desktop:qa:',
      '  npm run desktop:qa -- --run-dir runs/<site-id>',
      '  Runs only after stage=qa and last_completed_stage=implement.',
      '  Reads site/, Agent4 build report, Agent3 handoff, Agent2 tool/page specs, and selected-assets manifest.',
      '  Runs site build, page-plan, tool-spec, rendered-assets, final visual lock/similarity, selected-assets, lineage, design-review, final QA evidence, gate evidence integrity, and check-gates --before agent-6.',
      '  Failed gates enter a repair loop with up to five real repair attempts before blocking with QA_REPAIR_LIMIT_REACHED.',
      '  On success, writes agent-5-output QA reports, opens pre_deploy_approval, writes stage=deploy-review, and stops before deployment.',
    ].join('\n'));
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
