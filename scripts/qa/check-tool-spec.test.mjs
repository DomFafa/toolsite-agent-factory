import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runToolSpecGate } from './check-tool-spec.mjs';

async function makeRun({ includeCorrectWords = true } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'tool-spec-gate-'));
  const runDir = path.join(root, 'runs', 'sample');
  await mkdir(path.join(runDir, 'agent-2-output'), { recursive: true });
  await mkdir(path.join(runDir, 'site/src/pages'), { recursive: true });
  await mkdir(path.join(runDir, 'site/src/styles'), { recursive: true });

  await writeFile(
    path.join(runDir, 'agent-2-output/tool-spec.md'),
    [
      '# Tool Spec',
      '',
      '## Required Controls',
      '',
      '- Duration segmented control: `30 sec`, `1 min`',
      '- Restart button',
      '- New passage button',
      '',
      'Optional V1 controls if implementation remains simple:',
      '',
      '- `Strict mode` toggle',
      '',
      '## Metrics',
      '',
      'Live metrics:',
      '',
      '- Time remaining',
      '- WPM',
      '',
      'Post-test results:',
      '',
      '- Final WPM',
      '- Incorrect characters',
      '- Correct words',
      '- Clear call to action: `Try again`',
    ].join('\n'),
  );

  await writeFile(
    path.join(runDir, 'site/src/pages/index.astro'),
    [
      '<div>Duration</div><button>30 sec</button><button>1 min</button><button>Restart</button><button>New passage</button>',
      '<span>Time</span><span>WPM</span>',
      '<section>Final WPM Incorrect characters Try again</section>',
      includeCorrectWords ? '<section>Correct words</section>' : '',
      '<script>input.addEventListener("input", () => {}); input.addEventListener("paste", () => {}); function startTimer(){} function blockBulkInput(){} const newPassage = true;</script>',
    ].join('\n'),
  );
  await writeFile(path.join(runDir, 'site/src/styles/global.css'), '');
  return runDir;
}

test('tool spec gate passes when required controls, metrics, and result fields exist', async () => {
  const result = await runToolSpecGate({ runDir: await makeRun() });
  assert.equal(result.passed, true);
});

test('tool spec gate fails when a required result field is missing', async () => {
  const result = await runToolSpecGate({ runDir: await makeRun({ includeCorrectWords: false }) });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /Correct words/);
});
