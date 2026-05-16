#!/usr/bin/env node
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  parseRunInput,
  renderSpecReviewCard,
  renderToolsiteSpec,
  splitLocalReviewMessages,
} from '../run/pre-agent2-local-spec.mjs';
import { runAgent2BriefComplianceCheck, renderComplianceSummary } from '../run/check-agent2-brief-compliance.mjs';
import { runPreAgent2ToolsiteSpecGate } from '../qa/check-pre-agent2-toolsite-spec.mjs';
import { runPagePlanGate } from '../qa/check-page-plan.mjs';

export const NO_STAGE_RUNNER_CONFIGURED = 'NO_STAGE_RUNNER_CONFIGURED';
export const SPEC_REVIEW_OPEN = 'SPEC_REVIEW_OPEN';
export const HUMAN_REVIEW_REQUIRED = 'HUMAN_REVIEW_REQUIRED';
export const DESKTOP_STAGE_DONE = 'DESKTOP_STAGE_DONE';
export const DEPLOY_REQUIRES_APPROVAL = 'DEPLOY_REQUIRES_APPROVAL';
export const AGENT2_COMPLETE = 'AGENT2_COMPLETE';
export const AGENT2_COMPLIANCE_FAILED = 'AGENT2_COMPLIANCE_FAILED';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const STATE_FILE = 'desktop-run-state.json';
const EVENT_FILE = 'human-review-events.jsonl';

const STAGE_RUNNERS = new Set(['pre-agent2', 'agent2']);

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

function extractSpecFacts(specText, runDir) {
  const keyword = findLabeledValue(specText, ['keyword', 'primary keyword', '关键词']) || 'current tool';
  const targetDomain = findLabeledValue(specText, ['target domain', 'domain', '目标域名']) || 'target domain';
  const uiReference = findLabeledValue(specText, ['ui reference', 'ui 参考']) || 'confirmed UI direction';
  const uxReference = findLabeledValue(specText, ['ux reference', 'ux 参考']) || 'confirmed UX direction';
  const extraNotes =
    findLabeledValue(specText, ['extra ideas', 'constraints', 'mimic points', '额外想法', '限制', '模仿点']) ||
    'confirmed Toolsite SPEC constraints';
  const inputAssetLines = specText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /input-assets\//i.test(line))
    .map((line) => line.replace(new RegExp(`^${runDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?`), ''));

  return { keyword, targetDomain, uiReference, uxReference, extraNotes, inputAssetLines };
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

function renderAgent2Outputs({ specText, runDir }) {
  const facts = extractSpecFacts(specText, runDir);
  const common = [
    `Keyword: ${facts.keyword}`,
    `Target Domain: ${facts.targetDomain}`,
    `UI Reference: ${facts.uiReference}`,
    `UX Reference: ${facts.uxReference}`,
    `Extra Constraints: ${facts.extraNotes}`,
    'No login. No account. No dashboard. No pricing. No API. No upload. No saved history. No AI rewrite.',
  ].join('\n');
  const assets = facts.inputAssetLines.length
    ? facts.inputAssetLines.map((line) => `- ${line} — design_reference / illustration_reference`).join('\n')
    : '- No input-assets were supplied.';
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
      '',
      '## Build Direction',
      '',
      `Create a static frontend tool for ${facts.keyword} on ${facts.targetDomain}. The first screen must prioritize the actual tool workflow and preserve the confirmed UI and UX references.`,
      '',
      '## Input Assets',
      '',
      assets,
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
      'No login. No account. No backend. No database. No API. No upload. No saved history. No AI rewrite.',
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
      'No login. No account. No backend. No database. No API. No upload. No saved history. No AI rewrite.',
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

  await ensurePreAgent2GateConfirmationEvent(runDir, events, now);
  const specText = await readFile(path.join(runDir, 'toolsite-spec.md'), 'utf8');
  const preAgent2Gate = await runPreAgent2ToolsiteSpecGate({ runDir });
  await writeGateResult(runDir, 'pre-agent2-toolsite-spec.json', preAgent2Gate);
  if (!preAgent2Gate.passed) {
    await writeDesktopState(runDir, {
      ...state,
      stage: 'agent2',
      next_action: 'Fix Toolsite SPEC before Agent2.',
      blocking_reason: 'pre-agent2-toolsite-spec',
    });
    return { ok: false, code: AGENT2_COMPLIANCE_FAILED, stage: 'agent2', gateResult: preAgent2Gate };
  }

  const outputDir = path.join(runDir, 'agent-2-output');
  await mkdir(outputDir, { recursive: true });
  const outputs = renderAgent2Outputs({ specText, runDir });
  for (const [fileName, content] of Object.entries(outputs)) {
    await writeFile(path.join(outputDir, fileName), content, 'utf8');
  }

  const pagePlanGate = await runPagePlanGate({ runDir });
  await writeGateResult(runDir, 'page-plan.json', pagePlanGate);

  const compliance = await runAgent2BriefComplianceCheck({ runDir });
  await writeFile(path.join(outputDir, 'brief-compliance-summary.md'), renderComplianceSummary(compliance), 'utf8');
  await writeGateResult(runDir, 'agent2-brief-compliance.json', compliance);

  if (!compliance.passed) {
    await writeDesktopState(runDir, {
      ...state,
      stage: 'agent2',
      next_action: 'Repair Agent2 outputs before Agent2.5.',
      blocking_reason: 'agent2-brief-compliance',
    });
    return { ok: false, code: AGENT2_COMPLIANCE_FAILED, stage: 'agent2', compliance };
  }

  await writeDesktopState(runDir, {
    ...state,
    stage: 'agent25',
    last_completed_stage: 'agent2',
    next_action: 'Run desktop:agent25.',
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

function configuredStage(stage) {
  return STAGE_RUNNERS.has(stage);
}

export async function runDesktopStage({ runDir, stage = '', now = nowIso } = {}) {
  const state = await readDesktopState(runDir);
  const targetStage = stage || state.stage || 'pre-agent2';
  const events = await readEvents(runDir);

  if (targetStage === 'pre-agent2') return runDesktopPreAgent2({ runDir, now });
  if (targetStage === 'agent2') return runDesktopAgent2({ runDir, now });

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
    console.log([
      'Usage:',
      '  node scripts/desktop/run.mjs --run-dir runs/<site-id> [--stage <stage>]',
      '',
      'Stages:',
      '  pre-agent2   Generate toolsite-spec.md and open local spec-confirmation review.',
      '  agent2       Require confirmed SPEC, write agent-2-output/*, run pre-agent2-toolsite-spec, page-plan, and agent2-brief-compliance gates, then stop at stage=agent25.',
      '  agent25      Not wired yet; returns NO_STAGE_RUNNER_CONFIGURED.',
      '  implement    Not wired yet; returns NO_STAGE_RUNNER_CONFIGURED.',
      '  qa           Not wired yet; returns NO_STAGE_RUNNER_CONFIGURED.',
      '  deploy       Requires pre_deploy_approval before deployment; real deployment runner is not wired in this skeleton.',
      '',
      'desktop:agent2:',
      '  npm run desktop:agent2 -- --run-dir runs/<site-id>',
      '  Reads toolsite-spec.md, run-meta.json, desktop-run-state.json, human-review-events.jsonl, and input-assets references.',
      '  Writes agent-2-output/* plus gate-results/pre-agent2-toolsite-spec.json, page-plan.json, and agent2-brief-compliance.json.',
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
