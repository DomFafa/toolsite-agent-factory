import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRE_AGENT2_BLOCK_MESSAGE } from '../qa/check-pre-agent2-toolsite-spec.mjs';
import { requirePassingGateResult } from './gate-result-utils.mjs';

const AGENT_2_FILES = [
  'agent-2-output/site-brief.md',
  'agent-2-output/tool-spec.md',
  'agent-2-output/content-plan.md',
  'agent-2-output/seo-plan.md',
  'agent-2-output/ui-reference-dossier.md',
  'agent-2-output/design-generation-input.md',
  'agent-2-output/brief-compliance-summary.md',
];

const AGENT_2_5_FILES = [
  'agent-2-5-output/design-generation-prompt.md',
  'agent-2-5-output/design-manifest.md',
  'agent-2-5-output/design-generation-report.md',
  'agent-2-5-output/asset-acquisition-report.md',
  'agent-2-5-output/selected-design/target/desktop.png',
  'agent-2-5-output/selected-design/target/mobile.png',
  'agent-2-5-output/selected-design/design-tokens.md',
  'agent-2-5-output/selected-design/component-spec.md',
  'agent-2-5-output/selected-design/asset-plan.md',
  'agent-2-5-output/selected-design/image-slots.md',
  'agent-2-5-output/selected-design/usability-contract.md',
  'agent-2-5-output/selected-design/asset-quality-contract.md',
  'agent-2-5-output/selected-design/interaction-state-model.md',
  'agent-2-5-output/selected-design/dynamic-data-fit.md',
  'agent-2-5-output/selected-design/ux-self-audit.md',
  'agent-2-5-output/selected-design/restoration-rules.md',
  'agent-2-5-output/selected-design/forbidden-deviations.md',
  'agent-2-5-output/selected-design/selection-rationale.md',
];

const AGENT_2_5_EXTERNAL_PROVENANCE_FILES = [
  'agent-2-5-output/external-design-evidence/external-design-proof.json',
  'agent-2-5-output/external-design-evidence/external-response.md',
  'agent-2-5-output/external-design-evidence/conversation-screenshot.png',
  'agent-2-5-output/external-design-evidence/source-provenance.md',
  'agent-2-5-output/external-design-evidence/selected-design-lineage.md',
];

const AGENT_2_5_CHAT_DELIVERY_FILES = [
  'agent-2-5-output/chat-delivery/options-board.png',
  'agent-2-5-output/chat-delivery/option-selection.md',
];

const AGENT_3_FILES = [
  'agent-3-output/final-screenshots/desktop.png',
  'agent-3-output/final-screenshots/mobile.png',
  'agent-3-output/visual-diff-report.md',
  'agent-3-output/visual-match-score.md',
  'agent-3-output/visual-lock.md',
  'agent-3-output/implementation-handoff.md',
];

const AGENT_4_FILES = [
  'agent-4-output/implementation-report.md',
  'agent-4-output/changed-files.md',
  'site/package.json',
];

const BEFORE_ORDER = new Map([
  ['agent-2', 2],
  ['agent2', 2],
  ['agent-2.5', 2.5],
  ['agent2.5', 2.5],
  ['agent-2-5', 2.5],
  ['agent25', 2.5],
  ['agent-3', 3],
  ['agent3', 3],
  ['agent-4', 4],
  ['agent4', 4],
  ['agent-5-final', 5.9],
  ['final-qa', 5.9],
  ['agent-6', 6],
  ['agent6', 6],
]);

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

