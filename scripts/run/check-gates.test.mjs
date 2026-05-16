import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkRunGates, reportHasPassDecision, SMOKE_RUN_BLOCK_MESSAGE } from './check-gates.mjs';

async function makeRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'gate-check-'));
  const runDir = path.join(root, 'runs', 'sample-site');
  await mkdir(runDir, { recursive: true });
  await writeFile(
    path.join(runDir, 'state.json'),
    JSON.stringify(
      {
        site_id: 'sample-site',
        domain: 'example.com',
        approved_for_production: false,
        agent_outputs: {
          agent_1: 'agent-1-output/keyword-research-report.md',
          agent_2: 'agent-2-output/site-brief.md',
          agent_2_5: null,
          agent_3: null,
          agent_4: null,
          agent_5: null,
          agent_6: null,
        },
        qa: { passed: false, report: null },
      },
      null,
      2,
    ),
  );
  return runDir;
}

async function writeAgent2Outputs(runDir, { compliance = true, compliancePassed = true, complianceStatus } = {}) {
  const dir = path.join(runDir, 'agent-2-output');
  await mkdir(dir, { recursive: true });
  for (const file of [
    'site-brief.md',
    'tool-spec.md',
    'content-plan.md',
    'seo-plan.md',
    'ui-reference-dossier.md',
    'design-generation-input.md',
  ]) {
    await writeFile(path.join(dir, file), `# ${file}\n`);
  }
  await writeFile(
    path.join(dir, 'page-plan.md'),
    [
      '# Page Plan',
      '',
      '| page | type | status | reason | implementation owner |',
      '| --- | --- | --- | --- | --- |',
      '| / | tool | required | Primary tool route. | Agent4 |',
      '| /privacy | legal | required | Required privacy page. | Agent4 |',
      '| /terms | legal | required | Required terms page. | Agent4 |',
      '| /sitemap.xml | system | required | Required sitemap. | Agent4 |',
      '| /robots.txt | system | required | Required robots policy. | Agent4 |',
    ].join('\n'),
  );
  await writeGateResult(runDir, 'page-plan.json');
  if (compliance) {
    await writeFile(
      path.join(dir, 'brief-compliance-summary.md'),
      '# Agent2 Brief Compliance Summary\n\n6. 是否可以进入 Agent2.5：是\n',
    );
    await writeGateResult(runDir, 'agent2-brief-compliance.json', {
      passed: compliancePassed,
      status: complianceStatus || (compliancePassed ? 'pass' : 'fail'),
    });
  }
}

async function writeWebAccessGate(runDir, { passed = true } = {}) {
  const dir = path.join(runDir, 'gate-results');
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'web-access-preflight.json'),
    JSON.stringify(
      {
        gate: 'web-access-preflight',
        runDir,
        status: passed ? 'pass' : 'fail',
        passed,
        failures: passed ? [] : ['missing web-access/SKILL.md'],
        details: {},
        evidence: {},
        generatedAt: '2026-05-08T00:00:00.000Z',
      },
      null,
      2,
    ),
  );
}

async function writeGateResult(runDir, filename, { passed = true, status = passed ? 'pass' : 'fail' } = {}) {
  const dir = path.join(runDir, 'gate-results');
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, filename),
    JSON.stringify(
      {
        gate: filename.replace(/\.json$/, ''),
        runDir,
        status,
        passed,
        failures: passed ? [] : [`${filename} failed`],
        details: {},
        evidence: {},
        generatedAt: '2026-05-08T00:00:00.000Z',
      },
      null,
      2,
    ),
  );
}

