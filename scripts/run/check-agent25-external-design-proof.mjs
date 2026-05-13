#!/usr/bin/env node
// Production run behavior is governed by docs/production-run-master-contract.md.
// If this entrypoint conflicts with the contract, the contract wins.
// Agent2.5 external proof must document the approved high-fidelity visual generation path or block with NO_APPROVED_UI_GENERATION_AVAILABLE rather than accept mockups.
import { access, readFile, stat } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { reportHasPassDecision } from './check-gates.mjs';
import { resultFromFailures, writeGateResult } from './gate-result-utils.mjs';

const PROOF_PATH = 'agent-2-5-output/external-design-evidence/external-design-proof.json';
const EXTERNAL_RESPONSE_PATH = 'agent-2-5-output/external-design-evidence/external-response.md';
const CONVERSATION_SCREENSHOT_PATH = 'agent-2-5-output/external-design-evidence/conversation-screenshot.png';
const SOURCE_PROVENANCE_PATH = 'agent-2-5-output/external-design-evidence/source-provenance.md';
const SELECTED_LINEAGE_PATH = 'agent-2-5-output/external-design-evidence/selected-design-lineage.md';
const OPTIONS_BOARD_PATH = 'agent-2-5-output/chat-delivery/options-board.png';
const OPTION_SELECTION_PATH = 'agent-2-5-output/chat-delivery/option-selection.md';
const SELECTED_DESKTOP_PATH = 'agent-2-5-output/selected-design/target/desktop.png';
const SELECTED_MOBILE_PATH = 'agent-2-5-output/selected-design/target/mobile.png';
const ACTION_RECEIPT_PATH = 'agent-2-5-output/external-design-evidence/action-receipt.json';

const OPTION_LABELS = ['Option A', 'Option B', 'Option C'];
const ALWAYS_FORBIDDEN_SOURCE =
  /codex-local|codex\s+local|local\s+html|manual\s+mock|reconstructed|locally\s+generated\s+target|local\s+mock|generated\s+by\s+codex|codex\s+generated/i;
const PRODUCTION_DEFAULT_PATTERN =
  /default(?:ed)?\s+after\s+3\s*(?:min|minutes?)|3[-\s]*(?:min|minute)s?\s+(?:default|timeout)|timeout\s+default/i;
const EXTERNAL_SOURCE_PATTERN = /gpt|chatgpt|openai|external|approved\s+design\s+surface|design\s+surface|option\s+source/i;
const RAW_EXPORT_PATTERN = /raw|export|verbatim|conversation\s+export|model\s+response/i;
const CODEX_SUMMARY_PATTERN =
  /^#\s*External Design Evidence\b|generated\s+design\s+directions|submitted\s+prompt\s+target|codex\s+summary|not\s+a\s+raw\s+export/i;
const RECEIPT_PASS_PATTERN = /^pass$/i;
const VALID_SHA_PATTERN = /^[a-f0-9]{64}$/i;

function parseArgs(argv) {
  const args = { write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') {
      args.write = true;
    } else if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    }
  }
  if (!args.runDir) {
    throw new Error('Usage: node scripts/run/check-agent25-external-design-proof.mjs --run-dir runs/<site-id> [--write]');
  }
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

