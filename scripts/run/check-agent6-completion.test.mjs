import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runAgent6CompletionGate } from './check-agent6-completion.mjs';

const ALL_GATES = [
  'Pages deployment',
  'apex custom domain',
  'www custom domain',
  'DNS switched to Cloudflare Pages',
  'Email Routing catch-all',
  'Cloudflare Speed Settings',
  'Cloudflare Images Transformations',
  'Cloudflare Web Analytics',
  'IndexNow',
  'Google Search Console',
  'Bing Webmaster Tools',
  'API-first fallback',
];

async function makeRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'agent6-completion-'));
  const runDir = path.join(root, 'runs', 'sample');
  await mkdir(path.join(runDir, 'agent-6-output'), { recursive: true });
  return runDir;
}

function tableRow({ gate, status = 'completed', evidence = 'Verified with live evidence.', hardBlocker = '-', nextAction = '-' }) {
  return `| ${gate} | ${status} | ${evidence} | ${hardBlocker} | ${nextAction} |`;
}

async function writeLaunchReport(runDir, rows, finalStatus) {
  const report = [
    '# Launch Report',
    '',
    '## Required Launch Gates',
    '',
    '| gate | status | evidence | hard blocker | next action |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '## Final status',
    '',
    finalStatus,
    '',
  ].join('\n');
  await writeFile(path.join(runDir, 'agent-6-output/launch-report.md'), report);
}

async function writeState(runDir, status) {
  await writeFile(path.join(runDir, 'state.json'), `${JSON.stringify({ status }, null, 2)}\n`);
}

test('fails when only Pages and DNS are complete but report claims full launch completed', async () => {
  const runDir = await makeRun();
  await writeLaunchReport(
    runDir,
    [
      tableRow({ gate: 'Pages deployment', evidence: 'Pages deployment URL returned 200.' }),
      tableRow({ gate: 'apex custom domain', evidence: 'Apex custom domain active.' }),
      tableRow({ gate: 'www custom domain', evidence: 'WWW custom domain active.' }),
      tableRow({ gate: 'DNS switched to Cloudflare Pages', evidence: 'Old provider records replaced.' }),
    ],
    'full_launch_completed',
  );
  await writeState(runDir, 'full_launch_completed');

  const result = await runAgent6CompletionGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /Email Routing catch-all completed/);
  assert.match(result.failures.join('\n'), /Cloudflare Speed Settings completed/);
  assert.match(result.failures.join('\n'), /full_launch_completed is forbidden/);
});

test('passes when all Agent6 required launch gates are completed', async () => {
  const runDir = await makeRun();
  await writeLaunchReport(
    runDir,
    ALL_GATES.map((gate) =>
      tableRow({
        gate,
        evidence:
          gate === 'API-first fallback'
            ? 'Token API attempted for Cloudflare operations; Cloudflare Dashboard same-origin fallback used where permission errors occurred.'
            : `${gate} verified with production evidence.`,
      }),
    ),
    'full_launch_completed',
  );
  await writeState(runDir, 'full_launch_completed');

  const result = await runAgent6CompletionGate({ runDir });
  assert.equal(result.passed, true);
});

test('passes with a hard blocker only when final status is partial launch blocked', async () => {
  const runDir = await makeRun();
  await writeLaunchReport(
    runDir,
    ALL_GATES.map((gate) => {
      if (gate === 'Google Search Console') {
        return tableRow({
          gate,
          status: 'hard_blocker',
          evidence: 'GSC stopped on user-only MFA after web-access login attempt screenshot.',
          hardBlocker: 'User-only MFA challenge blocks GSC property verification.',
          nextAction: 'User must complete MFA, then rerun Agent6 completion.',
        });
      }
      return tableRow({ gate, evidence: `${gate} verified with production evidence.` });
    }),
    'partial_launch_blocked',
  );
  await writeState(runDir, 'partial_launch_blocked');

  const result = await runAgent6CompletionGate({ runDir });
  assert.equal(result.passed, true);
});

test('fails when API permission errors are recorded without Dashboard fallback attempt', async () => {
  const runDir = await makeRun();
  await writeLaunchReport(
    runDir,
    ALL_GATES.map((gate) =>
      tableRow({
        gate,
        evidence:
          gate === 'API-first fallback'
            ? 'Token API returned Authentication error code 10000 for DNS mutation.'
            : `${gate} verified with production evidence.`,
      }),
    ),
    'full_launch_completed',
  );

  const result = await runAgent6CompletionGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /without web-access\/Cloudflare Dashboard fallback attempt/);
});

test('does not treat allowed final status documentation as an actual final status', async () => {
  const runDir = await makeRun();
  await writeLaunchReport(
    runDir,
    ALL_GATES.map((gate) => tableRow({ gate, evidence: `${gate} verified.` })),
    ['Allowed values only:', '- `full_launch_completed`', '- `partial_launch_blocked`'].join('\n'),
  );

  const result = await runAgent6CompletionGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /final status must be exactly/);
});

test('writes agent6-completion gate result when requested by CLI', async () => {
  const runDir = await makeRun();
  await writeLaunchReport(
    runDir,
    ALL_GATES.map((gate) => tableRow({ gate, evidence: `${gate} verified.` })),
    'full_launch_completed',
  );

  const result = spawnSync(
    process.execPath,
    ['scripts/run/check-agent6-completion.mjs', '--run-dir', runDir, '--write'],
    { cwd: path.resolve('.'), encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const written = JSON.parse(await readFile(path.join(runDir, 'gate-results/agent6-completion.json'), 'utf8'));
  assert.equal(written.gate, 'agent6-completion');
  assert.equal(written.passed, true);
});