async function writeRunMeta(runDir, meta) {
  await writeFile(path.join(runDir, 'run-meta.json'), JSON.stringify(meta, null, 2));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function writeRunFile(runDir, relPath, content) {
  const absolutePath = path.join(runDir, relPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
  return {
    relPath,
    content,
    sha256: sha256(content),
    size: Buffer.byteLength(content),
  };
}

async function writeAgent25Outputs(
  runDir,
  {
    externalEvidence = false,
    optionImagesGate = true,
    targetDomain = 'example.com',
    keyword = 'sample tool',
    promptShaOverride = null,
    evidenceTargetDomain = null,
    omitReceiptArtifacts = false,
  } = {},
) {
  const root = path.join(runDir, 'agent-2-5-output');
  const selected = path.join(root, 'selected-design');
  await mkdir(path.join(selected, 'target'), { recursive: true });
  for (const file of [
    'design-generation-prompt.md',
    'design-manifest.md',
    'design-generation-report.md',
    'asset-acquisition-report.md',
  ]) {
    await writeFile(path.join(root, file), `# ${file}\n`);
  }
  for (const file of [
    'design-tokens.md',
    'component-spec.md',
    'asset-plan.md',
    'image-slots.md',
    'usability-contract.md',
    'asset-quality-contract.md',
    'interaction-state-model.md',
    'dynamic-data-fit.md',
    'ux-self-audit.md',
    'restoration-rules.md',
    'forbidden-deviations.md',
    'selection-rationale.md',
  ]) {
    await mkdir(path.dirname(path.join(selected, file)), { recursive: true });
    await writeFile(path.join(selected, file), `# ${file}\n`);
  }
  const image = 'x'.repeat(10_001);
  const selectedDesktop = await writeRunFile(runDir, 'agent-2-5-output/selected-design/target/desktop.png', image);
  const selectedMobile = await writeRunFile(runDir, 'agent-2-5-output/selected-design/target/mobile.png', image);
  const optionA = await writeRunFile(runDir, 'agent-2-5-output/generated-designs/option-a/target/desktop.png', image);
  const optionB = await writeRunFile(runDir, 'agent-2-5-output/generated-designs/option-b/target/desktop.png', image);
  const optionC = await writeRunFile(runDir, 'agent-2-5-output/generated-designs/option-c/target/desktop.png', image);
  await mkdir(path.join(root, 'chat-delivery'), { recursive: true });
  const optionsBoard = await writeRunFile(runDir, 'agent-2-5-output/chat-delivery/options-board.png', image);
  await writeFile(
    path.join(root, 'chat-delivery/option-selection.md'),
    [
      '# Option Selection',
      '',
      'Decision: PASS',
      'Option A, Option B, and Option C were sent to chat.',
      'Selected by user after review.',
    ].join('\n'),
  );
  await writeGateResult(runDir, 'agent25-lineage.json');
  if (optionImagesGate) await writeGateResult(runDir, 'agent25-option-images.json');
  await writeGateResult(runDir, 'selected-assets.json');
  if (externalEvidence) {
    const evidence = path.join(root, 'external-design-evidence');
    await mkdir(evidence, { recursive: true });
    const receiptIdentity = evidenceTargetDomain || targetDomain;
    const submittedPrompt = [
      'Agent2.5 design-options external execution request.',
      '',
      'User prompt:',
      `# ${keyword} Design Generation Input`,
      '',
      `Keyword: ${keyword}`,
      `Target Domain: ${targetDomain}`,
    ].join('\n');
    const prompt = await writeRunFile(runDir, 'agent-2-5-output/external-design-evidence/submitted-prompt.md', submittedPrompt);
    const externalResponse = await writeRunFile(
      runDir,
      'agent-2-5-output/external-design-evidence/external-response.md',
      [
        '# Raw external response',
        '',
        '## Submitted Prompt',
        '',
        submittedPrompt,
        '',
        '## Captured Conversation Text',
        '',
        `Generate design directions for ${receiptIdentity}.`,
        '',
        'Option A - Benchmark Console includes design target and design tokens.',
        'Option B - Accessible calculator direction includes design target and design tokens.',
        'Option C - Warm public-service direction includes design target and design tokens.',
      ].join('\n'),
    );
    const screenshot = await writeRunFile(runDir, 'agent-2-5-output/external-design-evidence/conversation-screenshot.png', image);
    const generatedImage = await writeRunFile(
      runDir,
      'agent-2-5-output/external-design-evidence/downloads/generated-image-1.png',
      image,
    );
    await writeFile(
      path.join(evidence, 'source-provenance.md'),
      [
        '# Source provenance',
        '',
        'Decision: PASS',
        `Option A maps to GPT external source ${optionA.relPath} sha ${optionA.sha256}.`,
        `Option B maps to GPT external source ${optionB.relPath} sha ${optionB.sha256}.`,
        `Option C maps to GPT external source ${optionC.relPath} sha ${optionC.sha256}.`,
        'Selected option: Option A from GPT approved external generated image evidence.',
        `Desktop target: ${selectedDesktop.relPath}.`,
        `Mobile target: ${selectedMobile.relPath}.`,
      ].join('\n'),
    );
    await writeFile(
      path.join(evidence, 'selected-design-lineage.md'),
      '# Selected design lineage\n\nDecision: PASS\n\nOption A came from GPT approved external option evidence.\n',
    );
    const artifactHashes = omitReceiptArtifacts
      ? {}
      : {
          [externalResponse.relPath]: externalResponse.sha256,
          [screenshot.relPath]: screenshot.sha256,
          [generatedImage.relPath]: generatedImage.sha256,
          [optionA.relPath]: optionA.sha256,
          [optionB.relPath]: optionB.sha256,
          [optionC.relPath]: optionC.sha256,
          [optionsBoard.relPath]: optionsBoard.sha256,
          [selectedDesktop.relPath]: selectedDesktop.sha256,
          [selectedMobile.relPath]: selectedMobile.sha256,
        };
    await writeFile(
      path.join(evidence, 'action-receipt.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          action: 'design-options',
          run_dir: path.relative(process.cwd(), runDir).replace(/\\/g, '/'),
          started_at: '2026-05-08T00:00:00.000Z',
          completed_at: '2026-05-08T00:00:05.000Z',
          tool: { name: 'web-access', command: 'web-access/scripts/check-deps.sh' },
          prompt_path: prompt.relPath,
          prompt_sha256: promptShaOverride || prompt.sha256,
          uploaded_assets: [],
          screenshots: omitReceiptArtifacts ? [] : [{ path: screenshot.relPath, sha256: screenshot.sha256, size: screenshot.size }],
          raw_response: omitReceiptArtifacts ? null : { path: externalResponse.relPath, sha256: externalResponse.sha256, size: externalResponse.size },
          downloads: omitReceiptArtifacts ? [] : [{ path: generatedImage.relPath, sha256: generatedImage.sha256, size: generatedImage.size }],
          artifact_hashes: artifactHashes,
          status: 'pass',
          error: null,
          runner_version: 'agent25-external-action-evidence/1',
        },
        null,
        2,
      ),
    );
    await writeFile(
      path.join(evidence, 'external-design-proof.json'),
      JSON.stringify(
        {
          mode: 'production',
          approvedDesignSurface: 'ChatGPT approved design surface',
          externalResponse: { path: 'agent-2-5-output/external-design-evidence/external-response.md', kind: 'raw exported model response' },
          conversationScreenshot: { path: 'agent-2-5-output/external-design-evidence/conversation-screenshot.png', surface: 'ChatGPT web UI' },
          selection: { selectedOption: 'option-a', source: 'current-chat-user' },
        },
        null,
        2,
      ),
    );
    await writeGateResult(runDir, 'agent25-external-design-proof.json');
  }
}

async function writeDesignPackageGateOutputs(runDir) {
  await mkdir(path.join(runDir, 'agent-5-output'), { recursive: true });
  await writeFile(
    path.join(runDir, 'agent-5-output/design-package-gate-report.md'),
    '# Design Package Gate Report\n\nDecision: PASS\n',
  );
  await writeGateResult(runDir, 'toolsite-design-review.json');
}

async function writeAgent3Outputs(runDir) {
  const root = path.join(runDir, 'agent-3-output');
  await mkdir(path.join(root, 'final-screenshots'), { recursive: true });
  await writeFile(path.join(root, 'final-screenshots/desktop.png'), 'png');
  await writeFile(path.join(root, 'final-screenshots/mobile.png'), 'png');
  await writeFile(path.join(root, 'visual-diff-report.md'), '# Visual diff\n');
  await writeFile(path.join(root, 'visual-match-score.md'), 'Desktop: 95 / 100\nMobile: 95 / 100\nOverall: 95 / 100\n');
  await writeFile(path.join(root, 'visual-lock.md'), '# Visual lock\nDecision: PASS\n');
  await writeFile(path.join(root, 'implementation-handoff.md'), '# Handoff\n');
  await writeFile(
    path.join(runDir, 'agent-5-output/visual-restoration-gate-report.md'),
    '# Visual Restoration Gate Report\n\nDecision: PASS\n',
  );
}

test('allows Agent 2.5 when Agent 1 is waived and Agent 2 outputs exist', async () => {
  const runDir = await makeRun();
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    [
      '# Gate Ledger - sample-site',
      '',
      '- [waived] Agent 1 Keyword Research - User supplied keyword directly.',
      '- [passed] Agent 2 Site Brief - Required files are present.',
    ].join('\n'),
  );

  const result = await checkRunGates({ runDir, before: 'agent-2.5' });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.missing, []);
});

