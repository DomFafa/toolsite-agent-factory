import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runAgent25ExternalDesignProofGate } from './check-agent25-external-design-proof.mjs';

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

async function makeRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'agent25-external-proof-'));
  const runDir = path.join(root, 'runs', 'sample');
  await mkdir(path.join(runDir, 'agent-2-5-output/external-design-evidence'), { recursive: true });
  await mkdir(path.join(runDir, 'agent-2-5-output/chat-delivery'), { recursive: true });
  await mkdir(path.join(runDir, 'agent-2-5-output/selected-design/target'), { recursive: true });
  return runDir;
}

async function writePng(runDir, relPath, seed) {
  const buffer = pngBuffer(seed);
  await mkdir(path.dirname(path.join(runDir, relPath)), { recursive: true });
  await writeFile(path.join(runDir, relPath), buffer);
  return sha256(buffer);
}

async function writePassingFixture(runDir, { mode = 'production', selectionSource = 'current-chat-user', selectionText } = {}) {
  const externalResponsePath = 'agent-2-5-output/external-design-evidence/external-response.md';
  const conversationPath = 'agent-2-5-output/external-design-evidence/conversation-screenshot.png';
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

  const optionASha = await writePng(runDir, optionPaths['option-a'], 'a');
  const optionBSha = await writePng(runDir, optionPaths['option-b'], 'b');
  const optionCSha = await writePng(runDir, optionPaths['option-c'], 'c');
  const conversationSha = await writePng(runDir, conversationPath, 'conversation');
  const boardSha = await writePng(runDir, optionsBoardPath, 'board');
  const desktopSha = await writePng(runDir, desktopPath, 'b');
  const mobileSha = await writePng(runDir, mobilePath, 'mobile-b');

  const externalResponse = [
    'ChatGPT raw external response export',
    'Assistant:',
    'Option A: Compact typing trainer with a focused workbench, desktop target, mobile target, tokens, and states.',
    'Option B: Friendly illustrated typing test tool with clear input, live WPM, CPM, accuracy, difficulty defaults, and restart states.',
    'Option C: Minimal progress-first typing test with mobile-safe controls, dynamic result cards, and complete interaction states.',
    'The target domain is typing-test-online.com and the design is for Astro HTML CSS vanilla JS restoration.',
  ].join('\n');
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
      'Selected option: Option B from GPT response Option B.',
      `Desktop target: ${desktopPath} maps to GPT response Option B and source image sha ${optionBSha}.`,
      `Mobile target: ${mobilePath} maps to GPT response Option B mobile target and source image sha ${optionBSha}.`,
    ].join('\n'),
  );
  await writeFile(
    path.join(runDir, selectedLineagePath),
    [
      '# Selected Design Lineage',
      '',
      'Decision: PASS',
      'Selected Option B came from the ChatGPT approved external option response and its source image.',
    ].join('\n'),
  );
  await writeFile(
    path.join(runDir, optionSelectionPath),
    selectionText ||
      [
        '# Option Selection',
        '',
        'Decision: PASS',
        'Option A, Option B, and Option C were delivered to chat in chat-delivery/options-board.png.',
        'Current chat user selected Option B.',
      ].join('\n'),
  );

  await writeFile(
    path.join(runDir, 'agent-2-5-output/external-design-evidence/external-design-proof.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        mode,
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
          {
            id: 'option-a',
            label: 'Option A',
            source: 'GPT generated option source image',
            imagePath: optionPaths['option-a'],
            sha256: optionASha,
          },
          {
            id: 'option-b',
            label: 'Option B',
            source: 'GPT generated option source image',
            imagePath: optionPaths['option-b'],
            sha256: optionBSha,
          },
          {
            id: 'option-c',
            label: 'Option C',
            source: 'GPT generated option source image',
            imagePath: optionPaths['option-c'],
            sha256: optionCSha,
          },
        ],
        optionsBoard: {
          path: optionsBoardPath,
          source: 'assembled from GPT option source images',
          containsOptionImageHashes: [optionASha, optionBSha, optionCSha],
          sha256: boardSha,
        },
        selection: {
          source: selectionSource,
          selectedOption: 'option-b',
        },
        targets: {
          desktop: {
            path: desktopPath,
            source: 'derived from GPT external option source',
            sourceOption: 'option-b',
            sha256: desktopSha,
          },
          mobile: {
            path: mobilePath,
            source: 'derived from GPT external option source',
            sourceOption: 'option-b',
            sha256: mobileSha,
          },
        },
        selectedDesignPackage: {
          source: 'GPT external option package',
          sourceOption: 'option-b',
          codexLocalCreation: false,
        },
      },
      null,
      2,
    ),
  );
}

test('external design proof gate passes real GPT option evidence and explicit user selection', async () => {
  const runDir = await makeRun();
  await writePassingFixture(runDir);

  const result = await runAgent25ExternalDesignProofGate({ runDir });
  assert.equal(result.passed, true);
});

test('external design proof gate fails Codex-local fake option board and target evidence', async () => {
  const runDir = await makeRun();
  await writePassingFixture(runDir, {
    selectionSource: 'defaulted after 3 minutes',
    selectionText: [
      '# Option Selection',
      '',
      'Decision: PASS',
      'Option A, Option B, and Option C were delivered to chat.',
      'Defaulted after 3 minutes to Option B.',
    ].join('\n'),
  });
  await writeFile(
    path.join(runDir, 'agent-2-5-output/external-design-evidence/external-response.md'),
    '# External Design Evidence\n\nGenerated Design Directions were reconstructed by Codex.',
  );
  const proofPath = path.join(runDir, 'agent-2-5-output/external-design-evidence/external-design-proof.json');
  const proof = JSON.parse(await readFile(proofPath, 'utf8'));
  proof.approvedDesignSurface = 'codex-local';
  proof.externalResponse.kind = 'Codex summary';
  proof.optionsBoard.source = 'local HTML/CSS manual mock';
  proof.targets.desktop.source = 'locally generated target';
  proof.selectedDesignPackage.source = 'codex-local manual mock';
  proof.selectedDesignPackage.codexLocalCreation = true;
  await writeFile(proofPath, JSON.stringify(proof, null, 2));

  const result = await runAgent25ExternalDesignProofGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /local\/Codex fabrication|Codex summary|3-minute\/default|local HTML\/CSS|explicit user selection/);
});

test('external design proof gate permits 3-minute default only in dry-run mode', async () => {
  const runDir = await makeRun();
  await writePassingFixture(runDir, {
    mode: 'dry-run',
    selectionSource: 'defaulted after 3 minutes',
    selectionText: [
      '# Option Selection',
      '',
      'Decision: PASS',
      'Option A, Option B, and Option C were shown in chat as a dry-run option board.',
      'Defaulted after 3 minutes to Option B for this dry-run only.',
    ].join('\n'),
  });

  const result = await runAgent25ExternalDesignProofGate({ runDir });
  assert.equal(result.passed, true);
});
