import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';

import { createDesktopRun, DESKTOP_RUN_CREATED } from './create-run.mjs';
import {
  AGENT2_COMPLIANCE_FAILED,
  AGENT2_COMPLETE,
  AGENT2_COMPLIANCE_REQUIRED,
  AGENT2_OUTPUT_MISSING,
  AGENT25_COMPLETE,
  AGENT25_EXECUTOR_FAILED,
  AGENT3_GATE_BLOCKED,
  BUILD_FAILED,
  DEPLOY_APPROVAL_REQUIRED,
  DEPLOY_COMPLETE,
  DEPLOY_FAILED,
  DEPLOY_REVIEW_REQUIRED,
  DEPLOY_REQUIRES_APPROVAL,
  DESKTOP_PRECONDITION_FAILED,
  GATE_EVIDENCE_INTEGRITY_REQUIRED,
  HUMAN_REVIEW_REQUIRED,
  IMPLEMENT_COMPLETE,
  IMPLEMENT_STAGE_REQUIRED,
  INVALID_DESKTOP_STAGE,
  INVALID_DEPLOY_APPROVAL,
  NEEDS_BING_CREDENTIALS,
  NEEDS_CLOUDFLARE_CREDENTIALS,
  NEEDS_SEARCH_CONSOLE_CREDENTIALS,
  NO_DEPLOY_RUNNER_CONFIGURED,
  NOT_PRODUCTION_RUN,
  QA_NOT_PASSED,
  NO_STAGE_RUNNER_CONFIGURED,
  QA_COMPLETE,
  QA_REPAIR_LIMIT_REACHED,
  QA_STAGE_REQUIRED,
  RUN_NOT_DEPLOYABLE,
  readDesktopState,
  runDesktopStage,
  SELECTED_ASSETS_COMPLETE,
  SELECTED_ASSETS_GATE_FAILED,
  SELECTED_ASSETS_MISSING,
  SELECTED_OPTION_MISSING,
  SITE_MISSING,
  SPEC_REVIEW_OPEN,
  UI_SELECTION_REQUIRED,
  AGENT6_GATE_BLOCKED,
} from './run.mjs';
import {
  continueDesktopRun,
  AGENT25_OUTPUT_MISSING,
  INVALID_UI_OPTION,
  REVIEW_RESOLVED,
  SELECTED_ASSETS_NOT_READY,
  SPEC_NOT_CONFIRMED,
  UI_REVIEW_REQUIRED,
} from './continue.mjs';

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function makeInput(root) {
  const inputPath = path.join(root, 'input.md');
  await writeFile(
    inputPath,
    [
      '# Desktop Input',
      '',
      '## Pre-Agent2 required user inputs',
      '',
      '- Keyword / 关键词: word counter',
      '- Target Domain / 目标域名: wordcounter-desktop.test',
      '- UI Reference / UI 参考: Stripe',
      '- UX Reference / UX 参考: wordcounter.net',
      '- Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点: 第一屏是工具；实时展示 words、characters、sentences、paragraphs、reading time、speaking time；本地处理；不要登录。',
      '',
    ].join('\n'),
  );
  return inputPath;
}

async function readEvents(runDir) {
  const text = await readFile(path.join(runDir, 'human-review-events.jsonl'), 'utf8');
  return text.trim()
    ? text.trim().split(/\n/).filter(Boolean).map((line) => JSON.parse(line))
    : [];
}

function pngBuffer(seed = 'a') {
  const header = Buffer.alloc(33);
  header.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(1440, 16);
  header.writeUInt32BE(900, 20);
  header[24] = 8;
  header[25] = 2;
  header[26] = 0;
  header[27] = 0;
  header[28] = 0;
  return Buffer.concat([header, Buffer.from(seed.repeat(10_100))]);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

let crcTable = null;

function crc32(buffer) {
  if (!crcTable) {
    crcTable = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      return value >>> 0;
    });
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function validPngBuffer(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = 1 + x * 4;
      const zone = Math.floor((x / width) * 3);
      row[offset] = (zone === 0 ? 180 : zone === 1 ? 40 : 80) + ((x * 13 + y * 7) % 50);
      row[offset + 1] = (zone === 0 ? 45 : zone === 1 ? 110 : 80) + ((x * 5 + y * 17) % 70);
      row[offset + 2] = (zone === 0 ? 60 : zone === 1 ? 170 : 40) + ((x * 11 + y * 3) % 80);
      row[offset + 3] = 255;
    }
    rows.push(row);
  }
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND'),
  ]);
}

async function writePng(runDir, relPath, seed) {
  const buffer = pngBuffer(seed);
  await mkdir(path.dirname(path.join(runDir, relPath)), { recursive: true });
  await writeFile(path.join(runDir, relPath), buffer);
  return sha256(buffer);
}