test('blocks Agent 2.5 when repo-local web-access preflight has not passed', async () => {
  const runDir = await makeRun();
  await writeAgent2Outputs(runDir);
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    [
      '# Gate Ledger - sample-site',
      '',
      '- [waived] Agent 1 Keyword Research - User supplied keyword directly.',
      '- [passed] Agent 2 Site Brief - Required files are present.',
    ].join('\n'),
  );

  const result = await checkRunGates({ runDir, before: 'agent-2.5' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /web-access-preflight\.json/);
  assert.equal(result.allowedNextStep, 'Run repo-local web-access preflight gate');
});

test('blocks Agent 2.5 when Agent 2 page plan gate has not passed', async () => {
  const runDir = await makeRun();
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeGateResult(runDir, 'page-plan.json', { passed: false });
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    [
      '# Gate Ledger - sample-site',
      '',
      '- [waived] Agent 1 Keyword Research - User supplied keyword directly.',
      '- [passed] Agent 2 Site Brief - Required files are present.',
    ].join('\n'),
  );

  const result = await checkRunGates({ runDir, before: 'agent-2.5' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /page-plan\.json/);
  assert.equal(result.allowedNextStep, 'Run Agent 2 Site Brief');
});

test('blocks Agent 2.5 when Agent 2 brief compliance gate is missing', async () => {
  const runDir = await makeRun();
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir, { compliance: false });
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    [
      '# Gate Ledger - sample-site',
      '',
      '- [waived] Agent 1 Keyword Research - User supplied keyword directly.',
      '- [passed] Agent 2 Site Brief - Required files are present.',
    ].join('\n'),
  );

  const result = await checkRunGates({ runDir, before: 'agent-2.5' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /brief-compliance-summary\.md/);
  assert.match(result.missing.join('\n'), /agent2-brief-compliance\.json/);
  assert.equal(result.allowedNextStep, 'Run Agent 2 Site Brief');
});

