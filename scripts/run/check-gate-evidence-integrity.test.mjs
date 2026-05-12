import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runGateEvidenceIntegrityCheck } from './check-gate-evidence-integrity.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function png(width = 100, height = 80) {
  const buffer = Buffer.alloc(32);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

async function makeRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'gate-evidence-integrity-'));
  const runDir = path.join(root, 'runs', 'sample-site');
  await mkdir(runDir, { recursive: true });
  return runDir;
}

async function writeGate(runDir, filename, evidence = {}) {
  const gateDir = path.join(runDir, 'gate-results');
  await mkdir(gateDir, { recursive: true });
  await writeFile(
    path.join(gateDir, filename),
    `${JSON.stringify(
      {
        gate: filename.replace(/\.json$/, ''),
        runDir,
        status: 'pass',
        passed: true,
        failures: [],
        details: {},
        evidence,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

async function writeFileInRun(runDir, relPath, content = '') {
  const absolutePath = path.join(runDir, relPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

async function writeAllArtifacts(runDir) {
  await writeFileInRun(runDir, 'agent-2-5-output/selected-design/target/desktop.png', png(1440, 900));
  await writeFileInRun(runDir, 'agent-2-5-output/selected-design/target/mobile.png', png(390, 844));
  await writeFileInRun(runDir, 'agent-2-5-output/chat-delivery/options-board.png', png(1600, 1600));
  await writeFileInRun(runDir, 'agent-3-output/final-screenshots/desktop.png', png(1440, 900));
  await writeFileInRun(runDir, 'agent-3-output/final-screenshots/mobile.png', png(390, 844));
  await writeFileInRun(runDir, 'agent-3-output/implementation-handoff.md', '# Handoff\n\nSelected option: Option A\n');
  await writeFileInRun(runDir, 'agent-4-output/implementation-report.md', '# Implementation\n\nselected_design = Option A\n');
  await writeFileInRun(runDir, 'agent-5-output/visual-restoration-similarity/compare.html', '<html></html>\n');
  await writeFileInRun(runDir, 'agent-5-output/final-visual-lock/desktop.png', png(1440, 900));
  await writeFileInRun(runDir, 'agent-5-output/final-visual-lock/mobile.png', png(390, 844));
  await writeFileInRun(runDir, 'agent-5-output/final-visual-lock/wide.png', png(1920, 1080));
  await writeFileInRun(runDir, 'agent-5-output/final-visual-similarity/compare.html', '<html></html>\n');
  await writeFileInRun(runDir, 'agent-5-output/final-qa-report.md', '# Final QA\n\nPASS\n');
  await writeFileInRun(runDir, 'agent-5-output/launch-readiness.md', '# Launch Readiness\n\nPASS\n');
  await writeFileInRun(
    runDir,
    'site/src/pages/index.astro',
    [
      '<textarea aria-label="Word counter input"></textarea>',
      '<section>words characters sentences paragraphs reading time speaking time</section>',
    ].join('\n'),
  );
  await writeFileInRun(runDir, 'site/src/pages/privacy.astro', '<main>Privacy</main>\n');
  await writeFileInRun(runDir, 'site/src/pages/terms.astro', '<main>Terms</main>\n');
  await writeFileInRun(runDir, 'site/src/pages/sitemap.xml.ts', 'export async function GET() {}\n');
  await writeFileInRun(runDir, 'site/src/pages/robots.txt.ts', 'export async function GET() {}\n');
  await writeFileInRun(runDir, 'site/package.json', '{"type":"module"}\n');
  await writeFileInRun(
    runDir,
    'human-review-events.jsonl',
    `${JSON.stringify({
      type: 'human_review',
      id: 'agent25-option-selection',
      review_type: 'agent25_option_selection',
      status: 'resolved',
      selected_option: 'A',
      selected_design: 'Option A',
      resolution_text: 'A',
      resolved_at: new Date().toISOString(),
    })}\n`,
  );
}

async function writeAllPassingGateResults(runDir) {
  await sleep(20);
  await writeGate(runDir, 'visual-restoration-similarity.json', {
    comparedPairs: [
      {
        target: 'agent-2-5-output/selected-design/target/desktop.png',
        restored: 'agent-3-output/final-screenshots/desktop.png',
      },
      {
        target: 'agent-2-5-output/selected-design/target/mobile.png',
        restored: 'agent-3-output/final-screenshots/mobile.png',
      },
    ],
    comparePage: 'agent-5-output/visual-restoration-similarity/compare.html',
  });
  await writeGate(runDir, 'final-visual-lock.json', {
    screenshots: {
      desktop: 'agent-5-output/final-visual-lock/desktop.png',
      mobile: 'agent-5-output/final-visual-lock/mobile.png',
      wide: 'agent-5-output/final-visual-lock/wide.png',
    },
  });
  await writeGate(runDir, 'final-visual-similarity.json', {
    comparedPairs: [
      {
        target: 'agent-2-5-output/selected-design/target/desktop.png',
        final: 'agent-5-output/final-visual-lock/desktop.png',
      },
      {
        target: 'agent-2-5-output/selected-design/target/mobile.png',
        final: 'agent-5-output/final-visual-lock/mobile.png',
      },
    ],
    comparePage: 'agent-5-output/final-visual-similarity/compare.html',
  });
  await writeGate(runDir, 'tool-spec.json');
  await writeGate(runDir, 'page-plan.json');
  await writeGate(runDir, 'selected-assets.json');
  await writeGate(runDir, 'agent25-lineage.json');
  await writeGate(runDir, 'agent25-external-design-proof.json');
  await writeGate(runDir, 'final-qa-evidence.json');
}

async function makePassingRun() {
  const runDir = await makeRun();
  await writeAllArtifacts(runDir);
  await writeAllPassingGateResults(runDir);
  return runDir;
}

test('fails when passed visual JSON lacks real screenshot artifacts', async () => {
  const runDir = await makePassingRun();
  await writeFileInRun(runDir, 'agent-3-output/final-screenshots/desktop.png.moved', 'not the screenshot\n');
  await writeFile(path.join(runDir, 'agent-3-output/final-screenshots/desktop.png'), '');

  const result = await runGateEvidenceIntegrityCheck({ runDir, before: 'agent-6' });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /visual-restoration restored screenshot/);
});

test('fails when tool-spec JSON passes but site source is missing', async () => {
  const runDir = await makeRun();
  await writeAllPassingGateResults(runDir);

  const result = await runGateEvidenceIntegrityCheck({ runDir, before: 'agent-6' });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /tool-spec: site\/ is missing/);
});

test('fails when selected option resolved event is missing', async () => {
  const runDir = await makePassingRun();
  await writeFile(path.join(runDir, 'human-review-events.jsonl'), '');

  const result = await runGateEvidenceIntegrityCheck({ runDir, before: 'agent-6' });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /missing resolved agent25-option-selection/);
});

test('fails when site source is newer than a gate result', async () => {
  const runDir = await makePassingRun();
  await sleep(20);
  await writeFileInRun(runDir, 'site/src/pages/index.astro', 'words characters sentences paragraphs reading time speaking time\n');

  const result = await runGateEvidenceIntegrityCheck({ runDir, before: 'agent-6' });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /stale gate result/);
});

test('passes when gate JSON is grounded in real artifacts', async () => {
  const runDir = await makePassingRun();

  const result = await runGateEvidenceIntegrityCheck({ runDir, before: 'agent-6' });
  assert.equal(result.passed, true);
  assert.deepEqual(result.failures, []);
});

test('does not apply before earlier agents', async () => {
  const runDir = await makeRun();

  const result = await runGateEvidenceIntegrityCheck({ runDir, before: 'agent-3' });
  assert.equal(result.passed, true);
  assert.deepEqual(result.failures, []);
});
