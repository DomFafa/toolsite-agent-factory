import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runToolsiteDesignReviewGate } from './check-toolsite-design-review.mjs';

async function makeRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'toolsite-design-review-'));
  const runDir = path.join(root, 'runs', 'sample');
  const selected = path.join(runDir, 'agent-2-5-output/selected-design');
  await mkdir(path.join(selected, 'code'), { recursive: true });
  await mkdir(path.join(runDir, 'agent-5-output'), { recursive: true });
  await writeFile(path.join(runDir, 'agent-2-5-output/design-manifest.md'), [
    '# Design Manifest',
    'First viewport is the usable tool.',
  ].join('\n'));
  await writeFile(path.join(selected, 'component-spec.md'), [
    '# Component Spec',
    'First viewport is the usable tool workflow.',
    'Primary input, action button, live metric, output result, and feedback are visible.',
  ].join('\n'));
  await writeFile(path.join(selected, 'usability-contract.md'), [
    '# Usability Contract',
    'Controls visibly update active state and results. Mobile tap targets stay readable at 390px.',
    'Restart clears input and metrics.',
  ].join('\n'));
  await writeFile(path.join(selected, 'dynamic-data-fit.md'), [
    '# Dynamic Data Fit',
    'Mobile controls wrap without horizontal overflow. Output values fit.',
  ].join('\n'));
  await writeFile(path.join(selected, 'ux-self-audit.md'), [
    '# UX Self-Audit',
    'Decision: PASS',
    'First viewport is the tool itself with live feedback, visible active states, and readable mobile layout.',
  ].join('\n'));
  await writeFile(path.join(selected, 'interaction-state-model.md'), [
    '# Interaction State Model',
    'Idle, running, complete, reset, current, selected, and feedback states define input, button, metric, status, and result behavior.',
  ].join('\n'));
  await writeFile(path.join(selected, 'forbidden-deviations.md'), '# Forbidden Deviations\nNo marketing hero.\n');
  await writeFile(path.join(selected, 'restoration-rules.md'), '# Restoration Rules\nPreserve first viewport tool layout.\n');
  await writeFile(path.join(runDir, 'agent-5-output/design-package-gate-report.md'), '# Design Package Gate\n\nDecision: PASS\n');
  await writeFile(path.join(selected, 'code/index.html'), [
    '<header class="site-header"><a class="brand">Sample Tool</a></header>',
    '<main><section class="tool-panel"><h1>Sample Tool</h1><textarea></textarea><button>Calculate</button><div class="metric">Result</div></section><section class="faq"></section></main>',
  ].join('\n'));
  await writeFile(path.join(selected, 'code/style.css'), 'button{cursor:pointer}.metric{font-variant-numeric:tabular-nums}');
  return runDir;
}

test('toolsite design-review subset passes a tool-first usable design package', async () => {
  const runDir = await makeRun();
  const result = await runToolsiteDesignReviewGate({ runDir });
  assert.equal(result.passed, true);
});

test('toolsite design-review subset rejects generic marketing-first AI slop', async () => {
  const runDir = await makeRun();
  await writeFile(path.join(runDir, 'agent-2-5-output/selected-design/code/index.html'), [
    '<header class="site-header"><a class="brand">Sample Tool</a></header>',
    '<main><section class="hero"><h1>Unlock the power of your all-in-one solution 🚀</h1></section><section class="tool-panel"><textarea></textarea><button>Calculate</button><div>Result</div></section></main>',
  ].join('\n'));
  await writeFile(path.join(runDir, 'agent-2-5-output/selected-design/code/style.css'), [
    '.blob{position:absolute}',
    '.hero{text-align:center}',
    '.feature-grid{text-align:center}',
  ].join('\n'));
  const result = await runToolsiteDesignReviewGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /AI Slop Gate/);
  assert.match(result.failures.join('\n'), /Visual Hierarchy/);
});