test('blocks Agent 2.5 when Agent 2 brief compliance gate is failed or uncertain', async () => {
  for (const status of ['fail', 'uncertain']) {
    const runDir = await makeRun();
    await writeWebAccessGate(runDir);
    await writeAgent2Outputs(runDir, { compliancePassed: false, complianceStatus: status });
    await writeFile(
      path.join(runDir, 'gate-ledger.md'),
      [
        '# Gate Ledger - sample-site',
        '',
        '- [waived] Agent 1 Keyword Research - User supplied keyword directly.',
        '- [passed] Agent 2 Site Brief - Required files are present.',
      ].join('\n'),
    );

    const result = await checkRunGates({ runDir, before: 'agent-2.5' });
    assert.equal(result.allowed, false);
    assert.match(result.missing.join('\n'), /agent2-brief-compliance\.json/);
    assert.equal(result.allowedNextStep, 'Run Agent 2 Site Brief');
  }
});

test('blocks Agent 4 when selected design and visual gate artifacts are missing', async () => {
  const runDir = await makeRun();
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-4' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /agent-2-5-output\/selected-design\/target\/desktop\.png/);
  assert.match(result.missing.join('\n'), /agent-5-output\/visual-restoration-gate-report\.md/);
  assert.equal(result.allowedNextStep, 'Run Agent 2.5 UI Design Generation');
});

