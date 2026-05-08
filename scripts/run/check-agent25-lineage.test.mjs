import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runAgent25LineageGate } from './check-agent25-lineage.mjs';

async function makeRun({ lineageDecision = 'PASS' } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'agent25-lineage-'));
  const runDir = path.join(root, 'runs', 'sample');
  const evidence = path.join(runDir, 'agent-2-5-output/external-design-evidence');
  const selected = path.join(runDir, 'agent-2-5-output/selected-design');
  await mkdir(evidence, { recursive: true });
  await mkdir(path.join(selected, 'target'), { recursive: true });
  await mkdir(path.join(selected, 'code'), { recursive: true });

  await writeFile(path.join(runDir, 'state.json'), JSON.stringify({ domain: 'example.com' }));
  await writeFile(path.join(runDir, 'agent-2-5-output/design-manifest.md'), 'Selected option: Option A - Benchmark Console\n');
  await writeFile(
    path.join(evidence, 'external-response.md'),
    'Design Generation Prompt for example.com. Option A - Benchmark Console is recommended.',
  );
  await writeFile(path.join(evidence, 'conversation-screenshot.png'), 'x'.repeat(10_001));
  await writeFile(path.join(evidence, 'source-provenance.md'), 'Decision: PASS\n');
  await writeFile(path.join(evidence, 'selected-design-lineage.md'), `Decision: ${lineageDecision}\n`);
  await writeFile(path.join(selected, 'target/desktop.png'), 'x'.repeat(10_001));
  await writeFile(path.join(selected, 'target/mobile.png'), 'x'.repeat(10_001));
  await writeFile(path.join(selected, 'code/index.html'), '<main></main>');
  await writeFile(path.join(selected, 'code/style.css'), 'main { display: block; }');
  return runDir;
}

test('agent 2.5 lineage gate passes with external provenance and selected target evidence', async () => {
  const result = await runAgent25LineageGate({ runDir: await makeRun() });
  assert.equal(result.passed, true);
});

test('agent 2.5 lineage gate fails when selected lineage is not passing', async () => {
  const result = await runAgent25LineageGate({ runDir: await makeRun({ lineageDecision: 'FAIL' }) });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /selected-design-lineage/);
});