async function isDirectory(filePath) {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

async function listDirectories(filePath) {
  try {
    const entries = await readdir(filePath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

function normalizeBefore(before) {
  const normalized = String(before || '').trim().toLowerCase();
  const value = BEFORE_ORDER.get(normalized);
  if (!value) {
    throw new Error(`Unknown --before value: ${before}`);
  }
  return value;
}

function parseLedgerStatuses(ledgerText) {
  const statuses = new Map();
  const linePattern = /^-\s+\[(passed|blocked|waived)\]\s+(.+?)(?:\s+-|$)/gim;
  for (const match of ledgerText.matchAll(linePattern)) {
    statuses.set(match[2].trim().toLowerCase(), match[1].toLowerCase());
  }
  return statuses;
}

function ledgerHasWaiver(statuses, gateName) {
  return statuses.get(gateName.toLowerCase()) === 'waived';
}

export function reportHasPassDecision(reportText) {
  if (!reportText.trim()) return false;
  if (/status\s*:\s*fail/i.test(reportText)) return false;
  if (/pass\/fail decision\s*:\s*fail/i.test(reportText)) return false;
  if (/required threshold:\s*90/i.test(reportText) && /below\s+90/i.test(reportText)) return false;
  return (
    /decision\s*:\s*pass/i.test(reportText) ||
    /pass\/fail decision\s*:\s*pass/i.test(reportText) ||
    /status\s*:\s*pass/i.test(reportText) ||
    /passed\s*:\s*true/i.test(reportText) ||
    /90%.*passed/i.test(reportText)
  );
}

async function missingFiles(runDir, files) {
  const missing = [];
  for (const file of files) {
    if (!(await exists(path.join(runDir, file)))) {
      missing.push(file);
    }
  }
  return missing;
}

async function checkAgent1(runDir, statuses) {
  if (ledgerHasWaiver(statuses, 'Agent 1 Keyword Research')) return [];
  if (await exists(path.join(runDir, 'agent-1-output/keyword-research-report.md'))) return [];
  return ['agent-1-output/keyword-research-report.md or gate-ledger Agent 1 waiver'];
}

async function checkPreAgent2Spec(runDir) {
  const missing = await requirePassingGateResult(
    runDir,
    'pre-agent2-toolsite-spec.json',
    'Pre-Agent2 Toolsite SPEC Gate',
  );
  return missing.length > 0 ? [PRE_AGENT2_BLOCK_MESSAGE] : [];
}

async function checkWebAccessPreflight(runDir) {
  return requirePassingGateResult(runDir, 'web-access-preflight.json', 'repo-local web-access preflight');
}

async function checkAgent2(runDir) {
  const missing = await missingFiles(runDir, AGENT_2_FILES);
  missing.push(...(await requirePassingGateResult(runDir, 'page-plan.json', 'Agent 2 toolsite page plan')));
  missing.push(...(await requirePassingGateResult(runDir, 'agent2-brief-compliance.json', 'Agent 2 brief compliance')));
  return missing;
}

async function checkAgent25(runDir) {
  const missing = await missingFiles(runDir, AGENT_2_5_FILES);
  missing.push(...(await missingFiles(runDir, AGENT_2_5_EXTERNAL_PROVENANCE_FILES)));
  missing.push(...(await missingFiles(runDir, AGENT_2_5_CHAT_DELIVERY_FILES)));
  missing.push(
    ...(await requirePassingGateResult(
      runDir,
      'agent25-external-design-proof.json',
      'Agent 2.5 external GPT source proof',
    )),
  );
  missing.push(...(await requirePassingGateResult(runDir, 'agent25-option-images.json', 'Agent 2.5 reviewable UI option images')));
  missing.push(...(await requirePassingGateResult(runDir, 'agent25-lineage.json', 'Agent 2.5 lineage')));
  missing.push(...(await requirePassingGateResult(runDir, 'selected-assets.json', 'post-selection independent selected image assets')));

  const externalResponsePath = path.join(
    runDir,
    'agent-2-5-output/external-design-evidence/external-response.md',
  );
  const sourceProvenancePath = path.join(
    runDir,
    'agent-2-5-output/external-design-evidence/source-provenance.md',
  );
  const screenshotPath = path.join(
    runDir,
    'agent-2-5-output/external-design-evidence/conversation-screenshot.png',
  );
  const selectedDesignLineagePath = path.join(
    runDir,
    'agent-2-5-output/external-design-evidence/selected-design-lineage.md',
  );
  const optionSelectionPath = path.join(runDir, 'agent-2-5-output/chat-delivery/option-selection.md');
  const externalResponse = await readOptional(externalResponsePath);
  const sourceProvenance = await readOptional(sourceProvenancePath);
  const selectedDesignLineage = await readOptional(selectedDesignLineagePath);
  const optionSelection = await readOptional(optionSelectionPath);

  if ((await exists(sourceProvenancePath)) && !reportHasPassDecision(sourceProvenance)) {
    missing.push('agent-2-5-output/external-design-evidence/source-provenance.md with Decision: PASS');
  }
  if (await exists(externalResponsePath)) {
    if (!/typing-test-online\.com/i.test(externalResponse)) {
      missing.push('agent-2-5-output/external-design-evidence/external-response.md mentions typing-test-online.com');
    }
    if (!/design generation prompt/i.test(externalResponse)) {
      missing.push('agent-2-5-output/external-design-evidence/external-response.md contains the submitted design prompt');
    }
    if (!/option\s+[abc]|benchmark console|design target|design tokens/i.test(externalResponse)) {
      missing.push('agent-2-5-output/external-design-evidence/external-response.md contains generated design directions');
    }
  }
  if (await exists(screenshotPath)) {
    const screenshotStat = await stat(screenshotPath);
    if (screenshotStat.size < 10_000) {
      missing.push('agent-2-5-output/external-design-evidence/conversation-screenshot.png non-empty browser screenshot');
    }
  }
  if ((await exists(selectedDesignLineagePath)) && !reportHasPassDecision(selectedDesignLineage)) {
    missing.push('agent-2-5-output/external-design-evidence/selected-design-lineage.md with Decision: PASS');
  }
  if ((await exists(optionSelectionPath)) && !reportHasPassDecision(optionSelection)) {
    missing.push('agent-2-5-output/chat-delivery/option-selection.md with Decision: PASS');
  }
  if (await exists(optionSelectionPath)) {
    if (!/sent\s+to\s+chat|shown\s+in\s+chat|delivered\s+to\s+chat/i.test(optionSelection)) {
      missing.push('agent-2-5-output/chat-delivery/option-selection.md records that the three options were sent to the chat');
    }
    if (!/option\s+a/i.test(optionSelection) || !/option\s+b/i.test(optionSelection) || !/option\s+c/i.test(optionSelection)) {
      missing.push('agent-2-5-output/chat-delivery/option-selection.md mentions Option A, Option B, and Option C');
    }
    if (!/user\s+selected|selected\s+by\s+user|current\s+chat\s+user/i.test(optionSelection)) {
      missing.push('agent-2-5-output/chat-delivery/option-selection.md records explicit current-chat user choice');
    }
    if (/default(?:ed)?\s+after\s+3\s*(?:min|minutes?)|3[-\s]*(?:min|minute)s?\s+(?:default|timeout)|timeout\s+default/i.test(optionSelection)) {
      missing.push('agent-2-5-output/chat-delivery/option-selection.md must not use a 3-minute default in formal projects');
    }
  }

  const optionsRoot = path.join(runDir, 'agent-2-5-output/generated-designs');
  const optionCount = (await listDirectories(optionsRoot)).length;
  if (optionCount < 3) {
    missing.push('agent-2-5-output/generated-designs/ with at least three option directories');
  }

  return missing;
}

async function checkDesignPackageGate(runDir) {
  const report = 'agent-5-output/design-package-gate-report.md';
  const reportText = await readOptional(path.join(runDir, report));
  const missing = [];
  if (!reportHasPassDecision(reportText)) missing.push(`${report} with pass decision`);
  missing.push(...(await requirePassingGateResult(runDir, 'toolsite-design-review.json', 'toolsite design-review subset')));
  return missing;
}

async function checkAgent3(runDir) {
  return missingFiles(runDir, AGENT_3_FILES);
}

async function checkVisualRestorationGate(runDir) {
  const report = 'agent-5-output/visual-restoration-gate-report.md';
  const reportText = await readOptional(path.join(runDir, report));
  const missing = [];
  if (!reportHasPassDecision(reportText)) {
    missing.push(`${report} with pass decision and >=90 desktop/mobile match`);
  }
  missing.push(...(await requirePassingGateResult(runDir, 'visual-restoration-similarity.json', 'Agent 3 target-vs-restored visual similarity >=90%')));
  const visualScore = await readOptional(path.join(runDir, 'agent-3-output/visual-match-score.md'));
  for (const label of ['Desktop', 'Mobile', 'Overall']) {
    const score = Number(visualScore.match(new RegExp(`${label}\\s*:\\s*([\\d.]+)\\s*/\\s*100`, 'i'))?.[1]);
    if (!Number.isFinite(score) || score < 90) {
      missing.push(`agent-3-output/visual-match-score.md ${label.toLowerCase()} score >= 90`);
    }
  }
  return missing;
}

async function checkAgent4(runDir) {
  return missingFiles(runDir, AGENT_4_FILES);
}

async function checkFinalQa(runDir, state) {
  const missing = [];
  if (!state?.qa?.passed) missing.push('state.json qa.passed=true');
  if (!(await exists(path.join(runDir, 'agent-5-output/qa-report.md')))) missing.push('agent-5-output/qa-report.md');
  missing.push(...(await requirePassingGateResult(runDir, 'final-visual-lock.json', 'final Astro page visual lock')));
  missing.push(...(await requirePassingGateResult(runDir, 'final-visual-similarity.json', 'final target-vs-page visual similarity >=90%')));
  missing.push(...(await requirePassingGateResult(runDir, 'rendered-assets.json', 'rendered image/asset visibility')));
  missing.push(...(await requirePassingGateResult(runDir, 'tool-spec.json', 'Agent 2 tool spec implementation')));
  missing.push(...(await requirePassingGateResult(runDir, 'page-plan.json', 'Agent 2 page plan implementation')));
  missing.push(...(await requirePassingGateResult(runDir, 'final-qa-evidence.json', 'final QA evidence bundle')));

  const finalDeliveryPath = path.join(runDir, 'agent-5-output/chat-delivery/final-screenshot-delivery.md');
  if (!(await exists(finalDeliveryPath))) {
    missing.push('agent-5-output/chat-delivery/final-screenshot-delivery.md');
  } else {
    const finalDelivery = await readOptional(finalDeliveryPath);
    if (!reportHasPassDecision(finalDelivery)) {
      missing.push('agent-5-output/chat-delivery/final-screenshot-delivery.md with Decision: PASS');
    }
    if (!/gpt\s+target|agent\s*2\.?5\s+target/i.test(finalDelivery) || !/final\s+page|final\s+screenshot|implemented\s+page/i.test(finalDelivery)) {
      missing.push('agent-5-output/chat-delivery/final-screenshot-delivery.md records GPT target and final page screenshots sent to chat');
    }
  }
  return missing;
}

async function checkApproval(runDir) {
  const approval = await readOptional(path.join(runDir, 'approval.md'));
  if (!approval.trim()) return ['approval.md'];
  const unchecked = approval
    .split('\n')
    .filter((line) => /^-\s+\[\s\]/.test(line))
    .map((line) => line.replace(/^-\s+\[\s\]\s*/, '').trim());
  return unchecked.map((label) => `approval.md unchecked: ${label}`);
}

function firstAllowedNextStep(failedStages) {
  const first = failedStages[0]?.stage;
  return (
    {
      preAgent2Spec: 'Complete Pre-Agent2 Toolsite SPEC Gate',
      agent1: 'Run Agent 1 Keyword Research or record an explicit waiver',
      webAccessPreflight: 'Run repo-local web-access preflight gate',
      agent2: 'Run Agent 2 Site Brief',
      agent25: 'Run Agent 2.5 UI Design Generation',
      designPackageGate: 'Run Agent 5 Design Package Gate',
      agent3: 'Run Agent 3 Static Visual Restoration',
      visualRestorationGate: 'Run Agent 5 Visual Restoration Gate',
      agent4: 'Run Agent 4 Astro Implementation',
      finalQa: 'Run Agent 5 Final QA',
      approval: 'Complete production approval checklist',
    }[first] || 'No next step available'
  );
}

export async function checkRunGates({ runDir, before }) {
  const absoluteRunDir = path.resolve(runDir);
  const beforeOrder = normalizeBefore(before);
  const stateText = await readOptional(path.join(absoluteRunDir, 'state.json'));
  const state = stateText ? JSON.parse(stateText) : {};
  const ledgerText = await readOptional(path.join(absoluteRunDir, 'gate-ledger.md'));
  const ledgerStatuses = parseLedgerStatuses(ledgerText);
  const failedStages = [];

  const checks = [
    { stage: 'preAgent2Spec', applies: beforeOrder === 2, run: () => checkPreAgent2Spec(absoluteRunDir) },
    { stage: 'webAccessPreflight', applies: beforeOrder >= 2.5, run: () => checkWebAccessPreflight(absoluteRunDir) },
    { stage: 'agent1', applies: beforeOrder >= 2.5, run: () => checkAgent1(absoluteRunDir, ledgerStatuses) },
    { stage: 'agent2', applies: beforeOrder >= 2.5, run: () => checkAgent2(absoluteRunDir) },
    { stage: 'agent25', applies: beforeOrder >= 3, run: () => checkAgent25(absoluteRunDir) },
    { stage: 'designPackageGate', applies: beforeOrder >= 3, run: () => checkDesignPackageGate(absoluteRunDir) },
    { stage: 'agent3', applies: beforeOrder >= 4, run: () => checkAgent3(absoluteRunDir) },
    { stage: 'visualRestorationGate', applies: beforeOrder >= 4, run: () => checkVisualRestorationGate(absoluteRunDir) },
    { stage: 'agent4', applies: beforeOrder >= 5.9, run: () => checkAgent4(absoluteRunDir) },
    { stage: 'finalQa', applies: beforeOrder >= 6, run: () => checkFinalQa(absoluteRunDir, state) },
    { stage: 'approval', applies: beforeOrder >= 6, run: () => checkApproval(absoluteRunDir) },
  ];

  for (const check of checks) {
    if (!check.applies) continue;
    const missing = await check.run();
    if (missing.length > 0) failedStages.push({ stage: check.stage, missing });
  }

  const missing = failedStages.flatMap((failure) => failure.missing);
  const allowed = missing.length === 0;
  return {
    allowed,
    before,
    runDir: absoluteRunDir,
    missing,
    failedStages,
    allowedNextStep: allowed ? `Proceed to ${before}` : firstAllowedNextStep(failedStages),
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--')) {
      args[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  if (!args['run-dir']) throw new Error('Missing --run-dir');
  if (!args.before) throw new Error('Missing --before');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await checkRunGates({ runDir: args['run-dir'], before: args.before });
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.allowed) {
    console.log(`ALLOWED before ${args.before}`);
    console.log(`Next: ${result.allowedNextStep}`);
  } else {
    console.log(`BLOCKED before ${args.before}`);
    console.log('\nMissing:');
    for (const item of result.missing) console.log(`- ${item}`);
    console.log(`\nAllowed next step:\n- ${result.allowedNextStep}`);
  }
  process.exitCode = result.allowed ? 0 : 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