test('blocks Agent 3 when Agent 2.5 lacks external GPT provenance evidence', async () => {
  const runDir = await makeRun();
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, { externalEvidence: false });
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-3' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /external-design-evidence\/external-response\.md/);
  assert.match(result.missing.join('\n'), /external-design-evidence\/conversation-screenshot\.png/);
  assert.match(result.missing.join('\n'), /external-design-evidence\/source-provenance\.md/);
  assert.match(result.missing.join('\n'), /external-design-evidence\/selected-design-lineage\.md/);
  assert.equal(result.allowedNextStep, 'Run Agent 2.5 UI Design Generation');
});

test('blocks Agent 3 when Agent 2.5 option image gate is missing', async () => {
  const runDir = await makeRun();
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, { externalEvidence: true, optionImagesGate: false });
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-3' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /agent25-option-images\.json/);
  assert.equal(result.allowedNextStep, 'Run Agent 2.5 UI Design Generation');
});

test('allows Agent 3 for current run target domain without typing-test hardcoding', async () => {
  const runDir = await makeRun();
  await writeRunMeta(runDir, {
    run_type: 'production',
    deployable: true,
    mode: 'desktop',
    target_domain: '401k-calculator.net',
    keyword: '401k calculator',
  });
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, {
    externalEvidence: true,
    targetDomain: '401k-calculator.net',
    keyword: '401k calculator',
  });
  await writeDesignPackageGateOutputs(runDir);
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-3' });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.missing, []);
  assert.doesNotMatch(JSON.stringify(result), /typing-test-online\.com/);
});

test('allows Agent 3 when external response uses Submitted Prompt and prompt hash linkage', async () => {
  const runDir = await makeRun();
  await writeRunMeta(runDir, {
    target_domain: '401k-calculator.net',
    keyword: '401k calculator',
  });
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, {
    externalEvidence: true,
    targetDomain: '401k-calculator.net',
    keyword: '401k calculator',
  });
  await writeDesignPackageGateOutputs(runDir);
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-3' });
  assert.equal(result.allowed, true);
});

test('blocks Agent 3 when prompt echo lacks receipt screenshot image artifacts', async () => {
  const runDir = await makeRun();
  await writeRunMeta(runDir, {
    target_domain: '401k-calculator.net',
    keyword: '401k calculator',
  });
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, {
    externalEvidence: true,
    targetDomain: '401k-calculator.net',
    keyword: '401k calculator',
    omitReceiptArtifacts: true,
  });
  await writeDesignPackageGateOutputs(runDir);
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-3' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /action-receipt downloads include generated design image/);
  assert.match(result.missing.join('\n'), /action-receipt screenshots include/);
  assert.match(result.missing.join('\n'), /action-receipt artifact_hashes/);
});

test('blocks Agent 3 when action receipt prompt sha does not match submitted prompt', async () => {
  const runDir = await makeRun();
  await writeRunMeta(runDir, {
    target_domain: '401k-calculator.net',
    keyword: '401k calculator',
  });
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, {
    externalEvidence: true,
    targetDomain: '401k-calculator.net',
    keyword: '401k calculator',
    promptShaOverride: '0'.repeat(64),
  });
  await writeDesignPackageGateOutputs(runDir);
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-3' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /prompt_sha256 sha256 matches/);
});

test('blocks Agent 3 when evidence target does not match current run target', async () => {
  const runDir = await makeRun();
  await writeRunMeta(runDir, {
    target_domain: '401k-calculator.net',
    keyword: '401k calculator',
  });
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, {
    externalEvidence: true,
    targetDomain: 'unrelated-example.net',
    keyword: '401k calculator',
  });
  await writeDesignPackageGateOutputs(runDir);
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-3' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /matches current run target domain or keyword/);
});

test('keeps existing typing-test run-specific evidence passing', async () => {
  const runDir = await makeRun();
  await writeRunMeta(runDir, {
    target_domain: 'typing-test-online.com',
    keyword: 'typing test online',
  });
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, {
    externalEvidence: true,
    targetDomain: 'typing-test-online.com',
    keyword: 'typing test online',
  });
  await writeDesignPackageGateOutputs(runDir);
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-3' });
  assert.equal(result.allowed, true);
});