async function readTextOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function readJsonOptional(filePath) {
  const text = await readTextOptional(filePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readBufferOptional(filePath) {
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

async function statOptional(filePath) {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isPng(buffer) {
  return (
    buffer &&
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function pathValue(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function artifactHashFor(receipt, relPath) {
  const hashes = receipt?.artifact_hashes || receipt?.artifactHashes;
  if (hashes && typeof hashes === 'object' && !Array.isArray(hashes)) {
    const value = hashes[relPath];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  if (Array.isArray(hashes)) {
    const match = hashes.find((entry) => entry?.path === relPath || entry?.relPath === relPath);
    if (typeof match?.sha256 === 'string' && match.sha256.trim()) return match.sha256.trim();
  }
  return '';
}

function receiptScreenshotFor(receipt, relPath) {
  const screenshots = Array.isArray(receipt?.screenshots) ? receipt.screenshots : [];
  return screenshots.find((screenshot) => pathValue(screenshot, ['path']) === relPath) || null;
}

function normalizeOptionId(value) {
  const text = String(value || '').trim().toLowerCase();
  if (/^(option[-_\s]*)?a$/.test(text) || /option\s+a/i.test(text)) return 'option-a';
  if (/^(option[-_\s]*)?b$/.test(text) || /option\s+b/i.test(text)) return 'option-b';
  if (/^(option[-_\s]*)?c$/.test(text) || /option\s+c/i.test(text)) return 'option-c';
  return text.replace(/\s+/g, '-');
}

function optionLabel(option) {
  const id = normalizeOptionId(option?.id || option?.label || option?.option);
  if (id === 'option-a') return 'Option A';
  if (id === 'option-b') return 'Option B';
  if (id === 'option-c') return 'Option C';
  return String(option?.label || option?.id || option?.option || '').trim();
}

function isProductionMode(mode) {
  return !/^(test|dry-run|dryrun)$/i.test(String(mode || 'production').trim());
}

function hasExternalSource(value) {
  return EXTERNAL_SOURCE_PATTERN.test(String(value || '')) && !ALWAYS_FORBIDDEN_SOURCE.test(String(value || ''));
}

function proofText(proof) {
  return JSON.stringify(proof || {}, null, 2);
}

async function checkFile({
  runDir,
  relPath,
  label,
  failures,
  minBytes = 1,
  requirePng = false,
  expectedSha = '',
  expectedShaSource = PROOF_PATH,
}) {
  if (!relPath) {
    failures.push(`missing ${label} path in ${PROOF_PATH}`);
    return null;
  }
  if (path.isAbsolute(relPath) || relPath.includes('..')) {
    failures.push(`${label} path must be a run-relative path: ${relPath}`);
    return null;
  }
  const absolutePath = path.join(runDir, relPath);
  if (!(await exists(absolutePath))) {
    failures.push(`missing ${relPath}`);
    return null;
  }
  const fileStat = await stat(absolutePath);
  if (fileStat.size < minBytes) failures.push(`${relPath} is too small for ${label} evidence`);
  const buffer = await readBufferOptional(absolutePath);
  if (requirePng && !isPng(buffer)) failures.push(`${relPath} must be a PNG screenshot/image`);
  const actualSha = buffer ? sha256(buffer) : '';
  if (expectedSha && actualSha !== expectedSha) failures.push(`${expectedShaSource} ${relPath} sha256 does not match actual file`);
  return { relPath, sha256: actualSha, size: fileStat.size, mtimeMs: fileStat.mtimeMs };
}

function requireTextContains({ text, pattern, label, failures }) {
  if (!pattern.test(text)) failures.push(label);
}

function requireNoForbidden({ text, label, failures, production }) {
  if (ALWAYS_FORBIDDEN_SOURCE.test(text)) failures.push(`${label} contains forbidden local/Codex fabrication language`);
  if (production && PRODUCTION_DEFAULT_PATTERN.test(text)) {
    failures.push(`${label} uses a 3-minute/default selection path in a formal project`);
  }
}

function requireSha(record, label, failures) {
  if (!VALID_SHA_PATTERN.test(String(record?.sha256 || ''))) {
    failures.push(`${PROOF_PATH} ${label}.sha256 is required`);
  }
}

async function validateReceiptHeader({ runDir, receipt, receiptStat, failures }) {
  if (!receipt) {
    failures.push(`missing or invalid ${ACTION_RECEIPT_PATH}`);
    return false;
  }
  if (receipt.action !== 'design-options') {
    failures.push(`${ACTION_RECEIPT_PATH} action must be design-options`);
  }
  if (!RECEIPT_PASS_PATTERN.test(String(receipt.status || ''))) {
    failures.push(`${ACTION_RECEIPT_PATH} external action evidence runner status must be pass`);
  }
  if (receipt.error) {
    failures.push(`${ACTION_RECEIPT_PATH} must not contain error when used as passing evidence`);
  }
  if (!String(receipt.runner_version || '').trim()) {
    failures.push(`${ACTION_RECEIPT_PATH} runner_version is required`);
  }
  if (!/web-access/i.test(`${receipt.tool?.name || ''} ${receipt.tool?.command || ''}`)) {
    failures.push(`${ACTION_RECEIPT_PATH} tool must identify repo-local web-access`);
  }
  if (!String(receipt.run_dir || '').trim()) {
    failures.push(`${ACTION_RECEIPT_PATH} run_dir is required`);
  }
  const startedAt = Date.parse(receipt.started_at || '');
  const completedAt = Date.parse(receipt.completed_at || '');
  if (!Number.isFinite(startedAt)) failures.push(`${ACTION_RECEIPT_PATH} started_at must be an ISO timestamp`);
  if (!Number.isFinite(completedAt)) failures.push(`${ACTION_RECEIPT_PATH} completed_at must be an ISO timestamp`);
  if (Number.isFinite(startedAt) && Number.isFinite(completedAt) && completedAt < startedAt) {
    failures.push(`${ACTION_RECEIPT_PATH} completed_at must not be before started_at`);
  }
  if (!receiptStat?.isFile?.()) {
    failures.push(`${ACTION_RECEIPT_PATH} must be a file`);
  }

  const promptPath = pathValue(receipt, ['prompt_path', 'promptPath']);
  if (!promptPath) {
    failures.push(`${ACTION_RECEIPT_PATH} prompt_path is required`);
  } else if (!VALID_SHA_PATTERN.test(String(receipt.prompt_sha256 || ''))) {
    failures.push(`${ACTION_RECEIPT_PATH} prompt_sha256 is required`);
  } else {
    await checkFile({
      runDir,
      relPath: promptPath,
      label: 'external action prompt',
      failures,
      minBytes: 20,
      expectedSha: receipt.prompt_sha256,
      expectedShaSource: ACTION_RECEIPT_PATH,
    });
  }
  return RECEIPT_PASS_PATTERN.test(String(receipt.status || ''));
}

async function requireReceiptArtifact({
  runDir,
  receipt,
  receiptStat,
  relPath,
  label,
  failures,
  minBytes = 1,
  requirePng = false,
}) {
  if (!receipt || !relPath) return null;
  const expectedSha = artifactHashFor(receipt, relPath);
  if (!VALID_SHA_PATTERN.test(expectedSha)) {
    failures.push(`${ACTION_RECEIPT_PATH} missing artifact hash for ${relPath}`);
    return null;
  }
  const checked = await checkFile({
    runDir,
    relPath,
    label,
    failures,
    minBytes,
    requirePng,
    expectedSha,
    expectedShaSource: ACTION_RECEIPT_PATH,
  });
  if (checked && receiptStat && checked.mtimeMs > receiptStat.mtimeMs + 10) {
    failures.push(`${relPath} is newer than ${ACTION_RECEIPT_PATH}; rerun the external action evidence runner`);
  }
  return checked;
}

function optionById(options, id) {
  const normalized = normalizeOptionId(id);
  return options.find((option) => normalizeOptionId(option.id || option.label || option.option) === normalized);
}

export async function runAgent25ExternalDesignProofGate({ runDir }) {
  const absoluteRunDir = path.resolve(runDir);
  const failures = [];
  const evidenceDir = path.join(absoluteRunDir, 'agent-2-5-output/external-design-evidence');
  const proof = await readJsonOptional(path.join(absoluteRunDir, PROOF_PATH));
  const receiptPath = path.join(absoluteRunDir, ACTION_RECEIPT_PATH);
  const receipt = await readJsonOptional(receiptPath);
  const receiptStat = await statOptional(receiptPath);
  const externalResponse = await readTextOptional(path.join(absoluteRunDir, EXTERNAL_RESPONSE_PATH));
  const sourceProvenance = await readTextOptional(path.join(absoluteRunDir, SOURCE_PROVENANCE_PATH));
  const selectedLineage = await readTextOptional(path.join(absoluteRunDir, SELECTED_LINEAGE_PATH));
  const optionSelection = await readTextOptional(path.join(absoluteRunDir, OPTION_SELECTION_PATH));

  if (!proof) {
    failures.push(`missing or invalid ${PROOF_PATH}`);
  }
  await validateReceiptHeader({ runDir: absoluteRunDir, receipt, receiptStat, failures });

  const mode = proof?.mode || 'production';
  const production = isProductionMode(mode);
  const allProofText = `${proofText(proof)}\n${sourceProvenance}\n${selectedLineage}\n${optionSelection}`;
  requireNoForbidden({ text: allProofText, label: 'Agent 2.5 external design proof', failures, production });

  if (!proof?.approvedDesignSurface || !hasExternalSource(proof.approvedDesignSurface)) {
    failures.push(`${PROOF_PATH} must identify ChatGPT/GPT/OpenAI or another approved external design surface`);
  }

  if (!externalResponse.trim()) {
    failures.push(`missing ${EXTERNAL_RESPONSE_PATH}`);
  } else {
    requireNoForbidden({ text: externalResponse, label: EXTERNAL_RESPONSE_PATH, failures, production });
    if (CODEX_SUMMARY_PATTERN.test(externalResponse)) {
      failures.push(`${EXTERNAL_RESPONSE_PATH} looks like a Codex summary instead of raw/exported GPT output`);
    }
    requireTextContains({
      text: externalResponse,
      pattern: /chatgpt|openai|assistant:|model\s+response|conversation\s+export|raw\s+external\s+response/i,
      label: `${EXTERNAL_RESPONSE_PATH} must contain raw/exported GPT response markers`,
      failures,
    });
    for (const label of OPTION_LABELS) {
      requireTextContains({
        text: externalResponse,
        pattern: new RegExp(label.replace(' ', '\\s+'), 'i'),
        label: `${EXTERNAL_RESPONSE_PATH} must include ${label}`,
        failures,
      });
    }
  }

  const externalResponseRecord = proof?.externalResponse || {};
  requireSha(externalResponseRecord, 'externalResponse', failures);
  if (pathValue(externalResponseRecord, ['path']) !== EXTERNAL_RESPONSE_PATH) {
    failures.push(`${PROOF_PATH} must map externalResponse.path to ${EXTERNAL_RESPONSE_PATH}`);
  }
  if (!RAW_EXPORT_PATTERN.test(`${externalResponseRecord.kind || ''} ${externalResponseRecord.type || ''} ${externalResponseRecord.source || ''}`)) {
    failures.push(`${PROOF_PATH} externalResponse must be marked raw/exported/verbatim, not summarized`);
  }
  await checkFile({
    runDir: absoluteRunDir,
    relPath: pathValue(externalResponseRecord, ['path']),
    label: 'raw external GPT response',
    failures,
    minBytes: 200,
    expectedSha: externalResponseRecord.sha256,
  });
  if (receipt?.raw_response && pathValue(receipt.raw_response, ['path']) !== EXTERNAL_RESPONSE_PATH) {
    failures.push(`${ACTION_RECEIPT_PATH} raw_response.path must map to ${EXTERNAL_RESPONSE_PATH}`);
  }
  await requireReceiptArtifact({
    runDir: absoluteRunDir,
    receipt,
    receiptStat,
    relPath: EXTERNAL_RESPONSE_PATH,
    label: 'runner-captured raw external GPT response',
    failures,
    minBytes: 200,
  });

  const screenshotRecord = proof?.conversationScreenshot || proof?.conversation || {};
  requireSha(screenshotRecord, 'conversationScreenshot', failures);
  if (pathValue(screenshotRecord, ['path']) !== CONVERSATION_SCREENSHOT_PATH) {
    failures.push(`${PROOF_PATH} must map conversationScreenshot.path to ${CONVERSATION_SCREENSHOT_PATH}`);
  }
  if (!hasExternalSource(`${screenshotRecord.surface || ''} ${screenshotRecord.source || ''} ${screenshotRecord.capturedFrom || ''}`)) {
    failures.push(`${PROOF_PATH} conversationScreenshot must identify the GPT/approved design surface`);
  }
  await checkFile({
    runDir: absoluteRunDir,
    relPath: pathValue(screenshotRecord, ['path']),
    label: 'GPT conversation screenshot',
    failures,
    minBytes: 10_000,
    requirePng: true,
    expectedSha: screenshotRecord.sha256,
  });
  if (!receiptScreenshotFor(receipt, CONVERSATION_SCREENSHOT_PATH)) {
    failures.push(`${ACTION_RECEIPT_PATH} screenshots must include ${CONVERSATION_SCREENSHOT_PATH}`);
  }
  await requireReceiptArtifact({
    runDir: absoluteRunDir,
    receipt,
    receiptStat,
    relPath: CONVERSATION_SCREENSHOT_PATH,
    label: 'runner-captured GPT conversation screenshot',
    failures,
    minBytes: 10_000,
    requirePng: true,
  });

  if (!sourceProvenance.trim()) {
    failures.push(`missing ${SOURCE_PROVENANCE_PATH}`);
  } else {
    if (!reportHasPassDecision(sourceProvenance)) failures.push(`${SOURCE_PROVENANCE_PATH} must include Decision: PASS`);
    requireNoForbidden({ text: sourceProvenance, label: SOURCE_PROVENANCE_PATH, failures, production });
    for (const label of OPTION_LABELS) {
      requireTextContains({
        text: sourceProvenance,
        pattern: new RegExp(label.replace(' ', '\\s+'), 'i'),
        label: `${SOURCE_PROVENANCE_PATH} must map ${label}`,
        failures,
      });
    }
    requireTextContains({
      text: sourceProvenance,
      pattern: /selected\s+option/i,
      label: `${SOURCE_PROVENANCE_PATH} must map the selected option`,
      failures,
    });
    requireTextContains({
      text: sourceProvenance,
      pattern: /desktop\s+target/i,
      label: `${SOURCE_PROVENANCE_PATH} must map the desktop target`,
      failures,
    });
    requireTextContains({
      text: sourceProvenance,
      pattern: /mobile\s+target/i,
      label: `${SOURCE_PROVENANCE_PATH} must map the mobile target`,
      failures,
    });
  }

  const options = Array.isArray(proof?.options) ? proof.options : [];
  if (options.length < 3) {
    failures.push(`${PROOF_PATH} must list Option A, Option B, and Option C source images`);
  }
  for (const label of OPTION_LABELS) {
    if (!options.some((option) => optionLabel(option) === label)) failures.push(`${PROOF_PATH} options must include ${label}`);
  }

  const optionEvidence = [];
  for (const option of options) {
    const label = optionLabel(option);
    const imagePath = pathValue(option, ['imagePath', 'sourceImagePath', 'desktopTargetPath', 'targetPath']);
    const source = `${option.source || ''} ${option.surface || ''} ${option.provenance || ''}`;
    requireSha(option, `${label} option`, failures);
    if (!hasExternalSource(source)) failures.push(`${PROOF_PATH} ${label} source must be GPT/external, not local`);
    const checked = await checkFile({
      runDir: absoluteRunDir,
      relPath: imagePath,
      label: `${label} GPT option source image`,
      failures,
      minBytes: 10_000,
      requirePng: true,
      expectedSha: option.sha256,
    });
    await requireReceiptArtifact({
      runDir: absoluteRunDir,
      receipt,
      receiptStat,
      relPath: imagePath,
      label: `${label} runner receipt option image`,
      failures,
      minBytes: 10_000,
      requirePng: true,
    });
    if (checked) {
      optionEvidence.push({ label, imagePath, sha256: checked.sha256 });
      if (sourceProvenance && !sourceProvenance.includes(checked.sha256) && !sourceProvenance.includes(imagePath)) {
        failures.push(`${SOURCE_PROVENANCE_PATH} must map ${label} to its GPT option source image or sha256`);
      }
    }
  }

  const boardRecord = proof?.optionsBoard || proof?.chatDelivery?.optionsBoard || {};
  requireSha(boardRecord, 'optionsBoard', failures);
  if (pathValue(boardRecord, ['path']) !== OPTIONS_BOARD_PATH) {
    failures.push(`${PROOF_PATH} must map optionsBoard.path to ${OPTIONS_BOARD_PATH}`);
  }
  if (!hasExternalSource(`${boardRecord.source || ''} ${boardRecord.provenance || ''}`)) {
    failures.push(`${PROOF_PATH} optionsBoard source must be assembled from GPT option sources, not local HTML/CSS`);
  }
  const boardHashes = boardRecord.containsOptionImageHashes || boardRecord.optionImageHashes || [];
  if (!Array.isArray(boardHashes) || boardHashes.length < 3) {
    failures.push(`${PROOF_PATH} optionsBoard must list the three GPT option image hashes used in the board`);
  } else {
    for (const option of optionEvidence) {
      if (!boardHashes.includes(option.sha256)) {
        failures.push(`${PROOF_PATH} optionsBoard hash list does not include ${option.label}`);
      }
    }
  }
  await checkFile({
    runDir: absoluteRunDir,
    relPath: pathValue(boardRecord, ['path']),
    label: 'chat-delivered GPT option board',
    failures,
    minBytes: 10_000,
    requirePng: true,
    expectedSha: boardRecord.sha256,
  });
  await requireReceiptArtifact({
    runDir: absoluteRunDir,
    receipt,
    receiptStat,
    relPath: OPTIONS_BOARD_PATH,
    label: 'runner receipt GPT option board',
    failures,
    minBytes: 10_000,
    requirePng: true,
  });

  if (!optionSelection.trim()) {
    failures.push(`missing ${OPTION_SELECTION_PATH}`);
  } else {
    if (!reportHasPassDecision(optionSelection)) failures.push(`${OPTION_SELECTION_PATH} must include Decision: PASS`);
    requireNoForbidden({ text: optionSelection, label: OPTION_SELECTION_PATH, failures, production });
    for (const label of OPTION_LABELS) {
      requireTextContains({
        text: optionSelection,
        pattern: new RegExp(label.replace(' ', '\\s+'), 'i'),
        label: `${OPTION_SELECTION_PATH} must mention ${label}`,
        failures,
      });
    }
    requireTextContains({
      text: optionSelection,
      pattern: /sent\s+to\s+chat|shown\s+in\s+chat|delivered\s+to\s+chat/i,
      label: `${OPTION_SELECTION_PATH} must record that the board was sent to the current chat`,
      failures,
    });
    if (production && !/user\s+selected|selected\s+by\s+user|current\s+chat\s+user/i.test(optionSelection)) {
      failures.push(`${OPTION_SELECTION_PATH} must record explicit user selection in formal projects`);
    }
  }

  const selectedOption = normalizeOptionId(proof?.selection?.selectedOption || proof?.selectedOption);
  if (!selectedOption || !optionById(options, selectedOption)) {
    failures.push(`${PROOF_PATH} must map selectedOption to one of Option A/B/C`);
  }
  if (production && !/user|current\s+chat/i.test(`${proof?.selection?.source || ''} ${proof?.selection?.selectedBy || ''}`)) {
    failures.push(`${PROOF_PATH} selection.source must record explicit current-chat user selection in formal projects`);
  }

  const targets = proof?.targets || proof?.selectedTargets || {};
  for (const [name, canonicalPath] of [
    ['desktop', SELECTED_DESKTOP_PATH],
    ['mobile', SELECTED_MOBILE_PATH],
  ]) {
    const record = targets[name] || {};
    requireSha(record, `targets.${name}`, failures);
    if (pathValue(record, ['path']) !== canonicalPath) {
      failures.push(`${PROOF_PATH} targets.${name}.path must map to ${canonicalPath}`);
    }
    if (normalizeOptionId(record.sourceOption) !== selectedOption) {
      failures.push(`${PROOF_PATH} targets.${name}.sourceOption must match selectedOption`);
    }
    if (!hasExternalSource(`${record.source || ''} ${record.provenance || ''}`)) {
      failures.push(`${PROOF_PATH} targets.${name}.source must be derived from GPT/external option source`);
    }
    await checkFile({
      runDir: absoluteRunDir,
      relPath: pathValue(record, ['path']),
      label: `${name} selected design target`,
      failures,
      minBytes: 10_000,
      requirePng: true,
      expectedSha: record.sha256,
    });
    await requireReceiptArtifact({
      runDir: absoluteRunDir,
      receipt,
      receiptStat,
      relPath: canonicalPath,
      label: `${name} runner receipt selected target`,
      failures,
      minBytes: 10_000,
      requirePng: true,
    });
  }

  if (!selectedLineage.trim()) {
    failures.push(`missing ${SELECTED_LINEAGE_PATH}`);
  } else {
    if (!reportHasPassDecision(selectedLineage)) failures.push(`${SELECTED_LINEAGE_PATH} must include Decision: PASS`);
    requireNoForbidden({ text: selectedLineage, label: SELECTED_LINEAGE_PATH, failures, production });
    if (!hasExternalSource(selectedLineage)) {
      failures.push(`${SELECTED_LINEAGE_PATH} must state that the selected design came from GPT/approved external option`);
    }
    const selectedLabel = optionLabel(optionById(options, selectedOption) || { id: selectedOption });
    if (selectedLabel && !new RegExp(selectedLabel.replace(' ', '\\s+'), 'i').test(selectedLineage)) {
      failures.push(`${SELECTED_LINEAGE_PATH} must mention the selected ${selectedLabel}`);
    }
  }

  const selectedPackage = proof?.selectedDesignPackage || {};
  if (selectedPackage.codexLocalCreation === true) {
    failures.push(`${PROOF_PATH} selectedDesignPackage.codexLocalCreation must not be true`);
  }
  if (normalizeOptionId(selectedPackage.sourceOption) !== selectedOption) {
    failures.push(`${PROOF_PATH} selectedDesignPackage.sourceOption must match selectedOption`);
  }
  if (!hasExternalSource(`${selectedPackage.source || ''} ${selectedPackage.provenance || ''}`)) {
    failures.push(`${PROOF_PATH} selectedDesignPackage.source must identify GPT/external option lineage`);
  }

  return resultFromFailures({
    gate: 'agent25-external-design-proof',
    runDir: absoluteRunDir,
    failures,
    details: {
      mode,
      production,
      selectedOption,
      optionCount: options.length,
      evidenceDirectory: path.relative(absoluteRunDir, evidenceDir),
    },
    evidence: {
      proof: PROOF_PATH,
      externalResponse: EXTERNAL_RESPONSE_PATH,
      conversationScreenshot: CONVERSATION_SCREENSHOT_PATH,
      sourceProvenance: SOURCE_PROVENANCE_PATH,
      selectedDesignLineage: SELECTED_LINEAGE_PATH,
      optionsBoard: OPTIONS_BOARD_PATH,
      optionSelection: OPTION_SELECTION_PATH,
      actionReceipt: ACTION_RECEIPT_PATH,
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runAgent25ExternalDesignProofGate({ runDir: args.runDir });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'agent25-external-design-proof.json', result);
  console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} Agent 2.5 external GPT source proof`);
  if (result.failures.length) {
    for (const failure of result.failures) console.log(`- ${failure}`);
  }
  process.exitCode = result.passed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