async function replaceAgent25ImagesWithFullBoard(runDir) {
  const image = validPngBuffer(900, 360);
  const imageSha = sha256(image);
  const relPaths = [
    'agent-2-5-output/chat-delivery/options-board.png',
    'agent-2-5-output/generated-designs/option-a/target/desktop.png',
    'agent-2-5-output/generated-designs/option-b/target/desktop.png',
    'agent-2-5-output/generated-designs/option-c/target/desktop.png',
    'agent-2-5-output/selected-design/target/desktop.png',
    'agent-2-5-output/selected-design/target/mobile.png',
  ];
  for (const relPath of relPaths) await writeFile(path.join(runDir, relPath), image);

  const proofPath = path.join(runDir, 'agent-2-5-output/external-design-evidence/external-design-proof.json');
  const proof = JSON.parse(await readFile(proofPath, 'utf8'));
  proof.options = proof.options.map((option) => ({ ...option, sha256: imageSha }));
  proof.optionsBoard.sha256 = imageSha;
  proof.optionsBoard.containsOptionImageHashes = [imageSha, imageSha, imageSha];
  proof.targets.desktop.sha256 = imageSha;
  proof.targets.mobile.sha256 = imageSha;
  await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`);

  const receiptPath = path.join(runDir, 'agent-2-5-output/external-design-evidence/action-receipt.json');
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  for (const relPath of relPaths) receipt.artifact_hashes[relPath] = imageSha;
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
}

async function refreshReceiptForCurrentArtifacts({ runDir, proof, receipt }) {
  const relPaths = [
    'agent-2-5-output/chat-delivery/options-board.png',
    'agent-2-5-output/generated-designs/option-a/target/desktop.png',
    'agent-2-5-output/generated-designs/option-b/target/desktop.png',
    'agent-2-5-output/generated-designs/option-c/target/desktop.png',
    'agent-2-5-output/selected-design/target/desktop.png',
    'agent-2-5-output/selected-design/target/mobile.png',
  ];
  const nextReceipt = {
    ...receipt,
    artifact_hashes: {
      ...(receipt.artifact_hashes || {}),
    },
  };
  for (const relPath of relPaths) nextReceipt.artifact_hashes[relPath] = sha256(await readFile(path.join(runDir, relPath)));
  await writeFile(
    path.join(runDir, 'agent-2-5-output/external-design-evidence/action-receipt.json'),
    `${JSON.stringify(nextReceipt, null, 2)}\n`,
  );
  await writeFile(
    path.join(runDir, 'agent-2-5-output/external-design-evidence/external-design-proof.json'),
    `${JSON.stringify(proof, null, 2)}\n`,
  );
  return { status: 0, stdout: '', stderr: '' };
}

function optionLabel(optionId) {
  if (optionId === 'option-a') return 'Option A';
  if (optionId === 'option-b') return 'Option B';
  if (optionId === 'option-c') return 'Option C';
  return optionId;
}

async function writeAgent25ExecutorFixture(runDir, { selectedOptionId = 'option-a' } = {}) {
  const externalResponsePath = 'agent-2-5-output/external-design-evidence/external-response.md';
  const conversationPath = 'agent-2-5-output/external-design-evidence/conversation-screenshot.png';
  const generatedImagePath = 'agent-2-5-output/external-design-evidence/downloads/generated-image-1.png';
  const sourceProvenancePath = 'agent-2-5-output/external-design-evidence/source-provenance.md';
  const selectedLineagePath = 'agent-2-5-output/external-design-evidence/selected-design-lineage.md';
  const optionsBoardPath = 'agent-2-5-output/chat-delivery/options-board.png';
  const optionSelectionPath = 'agent-2-5-output/chat-delivery/option-selection.md';
  const desktopPath = 'agent-2-5-output/selected-design/target/desktop.png';
  const mobilePath = 'agent-2-5-output/selected-design/target/mobile.png';
  const optionPaths = {
    'option-a': 'agent-2-5-output/generated-designs/option-a/target/desktop.png',
    'option-b': 'agent-2-5-output/generated-designs/option-b/target/desktop.png',
    'option-c': 'agent-2-5-output/generated-designs/option-c/target/desktop.png',
  };
  const selectedLabel = optionLabel(selectedOptionId);
  const selectedSeed = { 'option-a': 'a', 'option-b': 'b', 'option-c': 'c' }[selectedOptionId] || 'a';

  const optionASha = await writePng(runDir, optionPaths['option-a'], 'a');
  const optionBSha = await writePng(runDir, optionPaths['option-b'], 'b');
  const optionCSha = await writePng(runDir, optionPaths['option-c'], 'c');
  const conversationSha = await writePng(runDir, conversationPath, 'conversation');
  await writePng(runDir, generatedImagePath, 'generated');
  const boardSha = await writePng(runDir, optionsBoardPath, 'board');
  const desktopSha = await writePng(runDir, desktopPath, selectedSeed);
  const mobileSha = await writePng(runDir, mobilePath, `mobile-${selectedSeed}`);
  const selectedOptionSha = {
    'option-a': optionASha,
    'option-b': optionBSha,
    'option-c': optionCSha,
  }[selectedOptionId];

  const externalResponse = [
    'ChatGPT raw external response export',
    '',
    '## Submitted Prompt',
    '',
    await readFile(path.join(runDir, 'agent-2-output/design-generation-input.md'), 'utf8'),
    '',
    '## Captured Conversation Text',
    '',
    'Assistant:',
    'Option A: Dense word counter workbench with live metrics, desktop target, mobile target, and practical states.',
    'Option B: Friendly word counter with clear text input, live words, characters, sentences, paragraphs, and timers.',
    'Option C: Minimal progress-first word counter with accessible controls, result cards, and complete interaction states.',
    'The target domain is wordcounter-desktop.test and the design is for Astro HTML CSS vanilla JS restoration.',
  ].join('\n');
  await mkdir(path.dirname(path.join(runDir, externalResponsePath)), { recursive: true });
  await writeFile(path.join(runDir, externalResponsePath), externalResponse);
  const externalResponseSha = sha256(Buffer.from(externalResponse));

  await writeFile(
    path.join(runDir, sourceProvenancePath),
    [
      '# Source Provenance',
      '',
      'Decision: PASS',
      `Option A: GPT response Option A mapped to source image ${optionPaths['option-a']} sha ${optionASha}.`,
      `Option B: GPT response Option B mapped to source image ${optionPaths['option-b']} sha ${optionBSha}.`,
      `Option C: GPT response Option C mapped to source image ${optionPaths['option-c']} sha ${optionCSha}.`,
      `Selected option: ${selectedLabel} from GPT response ${selectedLabel}.`,
      `Desktop target: ${desktopPath} maps to GPT response ${selectedLabel} and source image sha ${selectedOptionSha}.`,
      `Mobile target: ${mobilePath} maps to GPT response ${selectedLabel} mobile target and source image sha ${selectedOptionSha}.`,
    ].join('\n'),
  );
  await writeFile(
    path.join(runDir, selectedLineagePath),
    [
      '# Selected Design Lineage',
      '',
      'Decision: PASS',
      `Selected ${selectedLabel} came from the ChatGPT approved external option response and its source image.`,
    ].join('\n'),
  );
  await mkdir(path.dirname(path.join(runDir, optionSelectionPath)), { recursive: true });
  await writeFile(
    path.join(runDir, optionSelectionPath),
    [
      '# Option Selection',
      '',
      'Decision: PASS',
      'Option A, Option B, and Option C were shown in chat as a dry-run option board.',
      `${selectedLabel} was selected by dry-run executor default for this dry-run only.`,
    ].join('\n'),
  );

  await writeFile(
    path.join(runDir, 'agent-2-5-output/external-design-evidence/external-design-proof.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        mode: 'dry-run',
        approvedDesignSurface: 'ChatGPT approved design surface',
        externalResponse: {
          path: externalResponsePath,
          kind: 'raw exported model response',
          sha256: externalResponseSha,
        },
        conversationScreenshot: {
          path: conversationPath,
          surface: 'ChatGPT web UI approved design surface',
          sha256: conversationSha,
        },
        options: [
          { id: 'option-a', label: 'Option A', source: 'GPT generated option source image', imagePath: optionPaths['option-a'], sha256: optionASha },
          { id: 'option-b', label: 'Option B', source: 'GPT generated option source image', imagePath: optionPaths['option-b'], sha256: optionBSha },
          { id: 'option-c', label: 'Option C', source: 'GPT generated option source image', imagePath: optionPaths['option-c'], sha256: optionCSha },
        ],
        optionsBoard: {
          path: optionsBoardPath,
          source: 'assembled from GPT option source images',
          containsOptionImageHashes: [optionASha, optionBSha, optionCSha],
          sha256: boardSha,
        },
        selection: {
          source: 'dry-run executor default after generated board capture',
          selectedOption: selectedOptionId,
        },
        targets: {
          desktop: {
            path: desktopPath,
            source: 'derived from GPT external option source',
            sourceOption: selectedOptionId,
            sha256: desktopSha,
          },
          mobile: {
            path: mobilePath,
            source: 'derived from GPT external option source',
            sourceOption: selectedOptionId,
            sha256: mobileSha,
          },
        },
        selectedDesignPackage: {
          source: 'GPT external option package',
          sourceOption: selectedOptionId,
          codexLocalCreation: false,
        },
      },
      null,
      2,
    ),
  );

  const promptPath = 'agent-2-output/design-generation-input.md';
  const artifactPaths = [
    externalResponsePath,
    conversationPath,
    generatedImagePath,
    optionsBoardPath,
    ...Object.values(optionPaths),
    desktopPath,
    mobilePath,
  ];
  const artifact_hashes = {};
  for (const relPath of artifactPaths) artifact_hashes[relPath] = sha256(await readFile(path.join(runDir, relPath)));
  const promptSha = sha256(await readFile(path.join(runDir, promptPath)));
  await writeFile(
    path.join(runDir, 'agent-2-5-output/external-design-evidence/action-receipt.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        action: 'design-options',
        run_dir: path.relative(process.cwd(), runDir).replace(/\\/g, '/'),
        started_at: '2026-05-16T00:00:00.000Z',
        completed_at: '2026-05-16T00:00:05.000Z',
        tool: {
          name: 'web-access',
          surface: 'ChatGPT web UI',
          command: 'web-access/scripts/check-deps.sh',
        },
        prompt_path: promptPath,
        prompt_sha256: promptSha,
        uploaded_assets: [],
        screenshots: [{ path: conversationPath, sha256: artifact_hashes[conversationPath], kind: 'conversation' }],
        raw_response: { path: externalResponsePath, sha256: artifact_hashes[externalResponsePath], kind: 'raw exported model response' },
        downloads: [{ path: generatedImagePath, sha256: artifact_hashes[generatedImagePath], kind: 'generated design image' }],
        artifact_hashes,
        status: 'pass',
        error: null,
        runner_version: 'agent25-external-action-evidence/1',
      },
      null,
      2,
    ),
  );
}

async function makeAgent25ReadyRun(root, { withAssets = false } = {}) {
  const inputPath = await makeInput(root);
  const args = { rootDir: root, siteId: 'wordcounter-desktop', inputPath };
  if (withAssets) {
    const assetDir = path.join(root, 'assets');
    await mkdir(assetDir);
    await writeFile(path.join(assetDir, 'reference.png'), 'fake image bytes');
    args.assetDir = assetDir;
  }
  const created = await createDesktopRun(args);
  await runDesktopStage({ runDir: created.runDir });
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'spec-confirmation',
    reply: '确认 SPEC',
  });
  const agent2 = await runDesktopStage({ runDir: created.runDir, stage: 'agent2' });
  assert.equal(agent2.code, AGENT2_COMPLETE);
  return created;
}

async function makeUiReviewReadyRun(root, { withAssets = false, selectedOptionId = 'option-a' } = {}) {
  const created = await makeAgent25ReadyRun(root, { withAssets });
  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'agent25',
    executeAgent25DesignOptions: async ({ runDir }) => {
      await writeAgent25ExecutorFixture(runDir, { selectedOptionId });
      return { status: 0, stdout: 'PASS Agent2.5 design-options executor' };
    },
  });
  assert.equal(result.code, AGENT25_COMPLETE);
  return created;
}

async function writeBeforeAgent3DesktopPrereqs(runDir) {
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    [
      '# Gate Ledger',
      '',
      '- [waived] Agent 1 Keyword Research - Desktop intake supplied the keyword directly.',
    ].join('\n'),
  );
  await writeFile(
    path.join(runDir, 'gate-results/web-access-preflight.json'),
    JSON.stringify(
      {
        gate: 'web-access-preflight',
        runDir,
        status: 'pass',
        passed: true,
        failures: [],
        details: {},
        evidence: {},
        generatedAt: '2026-05-16T08:00:00.000Z',
      },
      null,
      2,
    ),
  );
}

async function makeImplementReadyRun(root, { selectedOptionId = 'option-a' } = {}) {
  const created = await makeUiReviewReadyRun(root, { selectedOptionId });
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: selectedOptionId === 'option-b' ? 'B' : selectedOptionId === 'option-c' ? 'C' : 'A',
  });
  await writeBeforeAgent3DesktopPrereqs(created.runDir);
  const selectedAssets = await runDesktopStage({ runDir: created.runDir, stage: 'selected-assets' });
  assert.equal(selectedAssets.code, SELECTED_ASSETS_COMPLETE);
  assert.equal((await readDesktopState(created.runDir)).stage, 'implement');
  return created;
}

async function makeQaReadyRun(root, { selectedOptionId = 'option-a' } = {}) {
  const created = await makeImplementReadyRun(root, { selectedOptionId });
  const implemented = await runDesktopStage({
    runDir: created.runDir,
    stage: 'implement',
    runSiteBuild: async () => ({ status: 0, command: 'npm run build', stdout: 'build ok', stderr: '' }),
  });
  assert.equal(implemented.code, IMPLEMENT_COMPLETE);
  assert.equal((await readDesktopState(created.runDir)).stage, 'qa');
  return created;
}

async function makeDeployReviewReadyRun(root, { approve = true } = {}) {
  const created = await makeQaReadyRun(root);
  const qa = await runDesktopStage({
    runDir: created.runDir,
    stage: 'qa',
    runQaGate: passingQaGateRunner(),
  });
  assert.equal(qa.code, QA_COMPLETE);
  assert.equal((await readDesktopState(created.runDir)).stage, 'deploy-review');
  if (approve) {
    const continued = await continueDesktopRun({
      runDir: created.runDir,
      review: 'pre-deploy-approval',
      reply: '确认部署',
    });
    assert.equal(continued.code, REVIEW_RESOLVED);
    assert.equal((await readDesktopState(created.runDir)).stage, 'deploy-review');
  }
  return created;
}

function mockGateResult(runDir, gate, { passed = true, failures = [] } = {}) {
  return {
    gate,
    runDir,
    status: passed ? 'pass' : 'fail',
    passed,
    failures,
    details: {},
    evidence: {},
    generatedAt: '2026-05-16T11:00:00.000Z',
  };
}

function passingQaGateRunner({ fail = {} } = {}) {
  const calls = [];
  const runner = async ({ runDir, gate, attempt }) => {
    calls.push({ gate, attempt });
    const failure = fail[gate];
    if (typeof failure === 'function') return failure({ runDir, gate, attempt });
    if (failure) return mockGateResult(runDir, gate, { passed: false, failures: Array.isArray(failure) ? failure : [String(failure)] });
    if (gate === 'before-agent-6') {
      return mockGateResult(runDir, gate, { passed: false, failures: ['approval.md'] });
    }
    return mockGateResult(runDir, gate);
  };
  runner.calls = calls;
  return runner;
}

const DEPLOY_ENV = {
  CLOUDFLARE_API_TOKEN: 'cf-token',
  CLOUDFLARE_ACCOUNT_ID: 'cf-account',
  GOOGLE_SEARCH_CONSOLE_CREDENTIALS: '/tmp/gsc.json',
  BING_WEBMASTER_API_KEY: 'bing-key',
};

function passingDeployGate(runDir) {
  return {
    gate: 'before-agent-6',
    runDir,
    status: 'pass',
    passed: true,
    allowed: true,
    missing: [],
    failures: [],
    details: { allowed: true, missing: [] },
    evidence: {},
    generatedAt: '2026-05-16T12:00:00.000Z',
  };
}

function mockCloudflareDeploy(calls = []) {
  return async ({ runDir, siteDir, meta }) => {
    calls.push({ service: 'cloudflare', runDir, siteDir, target_domain: meta.target_domain });
    return {
      ok: true,
      project_name: 'wordcounter-desktop',
      deployment_id: 'mock-deployment-1',
      deployment_url: 'https://wordcounter-desktop.pages.dev',
      custom_domain: meta.target_domain,
      status: 'success',
      dry_run: true,
      launch_gates: {
        apex_custom_domain: { completed: true, evidence: 'mock apex custom domain active' },
        www_custom_domain: { completed: true, evidence: 'mock www custom domain active' },
        dns_switched_to_pages: { completed: true, evidence: 'mock DNS switched to Cloudflare Pages' },
        email_routing_catch_all: { completed: true, evidence: 'mock Email Routing catch-all completed' },
        speed_settings: { completed: true, evidence: 'mock Cloudflare Speed Settings completed' },
        image_transformations: { completed: true, evidence: 'mock Cloudflare Images Transformations enabled' },
        web_analytics: { completed: true, evidence: 'mock Web Analytics beacon verified' },
      },
    };
  };
}

function mockSearchConsoleSubmit(calls = []) {
  return async ({ domain, sitemapUrl }) => {
    calls.push({ service: 'gsc', domain, sitemapUrl });
    return {
      ok: true,
      status: 'completed',
      sitemap_url: sitemapUrl,
      evidence: 'mock GSC sitemap submission',
      dry_run: true,
    };
  };
}

function mockBingSubmit(calls = []) {
  return async ({ domain, sitemapUrl }) => {
    calls.push({ service: 'bing', domain, sitemapUrl });
    return {
      ok: true,
      status: 'completed',
      sitemap_url: sitemapUrl,
      submitted_url_count: 3,
      evidence: 'mock Bing sitemap and URL submission',
      dry_run: true,
    };
  };
}

test('desktop create-run creates expected run structure', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-create-'));
  const inputPath = await makeInput(root);
  const assetDir = path.join(root, 'assets');
  await mkdir(assetDir);
  await writeFile(path.join(assetDir, 'reference.png'), 'fake image bytes');

  const result = await createDesktopRun({
    rootDir: root,
    siteId: 'wordcounter-desktop',
    inputPath,
    assetDir,
    now: () => '2026-05-13T00:00:00.000Z',
  });

  assert.equal(result.code, DESKTOP_RUN_CREATED);
  const runDir = path.join(root, 'runs', 'wordcounter-desktop');
  for (const filePath of [
    'input.md',
    'run-meta.json',
    'human-review-events.jsonl',
    'desktop-run-state.json',
    'input-assets',
    'pre-agent2-output',
    'agent-2-output',
    'agent-2-5-output',
    'agent-3-output',
    'agent-4-output',
    'site',
    'agent-5-output',
    'gate-results',
    'deployment-output',
  ]) {
    assert.equal(await exists(path.join(runDir, filePath)), true, `${filePath} should exist`);
  }
  const meta = JSON.parse(await readFile(path.join(runDir, 'run-meta.json'), 'utf8'));
  assert.equal(meta.run_type, 'production');
  assert.equal(meta.deployable, true);
  assert.equal(meta.mode, 'desktop');
  assert.equal(meta.site_id, 'wordcounter-desktop');
  assert.equal(meta.target_domain, 'wordcounter-desktop.test');
  assert.equal(meta.status, 'active');
  assert.equal(meta.input_assets.length, 1);
});

test('desktop run stops at SPEC review', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-run-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });

  const result = await runDesktopStage({ runDir: created.runDir });
  const state = await readDesktopState(created.runDir);
  const events = await readEvents(created.runDir);

  assert.equal(result.code, SPEC_REVIEW_OPEN);
  assert.equal(state.stage, 'spec-review');
  assert.equal(await exists(path.join(created.runDir, 'toolsite-spec.md')), true);
  const review = events.find((event) => event.review_type === 'spec-confirmation' && event.status === 'open');
  assert.ok(review);
  assert.match(review.message, /Toolsite 需求确认/);
});

test('desktop continue refuses to skip unconfirmed SPEC', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-no-skip-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });
  await runDesktopStage({ runDir: created.runDir });

  const result = await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: 'A',
  });

  assert.equal(result.code, SPEC_NOT_CONFIRMED);
  assert.equal((await readDesktopState(created.runDir)).stage, 'spec-review');
});

test('desktop:agent2 writes Agent2 outputs, runs compliance, and stops before Agent2.5', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent2-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });
  await runDesktopStage({ runDir: created.runDir });

  const continued = await continueDesktopRun({
    runDir: created.runDir,
    review: 'spec-confirmation',
    reply: '确认 SPEC',
  });
  assert.equal(continued.code, REVIEW_RESOLVED);
  assert.equal((await readDesktopState(created.runDir)).stage, 'agent2');

  const result = await runDesktopStage({ runDir: created.runDir });
  assert.equal(result.code, AGENT2_COMPLETE);
  assert.equal(result.stage, 'agent25');
  const state = await readDesktopState(created.runDir);
  assert.equal(state.stage, 'agent25');
  assert.equal(state.last_completed_stage, 'agent2');
  assert.equal(state.next_action, 'run desktop:agent25');
  assert.equal(state.blocking_reason, null);

  for (const filePath of [
    'agent-2-output/site-brief.md',
    'agent-2-output/tool-spec.md',
    'agent-2-output/content-plan.md',
    'agent-2-output/seo-plan.md',
    'agent-2-output/page-plan.md',
    'agent-2-output/ui-reference-dossier.md',
    'agent-2-output/design-generation-input.md',
    'agent-2-output/brief-compliance-summary.md',
    'gate-results/pre-agent2-toolsite-spec.json',
    'gate-results/page-plan.json',
    'gate-results/agent2-brief-compliance.json',
  ]) {
    assert.equal(await exists(path.join(created.runDir, filePath)), true, `${filePath} should exist`);
  }

  const preAgent2SpecGate = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/pre-agent2-toolsite-spec.json'), 'utf8'));
  assert.equal(preAgent2SpecGate.gate, 'pre-agent2-toolsite-spec');
  assert.equal(preAgent2SpecGate.passed, true);

  const pagePlanGate = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/page-plan.json'), 'utf8'));
  assert.equal(pagePlanGate.gate, 'page-plan');
  assert.equal(pagePlanGate.passed, true);

  const compliance = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent2-brief-compliance.json'), 'utf8'));
  assert.equal(compliance.gate, 'agent2-brief-compliance');
  assert.equal(compliance.passed, true);
  assert.equal(compliance.can_proceed_to_agent25, true);

  assert.deepEqual(await readdir(path.join(created.runDir, 'agent-2-5-output')), []);
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
});

test('desktop:agent2 refuses to run before SPEC confirmation', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent2-unconfirmed-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });
  await runDesktopStage({ runDir: created.runDir });

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent2' });

  assert.equal(result.code, HUMAN_REVIEW_REQUIRED);
  assert.equal(result.stage, 'spec-review');
  assert.equal(await exists(path.join(created.runDir, 'agent-2-output/site-brief.md')), false);
});

test('desktop:agent2 refuses non-desktop production run metadata', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent2-meta-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });
  await runDesktopStage({ runDir: created.runDir });
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'spec-confirmation',
    reply: '确认 SPEC',
  });
  await writeFile(
    path.join(created.runDir, 'run-meta.json'),
    JSON.stringify({ mode: 'desktop', run_type: 'smoke', deployable: false }, null, 2),
  );

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent2' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, DESKTOP_PRECONDITION_FAILED);
  assert.equal(state.stage, 'agent2');
  assert.equal(state.blocking_reason, 'desktop-production-run-required');
  assert.equal(await exists(path.join(created.runDir, 'agent-2-output/site-brief.md')), false);
});

test('desktop:agent2 writes pre-agent2 SPEC gate result when SPEC file is missing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent2-missing-spec-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });
  await runDesktopStage({ runDir: created.runDir });
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'spec-confirmation',
    reply: '确认 SPEC',
  });
  await rm(path.join(created.runDir, 'toolsite-spec.md'));

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent2' });
  const state = await readDesktopState(created.runDir);
  const preAgent2SpecGate = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/pre-agent2-toolsite-spec.json'), 'utf8'));

  assert.equal(result.code, AGENT2_COMPLIANCE_FAILED);
  assert.equal(state.stage, 'agent2');
  assert.equal(state.blocking_reason, 'pre-agent2-toolsite-spec');
  assert.equal(preAgent2SpecGate.passed, false);
  assert.match(preAgent2SpecGate.failures.join('\n'), /missing toolsite-spec\.md/);
  assert.equal(await exists(path.join(created.runDir, 'agent-2-output/site-brief.md')), false);
});

test('desktop:agent2 preserves image design_reference in design-generation-input', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent2-asset-'));
  const inputPath = await makeInput(root);
  const assetDir = path.join(root, 'assets');
  await mkdir(assetDir);
  await writeFile(path.join(assetDir, 'reference.png'), 'fake image bytes');
  const created = await createDesktopRun({
    rootDir: root,
    siteId: 'wordcounter-desktop',
    inputPath,
    assetDir,
  });
  await runDesktopStage({ runDir: created.runDir });
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'spec-confirmation',
    reply: '确认 SPEC',
  });

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent2' });
  assert.equal(result.code, AGENT2_COMPLETE);

  const designInput = await readFile(path.join(created.runDir, 'agent-2-output/design-generation-input.md'), 'utf8');
  assert.match(designInput, /input-assets\/01-reference\.png/);
  assert.match(designInput, /design_reference/);
});

test('desktop:agent2 stays at agent2 when a gate fails', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent2-gate-fail-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });
  await runDesktopStage({ runDir: created.runDir });
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'spec-confirmation',
    reply: '确认 SPEC',
  });
  await mkdir(path.join(created.runDir, 'site/src/pages'), { recursive: true });
  await writeFile(path.join(created.runDir, 'site/src/pages/login.astro'), '<h1>Login</h1>');

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent2' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, AGENT2_COMPLIANCE_FAILED);
  assert.equal(state.stage, 'agent2');
  assert.equal(state.blocking_reason, 'page-plan');

  const pagePlanGate = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/page-plan.json'), 'utf8'));
  assert.equal(pagePlanGate.passed, false);
  const compliance = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent2-brief-compliance.json'), 'utf8'));
  assert.equal(compliance.passed, false);
  assert.equal(await exists(path.join(created.runDir, 'agent-2-5-output/design-generation-prompt.md')), false);
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
});

test('desktop:agent25 refuses before Agent2 completed', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-before-agent2-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent25' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, INVALID_DESKTOP_STAGE);
  assert.equal(state.stage, 'pre-agent2');
  assert.equal(await exists(path.join(created.runDir, 'agent-2-5-output/chat-delivery/options-board.png')), false);
});

test('desktop:agent25 refuses without design-generation-input', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-missing-input-'));
  const created = await makeAgent25ReadyRun(root);
  await rm(path.join(created.runDir, 'agent-2-output/design-generation-input.md'));

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent25' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, AGENT2_OUTPUT_MISSING);
  assert.equal(state.stage, 'agent25');
  assert.equal(state.blocking_reason, 'agent-2-output/design-generation-input.md');
});

test('desktop:agent25 refuses without passing Agent2 compliance', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-compliance-'));
  const created = await makeAgent25ReadyRun(root);
  await writeFile(
    path.join(created.runDir, 'gate-results/agent2-brief-compliance.json'),
    JSON.stringify({ gate: 'agent2-brief-compliance', status: 'fail', passed: false }, null, 2),
  );

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent25' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, AGENT2_COMPLIANCE_REQUIRED);
  assert.equal(state.stage, 'agent25');
  assert.equal(state.blocking_reason, 'agent2-brief-compliance');
});

test('desktop:agent25 invokes execute-agent25-design-options', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-invoke-'));
  const created = await makeAgent25ReadyRun(root, { withAssets: true });
  const calls = [];

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'agent25',
    executeAgent25DesignOptions: async (args) => {
      calls.push(args);
      await writeAgent25ExecutorFixture(args.runDir);
      return { status: 0, stdout: 'PASS Agent2.5 design-options executor' };
    },
  });

  assert.equal(result.code, AGENT25_COMPLETE);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].runDir, created.runDir);
  assert.equal(calls[0].promptPath, path.join(created.runDir, 'agent-2-output/design-generation-input.md'));
  assert.deepEqual(calls[0].argv, [
    'scripts/run/execute-agent25-design-options.mjs',
    '--run-dir',
    created.runDir,
    '--prompt',
    path.join(created.runDir, 'agent-2-output/design-generation-input.md'),
  ]);
});

test('desktop:agent25 executor failure keeps stage agent25 and records blocking_reason', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-executor-fail-'));
  const created = await makeAgent25ReadyRun(root);

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'agent25',
    executeAgent25DesignOptions: async () => ({
      status: 1,
      stdout: 'NO_APPROVED_UI_GENERATION_AVAILABLE\nChatGPT surface unavailable\n',
      stderr: '',
    }),
  });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, AGENT25_EXECUTOR_FAILED);
  assert.equal(state.stage, 'agent25');
  assert.equal(state.blocking_reason, 'NO_APPROVED_UI_GENERATION_AVAILABLE');
  assert.equal(await exists(path.join(created.runDir, 'agent-2-5-output/chat-delivery/options-board.png')), false);
});

test('desktop:agent25 successful executor writes option review, gates, and stops at ui-review', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-success-'));
  const created = await makeAgent25ReadyRun(root, { withAssets: true });

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'agent25',
    executeAgent25DesignOptions: async ({ runDir }) => {
      await writeAgent25ExecutorFixture(runDir);
      return { status: 0, stdout: 'PASS Agent2.5 design-options executor' };
    },
  });
  const state = await readDesktopState(created.runDir);
  const events = await readEvents(created.runDir);
  const review = events.find((event) => event.id === 'agent25-option-selection' && event.status === 'open');

  assert.equal(result.code, AGENT25_COMPLETE);
  assert.equal(state.stage, 'ui-review');
  assert.equal(state.last_completed_stage, 'agent25');
  assert.equal(state.next_action, 'review Agent2.5 options and run desktop:select-ui');
  assert.equal(state.blocking_reason, 'ui-option-selection');
  assert.ok(review);
  assert.equal(review.review_type, 'agent25_option_selection');
  assert.equal(review.blocking, true);
  assert.equal(review.blocks, 'agent-3');
  assert.match(review.message, /本地 UI A\/B\/C 选择/);
  assert.deepEqual(review.attachments, [
    {
      label: 'Agent2.5 options board',
      path: 'agent-2-5-output/chat-delivery/options-board.png',
      kind: 'image',
      required: true,
    },
  ]);

  for (const filePath of [
    'agent-2-5-output/external-design-evidence/action-receipt.json',
    'agent-2-5-output/external-design-evidence/conversation-screenshot.png',
    'agent-2-5-output/external-design-evidence/external-response.md',
    'agent-2-5-output/chat-delivery/options-board.png',
    'gate-results/agent25-option-images.json',
    'gate-results/agent25-external-design-proof.json',
  ]) {
    assert.equal(await exists(path.join(created.runDir, filePath)), true, `${filePath} should exist`);
  }

  const optionImages = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent25-option-images.json'), 'utf8'));
  assert.equal(optionImages.passed, true);
  const externalProof = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent25-external-design-proof.json'), 'utf8'));
  assert.equal(externalProof.passed, true);

  assert.deepEqual(await readdir(path.join(created.runDir, 'agent-3-output')), []);
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
});

test('desktop:select-ui refuses outside ui-review stage', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-select-outside-'));
  const created = await makeAgent25ReadyRun(root);

  const result = await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: 'A',
  });

  assert.equal(result.code, UI_REVIEW_REQUIRED);
  assert.equal((await readDesktopState(created.runDir)).stage, 'agent25');
});

test('desktop:select-ui rejects invalid option', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-select-invalid-'));
  const created = await makeUiReviewReadyRun(root);

  const result = await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: 'D',
  });

  assert.equal(result.code, INVALID_UI_OPTION);
  assert.equal((await readDesktopState(created.runDir)).stage, 'ui-review');
});

test('desktop:select-ui requires open UI option review', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-select-no-open-'));
  const created = await makeUiReviewReadyRun(root);
  const events = await readEvents(created.runDir);
  const withoutOpenUiReview = events.filter((event) => event.id !== 'agent25-option-selection');
  await writeFile(
    path.join(created.runDir, 'human-review-events.jsonl'),
    withoutOpenUiReview.map((event) => JSON.stringify(event)).join('\n') + '\n',
  );

  const result = await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: 'A',
  });

  assert.equal(result.code, UI_REVIEW_REQUIRED);
  assert.equal((await readDesktopState(created.runDir)).stage, 'ui-review');
});

test('desktop:select-ui requires Agent2.5 option board and action receipt', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-select-missing-output-'));
  const created = await makeUiReviewReadyRun(root);
  await rm(path.join(created.runDir, 'agent-2-5-output/chat-delivery/options-board.png'));

  const result = await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: 'A',
  });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, AGENT25_OUTPUT_MISSING);
  assert.deepEqual(result.missing, ['agent-2-5-output/chat-delivery/options-board.png']);
  assert.equal(state.stage, 'ui-review');
  assert.equal(state.blocking_reason, 'agent25-output-missing');
});

test('desktop:select-ui resolves review append-only, writes selected artifacts, and blocks on selected-assets readiness', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-agent25-select-ui-'));
  const created = await makeUiReviewReadyRun(root);

  const selected = await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: 'A',
    now: () => '2026-05-16T08:00:00.000Z',
  });
  const state = await readDesktopState(created.runDir);
  const events = await readEvents(created.runDir);
  const openEvents = events.filter((event) => event.id === 'agent25-option-selection' && event.status === 'open');
  const resolved = events.find((event) => event.id === 'agent25-option-selection' && event.status === 'resolved');
  const selectedOption = JSON.parse(await readFile(
    path.join(created.runDir, 'agent-2-5-output/selected-design/selected-option.json'),
    'utf8',
  ));
  const lineage = await readFile(
    path.join(created.runDir, 'agent-2-5-output/selected-design/selected-design-lineage.md'),
    'utf8',
  );

  assert.equal(selected.code, SELECTED_ASSETS_NOT_READY);
  assert.equal(selected.selected_option, 'A');
  assert.equal(selected.selected_design, 'Option A');
  assert.equal(state.stage, 'ui-review');
  assert.equal(state.last_completed_stage, 'agent25');
  assert.equal(state.next_action, 'complete selected-assets / lineage requirements before implement');
  assert.equal(state.blocking_reason, SELECTED_ASSETS_NOT_READY);

  assert.equal(openEvents.length, 1);
  assert.ok(resolved);
  assert.equal(resolved.review_type, 'agent25_option_selection');
  assert.equal(resolved.resolution_text, 'A');
  assert.equal(resolved.selected_option, 'A');
  assert.equal(resolved.selected_design, 'Option A');
  assert.equal(resolved.blocking, false);

  assert.deepEqual(selectedOption, {
    selected_option: 'A',
    selected_design: 'Option A',
    source_options_board: 'agent-2-5-output/chat-delivery/options-board.png',
    external_action_receipt: 'agent-2-5-output/external-design-evidence/action-receipt.json',
    selected_at: '2026-05-16T08:00:00.000Z',
    selection_source: 'desktop:select-ui',
  });
  assert.match(lineage, /User selected: Option A/);
  assert.match(lineage, /agent-2-5-output\/chat-delivery\/options-board\.png/);
  assert.match(lineage, /agent-2-5-output\/external-design-evidence\/action-receipt\.json/);
  assert.match(lineage, /not a Codex local self-signed design choice/);
  assert.match(lineage, /Agent3 and Agent4 must implement this selected option/);

  for (const filePath of [
    'gate-results/agent25-external-design-proof.json',
    'gate-results/agent25-option-images.json',
    'gate-results/agent25-lineage.json',
    'gate-results/selected-assets.json',
  ]) {
    assert.equal(await exists(path.join(created.runDir, filePath)), true, `${filePath} should exist`);
  }
  const externalProof = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent25-external-design-proof.json'), 'utf8'));
  const optionImages = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent25-option-images.json'), 'utf8'));
  const selectedAssets = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/selected-assets.json'), 'utf8'));
  assert.equal(externalProof.passed, true);
  assert.equal(optionImages.passed, true);
  assert.equal(selectedAssets.passed, false);

  assert.deepEqual(await readdir(path.join(created.runDir, 'agent-3-output')), []);
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
});

test('desktop:selected-assets refuses outside ui-review stage', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-selected-assets-stage-'));
  const created = await makeAgent25ReadyRun(root);

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'selected-assets' });

  assert.equal(result.code, UI_SELECTION_REQUIRED);
  assert.equal((await readDesktopState(created.runDir)).stage, 'agent25');
});

test('desktop:selected-assets refuses without selected option', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-selected-assets-no-option-'));
  const created = await makeUiReviewReadyRun(root);

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'selected-assets' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, SELECTED_OPTION_MISSING);
  assert.equal(state.stage, 'ui-review');
  assert.equal(state.blocking_reason, 'SELECTED_OPTION_MISSING');
});

test('desktop:selected-assets requires external action receipt', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-selected-assets-receipt-'));
  const created = await makeUiReviewReadyRun(root);
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: 'A',
  });
  await rm(path.join(created.runDir, 'agent-2-5-output/external-design-evidence/action-receipt.json'));

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'selected-assets' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, AGENT25_OUTPUT_MISSING);
  assert.deepEqual(result.missing, ['agent-2-5-output/external-design-evidence/action-receipt.json']);
  assert.equal(state.stage, 'ui-review');
  assert.equal(state.blocking_reason, 'agent25-output-missing');
});

test('desktop:selected-assets blocks when selected target evidence is incomplete', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-selected-assets-incomplete-'));
  const created = await makeUiReviewReadyRun(root);
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: 'A',
  });
  await rm(path.join(created.runDir, 'agent-2-5-output/selected-design/target/desktop.png'));
  await rm(path.join(created.runDir, 'agent-2-5-output/generated-designs/option-a/target/desktop.png'));

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'selected-assets' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, SELECTED_ASSETS_NOT_READY);
  assert.equal(state.stage, 'ui-review');
  assert.equal(state.blocking_reason, SELECTED_ASSETS_NOT_READY);
  assert.deepEqual(await readdir(path.join(created.runDir, 'agent-3-output')), []);
});

test('desktop:selected-assets writes selected package, runs gates, and advances to implement only after before-agent-3 passes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-selected-assets-success-'));
  const created = await makeUiReviewReadyRun(root, { selectedOptionId: 'option-a' });
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: 'A',
    now: () => '2026-05-16T08:00:00.000Z',
  });
  await writeBeforeAgent3DesktopPrereqs(created.runDir);

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'selected-assets',
    now: () => '2026-05-16T09:00:00.000Z',
    refreshReceipt: refreshReceiptForCurrentArtifacts,
  });
  const state = await readDesktopState(created.runDir);
  const manifest = JSON.parse(await readFile(
    path.join(created.runDir, 'agent-2-5-output/selected-assets/selected-assets-manifest.json'),
    'utf8',
  ));
  const sourceMap = JSON.parse(await readFile(
    path.join(created.runDir, 'agent-2-5-output/selected-assets/source-map.json'),
    'utf8',
  ));

  if (result.code !== SELECTED_ASSETS_COMPLETE) {
    assert.fail(`expected ${SELECTED_ASSETS_COMPLETE}, got ${result.code}: ${JSON.stringify(result.gateResult?.failures || result.gates || result, null, 2)}`);
  }
  assert.equal(state.stage, 'implement');
  assert.equal(state.last_completed_stage, 'selected-assets');
  assert.equal(state.next_action, 'run desktop:implement');
  assert.equal(state.blocking_reason, null);
  assert.equal(manifest.selected_option, 'A');
  assert.equal(manifest.selected_design, 'Option A');
  assert.equal(manifest.generated_by, 'desktop:selected-assets');
  assert.equal(manifest.external_action_receipt, 'agent-2-5-output/external-design-evidence/action-receipt.json');
  assert.equal(manifest.new_external_action_required, false);
  assert.equal(Boolean(manifest.artifact_hashes['agent-2-5-output/chat-delivery/options-board.png']), true);
  assert.equal(sourceMap.selected_option, 'A');
  assert.equal(sourceMap.external_action_receipt, 'agent-2-5-output/external-design-evidence/action-receipt.json');

  for (const filePath of [
    'agent-2-5-output/selected-assets/selected-design-package.md',
    'agent-2-5-output/selected-assets/selected-design-lineage.md',
    'agent-2-5-output/selected-assets/selected-target-desktop.png',
    'agent-2-5-output/selected-assets/selected-target-mobile.png',
    'agent-2-5-output/design-manifest.md',
    'agent-2-5-output/design-generation-report.md',
    'agent-2-5-output/asset-acquisition-report.md',
    'agent-2-5-output/selected-design/asset-manifest.json',
    'agent-2-5-output/selected-design/image-slots.md',
    'agent-2-5-output/selected-design/component-spec.md',
    'agent-2-5-output/selected-design/code/index.html',
    'agent-2-5-output/selected-design/code/style.css',
    'gate-results/agent25-lineage.json',
    'gate-results/selected-assets.json',
    'gate-results/toolsite-design-review.json',
    'gate-results/before-agent-3.json',
  ]) {
    assert.equal(await exists(path.join(created.runDir, filePath)), true, `${filePath} should exist`);
  }

  const selectedAssetsGate = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/selected-assets.json'), 'utf8'));
  const lineageGate = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent25-lineage.json'), 'utf8'));
  const beforeAgent3 = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/before-agent-3.json'), 'utf8'));
  assert.equal(selectedAssetsGate.passed, true);
  assert.equal(lineageGate.passed, true);
  assert.equal(beforeAgent3.passed, true);

  assert.deepEqual(await readdir(path.join(created.runDir, 'agent-3-output')), []);
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
});

test('desktop:selected-assets crops selected option target instead of copying the full options board', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-selected-assets-crop-board-'));
  const created = await makeUiReviewReadyRun(root, { selectedOptionId: 'option-b' });
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: 'B',
    now: () => '2026-05-16T08:00:00.000Z',
  });
  await replaceAgent25ImagesWithFullBoard(created.runDir);
  await writeBeforeAgent3DesktopPrereqs(created.runDir);

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'selected-assets',
    now: () => '2026-05-16T09:00:00.000Z',
    refreshReceipt: refreshReceiptForCurrentArtifacts,
  });
  if (result.code !== SELECTED_ASSETS_COMPLETE) {
    assert.fail(`expected ${SELECTED_ASSETS_COMPLETE}, got ${result.code}: ${JSON.stringify(result.gateResult?.failures || result.gates || result, null, 2)}`);
  }
  const boardSha = sha256(await readFile(path.join(created.runDir, 'agent-2-5-output/chat-delivery/options-board.png')));
  const desktopSha = sha256(await readFile(path.join(created.runDir, 'agent-2-5-output/selected-assets/selected-target-desktop.png')));
  const mobileSha = sha256(await readFile(path.join(created.runDir, 'agent-2-5-output/selected-assets/selected-target-mobile.png')));
  const sourceMap = JSON.parse(await readFile(path.join(created.runDir, 'agent-2-5-output/selected-assets/source-map.json'), 'utf8'));
  const selectedAssetsGate = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/selected-assets.json'), 'utf8'));

  assert.notEqual(desktopSha, boardSha);
  assert.notEqual(mobileSha, boardSha);
  assert.equal(sourceMap.selected_option, 'B');
  assert.equal(sourceMap.derivation.method, 'options-board-crop');
  assert.equal(sourceMap.derivation.selected_option, 'B');
  assert.deepEqual(sourceMap.output_targets, {
    desktop: 'agent-2-5-output/selected-assets/selected-target-desktop.png',
    mobile: 'agent-2-5-output/selected-assets/selected-target-mobile.png',
  });
  assert.equal(sourceMap.target_hashes['agent-2-5-output/selected-assets/selected-target-desktop.png'], desktopSha);
  assert.equal(sourceMap.target_hashes['agent-2-5-output/selected-assets/selected-target-mobile.png'], mobileSha);
  assert.equal(selectedAssetsGate.passed, true);
});

test('desktop:selected-assets blocks when before-agent-3 gates are not ready', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-selected-assets-before-agent3-'));
  const created = await makeUiReviewReadyRun(root);
  await continueDesktopRun({
    runDir: created.runDir,
    review: 'ui-option-selection',
    reply: 'A',
  });

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'selected-assets' });
  const state = await readDesktopState(created.runDir);
  const selectedAssetsGate = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/selected-assets.json'), 'utf8'));
  const lineageGate = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent25-lineage.json'), 'utf8'));

  assert.equal(result.code, SELECTED_ASSETS_GATE_FAILED);
  assert.equal(state.stage, 'ui-review');
  assert.equal(state.blocking_reason, SELECTED_ASSETS_GATE_FAILED);
  assert.equal(selectedAssetsGate.passed, true);
  assert.equal(lineageGate.passed, true);
  assert.deepEqual(await readdir(path.join(created.runDir, 'agent-3-output')), []);
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
});

test('desktop:implement refuses outside implement stage', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-implement-stage-'));
  const created = await makeUiReviewReadyRun(root);

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'implement' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, IMPLEMENT_STAGE_REQUIRED);
  assert.equal(result.stage, 'ui-review');
  assert.equal(state.stage, 'ui-review');
  assert.equal(await exists(path.join(created.runDir, 'site/package.json')), false);
});

test('desktop:implement refuses without selected-assets', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-implement-no-selected-assets-'));
  const created = await makeUiReviewReadyRun(root);
  await writeFile(
    path.join(created.runDir, 'desktop-run-state.json'),
    JSON.stringify(
      {
        mode: 'desktop',
        stage: 'implement',
        last_completed_stage: 'selected-assets',
        next_action: 'run desktop:implement',
        blocking_reason: null,
      },
      null,
      2,
    ),
  );

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'implement' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, SELECTED_ASSETS_MISSING);
  assert.equal(result.stage, 'implement');
  assert.match(result.missing.join('\n'), /selected-assets-manifest\.json/);
  assert.equal(state.stage, 'implement');
  assert.equal(state.blocking_reason, SELECTED_ASSETS_MISSING);
  assert.equal(await exists(path.join(created.runDir, 'agent-3-output/ui-direction.md')), false);
});

test('desktop:implement refuses when before-agent-3 gate fails', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-implement-before-agent3-'));
  const created = await makeImplementReadyRun(root);
  await rm(path.join(created.runDir, 'gate-results/web-access-preflight.json'));

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'implement',
    runSiteBuild: async () => {
      throw new Error('build should not run when before-agent-3 is blocked');
    },
  });
  const state = await readDesktopState(created.runDir);
  const beforeAgent3 = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/before-agent-3.json'), 'utf8'));

  assert.equal(result.code, AGENT3_GATE_BLOCKED);
  assert.equal(result.stage, 'implement');
  assert.equal(state.stage, 'implement');
  assert.equal(state.blocking_reason, AGENT3_GATE_BLOCKED);
  assert.equal(beforeAgent3.passed, false);
  assert.equal(await exists(path.join(created.runDir, 'site/package.json')), false);
});

test('desktop:implement creates Agent3, Agent4, and Astro site outputs, then advances to qa on build success', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-implement-success-'));
  const created = await makeImplementReadyRun(root, { selectedOptionId: 'option-b' });
  const buildCalls = [];

  const result = await runDesktopStage({
    runDir: created.runDir,
    now: () => '2026-05-16T10:00:00.000Z',
    runSiteBuild: async ({ siteDir }) => {
      buildCalls.push(siteDir);
      return { status: 0, command: 'npm run build', stdout: 'build ok', stderr: '' };
    },
  });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, IMPLEMENT_COMPLETE);
  assert.equal(result.stage, 'qa');
  assert.equal(state.stage, 'qa');
  assert.equal(state.last_completed_stage, 'implement');
  assert.equal(state.next_action, 'run desktop:qa');
  assert.equal(state.blocking_reason, null);
  assert.equal(buildCalls.length, 1);
  assert.equal(buildCalls[0], path.join(created.runDir, 'site'));

  for (const filePath of [
    'agent-3-output/ui-direction.md',
    'agent-3-output/implementation-handoff.md',
    'agent-3-output/selected-design-summary.md',
    'agent-3-output/visual-targets.md',
    'agent-4-output/implementation-report.md',
    'agent-4-output/changed-files.md',
    'agent-4-output/build-report.md',
    'site/package.json',
    'site/astro.config.mjs',
    'site/tsconfig.json',
    'site/src/pages/index.astro',
    'site/src/pages/privacy.astro',
    'site/src/pages/terms.astro',
    'site/src/pages/sitemap.xml.ts',
    'site/src/styles/global.css',
    'site/public/robots.txt',
  ]) {
    assert.equal(await exists(path.join(created.runDir, filePath)), true, `${filePath} should exist`);
  }

  const handoff = await readFile(path.join(created.runDir, 'agent-3-output/implementation-handoff.md'), 'utf8');
  assert.match(handoff, /Selected design: Option B/);
  assert.match(handoff, /Do not add backend, database, login, accounts, server APIs/);
  const visualTargets = await readFile(path.join(created.runDir, 'agent-3-output/visual-targets.md'), 'utf8');
  assert.match(visualTargets, /selected-target-desktop\.png/);
  assert.match(visualTargets, /selected-target-mobile\.png/);
  const index = await readFile(path.join(created.runDir, 'site/src/pages/index.astro'), 'utf8');
  assert.match(index, /data-tool-root/);
  assert.match(index, /Words/);
  assert.doesNotMatch(index, /Login|Dashboard|Pricing|API route/);
  const buildReport = await readFile(path.join(created.runDir, 'agent-4-output/build-report.md'), 'utf8');
  assert.match(buildReport, /Decision: PASS/);
  assert.match(buildReport, /build ok/);

  assert.equal(await exists(path.join(created.runDir, 'agent-5-output/qa-report.md')), false);
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
});

test('desktop:implement build failure keeps stage implement and records BUILD_FAILED', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-implement-build-fail-'));
  const created = await makeImplementReadyRun(root);

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'implement',
    runSiteBuild: async () => ({ status: 1, command: 'npm run build', stdout: '', stderr: 'Astro build failed' }),
  });
  const state = await readDesktopState(created.runDir);
  const buildReport = await readFile(path.join(created.runDir, 'agent-4-output/build-report.md'), 'utf8');

  assert.equal(result.code, BUILD_FAILED);
  assert.equal(result.stage, 'implement');
  assert.equal(state.stage, 'implement');
  assert.equal(state.blocking_reason, BUILD_FAILED);
  assert.match(buildReport, /Decision: FAIL/);
  assert.match(buildReport, /Astro build failed/);
  assert.equal(await exists(path.join(created.runDir, 'agent-5-output/qa-report.md')), false);
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
});

test('desktop:qa refuses outside qa stage', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-qa-stage-'));
  const created = await makeImplementReadyRun(root);

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'qa' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, QA_STAGE_REQUIRED);
  assert.equal(result.stage, 'implement');
  assert.equal(state.stage, 'implement');
  assert.equal(await exists(path.join(created.runDir, 'agent-5-output/qa-report.md')), false);
});

test('desktop:qa refuses without site directory', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-qa-no-site-'));
  const created = await makeQaReadyRun(root);
  await rm(path.join(created.runDir, 'site'), { recursive: true, force: true });

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'qa' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, SITE_MISSING);
  assert.equal(state.stage, 'qa');
  assert.equal(state.blocking_reason, SITE_MISSING);
});

test('desktop:qa runs build and QA gate sequence using mocks, then opens pre-deploy review', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-qa-success-'));
  const created = await makeQaReadyRun(root);
  const runQaGate = passingQaGateRunner();

  const result = await runDesktopStage({
    runDir: created.runDir,
    now: () => '2026-05-16T11:00:00.000Z',
    runQaGate,
  });
  const state = await readDesktopState(created.runDir);
  const events = await readEvents(created.runDir);
  const review = events.find((event) => event.review_type === 'pre_deploy_approval' && event.status === 'open');

  assert.equal(result.code, QA_COMPLETE);
  assert.equal(result.stage, 'deploy-review');
  assert.equal(state.stage, 'deploy-review');
  assert.equal(state.last_completed_stage, 'qa');
  assert.equal(state.blocking_reason, 'pre-deploy-approval');
  assert.ok(review);
  assert.equal(review.blocking, true);
  assert.equal(review.blocks, 'agent-6');

  assert.deepEqual(runQaGate.calls.map((call) => call.gate), [
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
    'final-qa-evidence',
    'gate-evidence-integrity',
    'before-agent-6',
  ]);

  for (const filePath of [
    'agent-5-output/qa-report.md',
    'agent-5-output/final-qa-report.md',
    'agent-5-output/launch-readiness.md',
    'agent-5-output/repair-log.md',
    'agent-5-output/gate-summary.json',
    'agent-5-output/chat-delivery/final-screenshot-delivery.md',
    'gate-results/site-build.json',
    'gate-results/page-plan.json',
    'gate-results/tool-spec.json',
    'gate-results/rendered-assets.json',
    'gate-results/final-visual-lock.json',
    'gate-results/final-visual-similarity.json',
    'gate-results/visual-restoration-similarity.json',
    'gate-results/final-qa-evidence.json',
    'gate-results/gate-evidence-integrity.json',
    'gate-results/before-agent-6.json',
  ]) {
    assert.equal(await exists(path.join(created.runDir, filePath)), true, `${filePath} should exist`);
  }

  const qaReport = await readFile(path.join(created.runDir, 'agent-5-output/qa-report.md'), 'utf8');
  assert.match(qaReport, /Decision: PASS/);
  const gateSummary = JSON.parse(await readFile(path.join(created.runDir, 'agent-5-output/gate-summary.json'), 'utf8'));
  assert.equal(gateSummary.qa_passed, true);
  assert.equal(gateSummary.deploy_approval_pending, true);
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
});

test('desktop:qa gate failure enters repair loop and reruns the gate', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-qa-repair-pass-'));
  const created = await makeQaReadyRun(root);
  const runQaGate = passingQaGateRunner({
    fail: {
      'tool-spec': ({ runDir, gate, attempt }) =>
        attempt === 0
          ? mockGateResult(runDir, gate, { passed: false, failures: ['missing restart behavior'] })
          : mockGateResult(runDir, gate),
    },
  });
  const repairs = [];

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'qa',
    runQaGate,
    repairQaGate: async ({ gate, attempt, failure }) => {
      repairs.push({ gate, attempt, failure });
      return { repaired: true, note: 'patched implementation' };
    },
  });

  assert.equal(result.code, QA_COMPLETE);
  assert.equal(repairs.length, 1);
  assert.equal(repairs[0].gate, 'tool-spec');
  assert.deepEqual(runQaGate.calls.filter((call) => call.gate === 'tool-spec').map((call) => call.attempt), [0, 1]);
  const repairLog = await readFile(path.join(created.runDir, 'agent-5-output/repair-log.md'), 'utf8');
  assert.match(repairLog, /tool-spec repair attempt 1/);
  assert.match(repairLog, /do not edit gate-results manually/);
});

test('desktop:qa repair loop retries up to limit and keeps stage qa', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-qa-repair-limit-'));
  const created = await makeQaReadyRun(root);
  const runQaGate = passingQaGateRunner({
    fail: {
      'rendered-assets': ({ runDir, gate }) => mockGateResult(runDir, gate, { passed: false, failures: ['missing rendered asset'] }),
    },
  });
  let repairCount = 0;

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'qa',
    runQaGate,
    repairQaGate: async () => {
      repairCount += 1;
      return { repaired: true };
    },
    maxQaRepairAttempts: 3,
  });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, QA_REPAIR_LIMIT_REACHED);
  assert.equal(result.failed_gate, 'rendered-assets');
  assert.equal(repairCount, 3);
  assert.equal(state.stage, 'qa');
  assert.equal(state.blocking_reason, QA_REPAIR_LIMIT_REACHED);
  assert.equal(state.repair_attempts['rendered-assets'], 3);
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
});

test('desktop:qa repair loop does not let repair task hand-edit gate results', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-qa-repair-no-manual-gate-'));
  const created = await makeQaReadyRun(root);
  const runQaGate = passingQaGateRunner({
    fail: {
      'page-plan': ({ runDir, gate, attempt }) =>
        attempt === 0
          ? mockGateResult(runDir, gate, { passed: false, failures: ['missing /privacy'] })
          : mockGateResult(runDir, gate),
    },
  });

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'qa',
    runQaGate,
    repairQaGate: async ({ runDir }) => {
      assert.equal(await exists(path.join(runDir, 'gate-results/page-plan.json')), true);
      return { repaired: true, changed_files: ['site/src/pages/privacy.astro'] };
    },
  });
  const pagePlan = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/page-plan.json'), 'utf8'));
  const repairLog = await readFile(path.join(created.runDir, 'agent-5-output/repair-log.md'), 'utf8');

  assert.equal(result.code, QA_COMPLETE);
  assert.equal(pagePlan.passed, true);
  assert.match(repairLog, /Repair real artifacts for page-plan/);
  assert.match(repairLog, /do not edit gate-results manually/);
});

test('desktop deploy refuses without pre_deploy_approval', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-no-approval-'));
  const created = await makeDeployReviewReadyRun(root, { approve: false });

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'deploy' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, DEPLOY_APPROVAL_REQUIRED);
  assert.equal(state.stage, 'deploy-review');
  assert.equal(state.blocking_reason, 'pre-deploy-approval');
  assert.deepEqual(await readdir(path.join(created.runDir, 'deployment-output')), []);
});

test('desktop:deploy refuses outside deploy-review stage', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-stage-'));
  const created = await makeQaReadyRun(root);

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'deploy' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, DEPLOY_REVIEW_REQUIRED);
  assert.equal(result.stage, 'qa');
  assert.equal(state.stage, 'qa');
});

test('desktop:deploy refuses if approval text is not 确认部署', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-bad-approval-'));
  const created = await makeDeployReviewReadyRun(root, { approve: false });
  await writeFile(
    path.join(created.runDir, 'human-review-events.jsonl'),
    `${JSON.stringify({
      schema_version: 'human-review-event.v1',
      type: 'human_review',
      review_type: 'pre_deploy_approval',
      id: 'pre-deploy-approval',
      status: 'resolved',
      blocking: false,
      blocks: 'agent-6',
      resolution_text: '批准上线',
      created_at: '2026-05-16T12:00:00.000Z',
    })}\n`,
    { flag: 'a' },
  );

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'deploy' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, INVALID_DEPLOY_APPROVAL);
  assert.equal(state.stage, 'deploy-review');
  assert.equal(state.blocking_reason, INVALID_DEPLOY_APPROVAL);
});

test('desktop:deploy refuses smoke and non-production runs', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-smoke-'));
  const created = await makeDeployReviewReadyRun(root);
  await writeFile(
    path.join(created.runDir, 'run-meta.json'),
    JSON.stringify({ mode: 'desktop', run_type: 'smoke', deployable: false }, null, 2),
  );

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'deploy' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, NOT_PRODUCTION_RUN);
  assert.equal(state.stage, 'deploy-review');
  assert.equal(state.blocking_reason, NOT_PRODUCTION_RUN);
});

test('desktop:deploy refuses deployable=false', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-not-deployable-'));
  const created = await makeDeployReviewReadyRun(root);
  const meta = JSON.parse(await readFile(path.join(created.runDir, 'run-meta.json'), 'utf8'));
  await writeFile(
    path.join(created.runDir, 'run-meta.json'),
    JSON.stringify({ ...meta, deployable: false }, null, 2),
  );

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'deploy' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, RUN_NOT_DEPLOYABLE);
  assert.equal(state.blocking_reason, RUN_NOT_DEPLOYABLE);
});

test('desktop:deploy refuses when QA evidence is not passed', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-qa-fail-'));
  const created = await makeDeployReviewReadyRun(root);
  await writeFile(
    path.join(created.runDir, 'gate-results/final-qa-evidence.json'),
    JSON.stringify({ gate: 'final-qa-evidence', status: 'fail', passed: false, failures: ['missing final evidence'] }, null, 2),
  );

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'deploy' });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, QA_NOT_PASSED);
  assert.equal(state.blocking_reason, QA_NOT_PASSED);
});

test('desktop:deploy refuses when gate evidence integrity fails', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-integrity-fail-'));
  const created = await makeDeployReviewReadyRun(root);

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'deploy',
    runDeployGateEvidenceIntegrity: async () => ({ passed: false, failures: ['stale gate result'] }),
  });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, GATE_EVIDENCE_INTEGRITY_REQUIRED);
  assert.equal(state.blocking_reason, GATE_EVIDENCE_INTEGRITY_REQUIRED);
});

test('desktop:deploy refuses when check-gates before agent-6 fails', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-before-agent6-fail-'));
  const created = await makeDeployReviewReadyRun(root);

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'deploy',
    runDeployGateEvidenceIntegrity: async () => ({ passed: true, failures: [] }),
    runDeployBeforeAgent6Gate: async () => ({ allowed: false, missing: ['agent-5-output/qa-report.md'] }),
  });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, AGENT6_GATE_BLOCKED);
  assert.equal(state.blocking_reason, AGENT6_GATE_BLOCKED);
});

test('desktop:deploy returns NEEDS_CLOUDFLARE_CREDENTIALS when Cloudflare creds are missing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-no-cf-'));
  const created = await makeDeployReviewReadyRun(root);

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'deploy',
    env: {},
    runDeployGateEvidenceIntegrity: async () => ({ passed: true, failures: [] }),
    runDeployBeforeAgent6Gate: async ({ runDir }) => passingDeployGate(runDir),
  });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, NEEDS_CLOUDFLARE_CREDENTIALS);
  assert.equal(state.blocking_reason, NEEDS_CLOUDFLARE_CREDENTIALS);
});

test('desktop:deploy returns NEEDS_SEARCH_CONSOLE_CREDENTIALS when GSC creds are missing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-no-gsc-'));
  const created = await makeDeployReviewReadyRun(root);

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'deploy',
    env: {
      CLOUDFLARE_API_TOKEN: 'cf-token',
      CLOUDFLARE_ACCOUNT_ID: 'cf-account',
      BING_WEBMASTER_API_KEY: 'bing-key',
    },
    runDeployGateEvidenceIntegrity: async () => ({ passed: true, failures: [] }),
    runDeployBeforeAgent6Gate: async ({ runDir }) => passingDeployGate(runDir),
  });

  assert.equal(result.code, NEEDS_SEARCH_CONSOLE_CREDENTIALS);
});

test('desktop:deploy returns NEEDS_BING_CREDENTIALS when Bing creds are missing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-no-bing-'));
  const created = await makeDeployReviewReadyRun(root);

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'deploy',
    env: {
      CLOUDFLARE_API_TOKEN: 'cf-token',
      CLOUDFLARE_ACCOUNT_ID: 'cf-account',
      GOOGLE_SEARCH_CONSOLE_CREDENTIALS: '/tmp/gsc.json',
    },
    runDeployGateEvidenceIntegrity: async () => ({ passed: true, failures: [] }),
    runDeployBeforeAgent6Gate: async ({ runDir }) => passingDeployGate(runDir),
  });

  assert.equal(result.code, NEEDS_BING_CREDENTIALS);
});

test('desktop:deploy returns NO_DEPLOY_RUNNER_CONFIGURED when no real deploy runner is configured', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-no-runner-'));
  const created = await makeDeployReviewReadyRun(root);

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'deploy',
    env: DEPLOY_ENV,
    runDeployGateEvidenceIntegrity: async () => ({ passed: true, failures: [] }),
    runDeployBeforeAgent6Gate: async ({ runDir }) => passingDeployGate(runDir),
  });
  const state = await readDesktopState(created.runDir);
  const log = await readFile(path.join(created.runDir, 'deployment-output/deployment-log.md'), 'utf8');

  assert.equal(result.code, NO_DEPLOY_RUNNER_CONFIGURED);
  assert.equal(state.stage, 'deploy-review');
  assert.equal(state.blocking_reason, NO_DEPLOY_RUNNER_CONFIGURED);
  assert.match(log, /No real Cloudflare Pages deployment runner is configured/);
});

test('desktop:deploy writes deployment-output and advances to done on mocked success path', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-success-'));
  const created = await makeDeployReviewReadyRun(root);
  const calls = [];

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'deploy',
    env: DEPLOY_ENV,
    runDeployGateEvidenceIntegrity: async () => ({ passed: true, failures: [] }),
    runDeployBeforeAgent6Gate: async ({ runDir }) => passingDeployGate(runDir),
    deployCloudflarePages: mockCloudflareDeploy(calls),
    submitSearchConsole: mockSearchConsoleSubmit(calls),
    submitBingWebmaster: mockBingSubmit(calls),
    now: () => '2026-05-16T12:00:00.000Z',
  });
  const state = await readDesktopState(created.runDir);

  assert.equal(result.code, DEPLOY_COMPLETE);
  assert.equal(result.stage, 'done');
  assert.equal(state.stage, 'done');
  assert.equal(state.last_completed_stage, 'deploy');
  assert.deepEqual(calls.map((call) => call.service), ['cloudflare', 'gsc', 'bing']);

  for (const filePath of [
    'deployment-output/deployment-report.md',
    'deployment-output/cloudflare-pages.json',
    'deployment-output/launch-status.json',
    'deployment-output/indexing-status.json',
    'deployment-output/deployment-log.md',
    'agent-6-output/launch-report.md',
    'gate-results/agent6-completion.json',
  ]) {
    assert.equal(await exists(path.join(created.runDir, filePath)), true, `${filePath} should exist`);
  }

  const agent6 = JSON.parse(await readFile(path.join(created.runDir, 'gate-results/agent6-completion.json'), 'utf8'));
  assert.equal(agent6.passed, true);
  const launchStatus = JSON.parse(await readFile(path.join(created.runDir, 'deployment-output/launch-status.json'), 'utf8'));
  assert.equal(launchStatus.final_status, 'full_launch_completed');
});

test('desktop:deploy keeps deploy-review and records DEPLOY_FAILED when Cloudflare deploy fails', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-deploy-failed-'));
  const created = await makeDeployReviewReadyRun(root);

  const result = await runDesktopStage({
    runDir: created.runDir,
    stage: 'deploy',
    env: DEPLOY_ENV,
    runDeployGateEvidenceIntegrity: async () => ({ passed: true, failures: [] }),
    runDeployBeforeAgent6Gate: async ({ runDir }) => passingDeployGate(runDir),
    deployCloudflarePages: async () => ({ ok: false, error: 'mock Cloudflare failure' }),
  });
  const state = await readDesktopState(created.runDir);
  const log = await readFile(path.join(created.runDir, 'deployment-output/deployment-log.md'), 'utf8');

  assert.equal(result.code, DEPLOY_FAILED);
  assert.equal(state.stage, 'deploy-review');
  assert.equal(state.blocking_reason, DEPLOY_FAILED);
  assert.match(log, /mock Cloudflare failure/);
});

test('missing stage runner returns NO_STAGE_RUNNER_CONFIGURED', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-missing-runner-'));
  const inputPath = await makeInput(root);
  const created = await createDesktopRun({ rootDir: root, siteId: 'wordcounter-desktop', inputPath });

  const result = await runDesktopStage({ runDir: created.runDir, stage: 'agent6' });

  assert.equal(result.code, NO_STAGE_RUNNER_CONFIGURED);
  assert.equal(result.stage, 'agent6');
});

test('desktop flow scripts use only local desktop review state', async () => {
  const files = [
    'scripts/desktop/create-run.mjs',
    'scripts/desktop/run.mjs',
    'scripts/desktop/continue.mjs',
    'scripts/desktop/gate-repair-loop.mjs',
  ];
  const combined = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  const retiredLogPattern = new RegExp(`${['toolsite', 'in' + 'box'].join('-')}|send[A-Z][A-Za-z]*Message|Telegram|Hermes|remote|${'work' + 'er'}`, 'i');
  assert.doesNotMatch(combined, retiredLogPattern);
});