test('blocks Agent 3 when selected asset generation gate is failing', async () => {
  const runDir = await makeRun();
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, { externalEvidence: true });
  await writeFile(
    path.join(runDir, 'gate-results/selected-assets.json'),
    JSON.stringify(
      {
        gate: 'selected-assets',
        runDir,
        status: 'fail',
        passed: false,
        failures: ['cropped target screenshot asset'],
        details: {},
        evidence: {},
        generatedAt: '2026-05-08T00:00:00.000Z',
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-3' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /selected-assets\.json/);
});

test('blocks Agent 3 when toolsite design-review subset gate is missing', async () => {
  const runDir = await makeRun();
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, { externalEvidence: true });
  await mkdir(path.join(runDir, 'agent-5-output'), { recursive: true });
  await writeFile(
    path.join(runDir, 'agent-5-output/design-package-gate-report.md'),
    '# Design Package Gate Report\n\nDecision: PASS\n',
  );
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-3' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /toolsite-design-review\.json/);
  assert.equal(result.allowedNextStep, 'Run Agent 5 Design Package Gate');
});

test('blocks Agent 4 when visual restoration similarity gate is missing', async () => {
  const runDir = await makeRun();
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, { externalEvidence: true });
  await writeDesignPackageGateOutputs(runDir);
  await writeAgent3Outputs(runDir);
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-4' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /visual-restoration-similarity\.json/);
  assert.equal(result.allowedNextStep, 'Run Agent 5 Visual Restoration Gate');
});

