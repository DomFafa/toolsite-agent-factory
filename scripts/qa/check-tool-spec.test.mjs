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
    path.join(runDir, 'toolsite-spec.md'),
    [
      '# Toolsite SPEC: typing-test-online',
      '',
      '## Tool Purpose',
      '',
      '- Build a typing test with timed passages, WPM, restart, and new passage behavior.',
    ].join('\n'),
  );

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
    path.join(runDir, 'agent-2-output/page-plan.md'),
    [
      '# Page Plan',
      '',
      '| / | tool | required | Primary typing test page. | Agent4 |',
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

async function make401kRun({ includeEmployerMatch = true } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'tool-spec-401k-'));
  const runDir = path.join(root, 'runs', '401k-calculator-net');
  await mkdir(path.join(runDir, 'agent-2-output'), { recursive: true });
  await mkdir(path.join(runDir, 'site/src/pages'), { recursive: true });
  await mkdir(path.join(runDir, 'site/src/styles'), { recursive: true });

  await writeFile(
    path.join(runDir, 'toolsite-spec.md'),
    [
      '# Toolsite SPEC: 401k-calculator-net',
      '',
      '## Input / Output Model',
      '',
      '- 必填输入项：current age、retirement age、current 401(k) balance、annual salary、employee contribution、employer match、expected annual return、salary increase。',
      '- 输出项：estimated 401(k) balance at retirement、total employee contributions、employer match total、investment growth。',
      '- 用户调整输入后结果应即时更新，不需要登录，也不保存用户数据。',
      '',
      '## Technical Constraints',
      '',
      '- 所有计算在浏览器本地运行。',
    ].join('\n'),
  );
  await writeFile(
    path.join(runDir, 'agent-2-output/tool-spec.md'),
    [
      '# 401k calculator Tool Spec',
      '',
      '## Behavior',
      '',
      'Implement the 401k calculator behavior described in the confirmed Toolsite SPEC. Keep all computation local in the browser.',
    ].join('\n'),
  );
  await writeFile(
    path.join(runDir, 'agent-2-output/page-plan.md'),
    [
      '# 401k calculator Page Plan',
      '',
      '| / | tool | required | Primary 401k calculator tool page. | Agent4 |',
    ].join('\n'),
  );
  await writeFile(
    path.join(runDir, 'site/src/pages/index.astro'),
    [
      '<label>Current age</label><input id="current-age" />',
      '<label>Retirement age</label><input id="retirement-age" />',
      '<label>Current 401(k) balance</label><input id="current-balance" />',
      '<label>Annual salary</label><input id="annual-salary" />',
      '<label>Employee contribution</label><input id="employee-contribution" />',
      includeEmployerMatch ? '<label>Employer match</label><input id="employer-match" />' : '',
      '<label>Expected annual return</label><input id="annual-return" />',
      '<label>Salary increase</label><input id="salary-increase" />',
      '<section>Projected balance at retirement</section>',
      '<section>Your contributions</section>',
      includeEmployerMatch ? '<section>Employer match total</section>' : '',
      '<section>Investment growth</section>',
      '<script>function calculate(){ return {}; } document.querySelector("input")?.addEventListener("input", calculate);</script>',
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

test('401K tool spec gate is not blocked by typing-test-only behavior requirements', async () => {
  const result = await runToolSpecGate({ runDir: await make401kRun() });
  assert.equal(result.passed, true);
  assert.doesNotMatch(result.failures.join('\n'), /timer starts|paste prevention|restart behavior|new passage/);
});

test('generic tool spec gate checks current run SPEC input and output items', async () => {
  const result = await runToolSpecGate({ runDir: await make401kRun({ includeEmployerMatch: false }) });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /employer match/i);
});

test('typing-test golden requirements still enforce typing-specific behavior', async () => {
  const runDir = await makeRun();
  await writeFile(
    path.join(runDir, 'site/src/pages/index.astro'),
    [
      '<div>Duration</div><button>30 sec</button><button>1 min</button><button>Again</button><button>Another text</button>',
      '<span>Time</span><span>WPM</span>',
      '<section>Final WPM Incorrect characters Correct words Try again</section>',
      '<script>input.addEventListener("input", () => {});</script>',
    ].join('\n'),
  );
  const result = await runToolSpecGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /timer starts on first valid typed character/);
  assert.match(result.failures.join('\n'), /paste prevention handled in code/);
  assert.match(result.failures.join('\n'), /restart behavior implemented/);
  assert.match(result.failures.join('\n'), /new passage behavior implemented/);
});