test('blocks Agent 6 when gate evidence integrity fails', async () => {
  const runDir = await makeRun();
  await writeRunMeta(runDir, {
    target_domain: 'example.com',
    keyword: 'sample tool',
  });
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, { externalEvidence: true });
  await writeDesignPackageGateOutputs(runDir);
  await writeAgent3Outputs(runDir);
  await writeGateResult(runDir, 'visual-restoration-similarity.json');
  await mkdir(path.join(runDir, 'agent-4-output'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-4-output/implementation-report.md'), '# Implementation\n');
  await writeFile(path.join(runDir, 'agent-4-output/changed-files.md'), '# Changed Files\n');
  await mkdir(path.join(runDir, 'site'), { recursive: true });
  await writeFile(path.join(runDir, 'site/package.json'), '{"type":"module"}\n');
  await writeFile(
    path.join(runDir, 'state.json'),
    JSON.stringify({ qa: { passed: true } }, null, 2),
  );
  await mkdir(path.join(runDir, 'agent-5-output/chat-delivery'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-5-output/qa-report.md'), '# QA\n');
  await writeFile(
    path.join(runDir, 'agent-5-output/chat-delivery/final-screenshot-delivery.md'),
    'Decision: PASS\nGPT target and final page screenshots sent to chat.\n',
  );
  for (const gate of [
    'final-visual-lock.json',
    'final-visual-similarity.json',
    'rendered-assets.json',
    'tool-spec.json',
    'page-plan.json',
    'final-qa-evidence.json',
  ]) {
    await writeGateResult(runDir, gate);
  }
  await writeFile(
    path.join(runDir, 'approval.md'),
    [
      '- [x] Final QA passed',
      '- [x] Production approval granted',
    ].join('\n'),
  );
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-6' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /gate evidence integrity:/);
  assert.equal(result.allowedNextStep, 'Run gate evidence integrity check');
});

test('blocks smoke runs before Agent 6 with a clear non-deployable reason', async () => {
  const runDir = await makeRun();
  await writeRunMeta(runDir, {
    run_type: 'smoke',
    deployable: false,
    created_for: 'pipeline smoke test',
  });

  const result = await checkRunGates({ runDir, before: 'agent-6' });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.missing, [SMOKE_RUN_BLOCK_MESSAGE]);
  assert.equal(result.failedStages[0].stage, 'runDeployability');
  assert.equal(result.allowedNextStep, 'Start a production run for Agent6 deployment');
});

test('production runs before Agent 6 still require gate evidence integrity', async () => {
  const runDir = await makeRun();
  await writeRunMeta(runDir, {
    run_type: 'production',
    deployable: true,
    created_for: 'production toolsite run',
  });
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, { externalEvidence: true });
  await writeDesignPackageGateOutputs(runDir);
  await writeAgent3Outputs(runDir);
  await writeGateResult(runDir, 'visual-restoration-similarity.json');
  await mkdir(path.join(runDir, 'agent-4-output'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-4-output/implementation-report.md'), '# Implementation\n');
  await writeFile(path.join(runDir, 'agent-4-output/changed-files.md'), '# Changed Files\n');
  await mkdir(path.join(runDir, 'site'), { recursive: true });
  await writeFile(path.join(runDir, 'site/package.json'), '{"type":"module"}\n');
  await writeFile(path.join(runDir, 'state.json'), JSON.stringify({ qa: { passed: true } }, null, 2));
  await mkdir(path.join(runDir, 'agent-5-output/chat-delivery'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-5-output/qa-report.md'), '# QA\n');
  await writeFile(
    path.join(runDir, 'agent-5-output/chat-delivery/final-screenshot-delivery.md'),
    'Decision: PASS\nGPT target and final page screenshots sent to chat.\n',
  );
  for (const gate of [
    'final-visual-lock.json',
    'final-visual-similarity.json',
    'rendered-assets.json',
    'tool-spec.json',
    'page-plan.json',
    'final-qa-evidence.json',
  ]) {
    await writeGateResult(runDir, gate);
  }
  await writeFile(path.join(runDir, 'approval.md'), '- [x] Final QA passed\n- [x] Production approval granted\n');
  await writeFile(path.join(runDir, 'gate-ledger.md'), '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n');

  const result = await checkRunGates({ runDir, before: 'agent-6' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /gate evidence integrity:/);
  assert.doesNotMatch(result.missing.join('\n'), /smoke run/i);
});

test('smoke runs can still use earlier smoke checks', async () => {
  const runDir = await makeRun();
  await writeRunMeta(runDir, {
    run_type: 'smoke',
    deployable: false,
    created_for: 'pipeline smoke test',
  });
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, { externalEvidence: true });
  await writeDesignPackageGateOutputs(runDir);
  await writeAgent3Outputs(runDir);
  await writeFile(path.join(runDir, 'gate-ledger.md'), '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n');

  const result = await checkRunGates({ runDir, before: 'agent-4' });
  assert.equal(result.allowed, false);
  assert.doesNotMatch(result.missing.join('\n'), /smoke run/i);
  assert.match(result.missing.join('\n'), /visual-restoration-similarity\.json/);
});

test('does not run gate evidence integrity before Agent 4', async () => {
  const runDir = await makeRun();
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, { externalEvidence: true });
  await writeDesignPackageGateOutputs(runDir);
  await writeAgent3Outputs(runDir);
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-4' });
  assert.equal(result.allowed, false);
  assert.doesNotMatch(result.missing.join('\n'), /gate evidence integrity/);
});

test('blocks Agent 3 when Agent 2.5 external GPT provenance is present but not passing', async () => {
  const runDir = await makeRun();
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, { externalEvidence: true });
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );
  await writeFile(
    path.join(runDir, 'agent-2-5-output/external-design-evidence/source-provenance.md'),
    '# Source provenance\n\nDecision: FAIL\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-3' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /source-provenance\.md with Decision: PASS/);
});

test('blocks Agent 3 when selected design lineage is not passing', async () => {
  const runDir = await makeRun();
  await writeWebAccessGate(runDir);
  await writeAgent2Outputs(runDir);
  await writeAgent25Outputs(runDir, { externalEvidence: true });
  await writeFile(
    path.join(runDir, 'gate-ledger.md'),
    '- [waived] Agent 1 Keyword Research - User supplied keyword directly.\n',
  );
  await writeFile(
    path.join(runDir, 'agent-2-5-output/external-design-evidence/selected-design-lineage.md'),
    '# Selected design lineage\n\nDecision: FAIL\n',
  );

  const result = await checkRunGates({ runDir, before: 'agent-3' });
  assert.equal(result.allowed, false);
  assert.match(result.missing.join('\n'), /selected-design-lineage\.md with Decision: PASS/);
});

test('recognizes Agent 5 reports with Decision: PASS', () => {
  assert.equal(reportHasPassDecision('Decision: PASS\n\nDesktop: 95 / 100'), true);
  assert.equal(reportHasPassDecision('Decision: FAIL\n\nRequired changes remain'), false);
});
