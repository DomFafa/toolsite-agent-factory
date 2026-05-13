import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  GATE_REPAIR_PASSED,
  NEEDS_HUMAN_DECISION,
  runGateRepairLoop,
} from './gate-repair-loop.mjs';

test('desktop gate repair loop retries failed gate up to limit', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-repair-'));
  const runDir = path.join(root, 'runs', 'sample');
  await mkdir(runDir, { recursive: true });
  let attempts = 0;
  let repairs = 0;

  const result = await runGateRepairLoop({
    runDir,
    gate: 'build',
    maxAttempts: 3,
    gateRunner: async () => {
      attempts += 1;
      return { passed: false, failures: [`failure ${attempts}`] };
    },
    repairRunner: async () => {
      repairs += 1;
      return { repaired: true };
    },
    now: () => '2026-05-13T00:00:00.000Z',
  });

  assert.equal(result.code, NEEDS_HUMAN_DECISION);
  assert.equal(attempts, 3);
  assert.equal(repairs, 3);
  assert.equal(result.attempts.length, 3);
  assert.match(await readFile(result.reportPath, 'utf8'), /NEEDS_HUMAN_DECISION/);
});

test('desktop gate repair loop stops when gate passes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-repair-pass-'));
  const runDir = path.join(root, 'runs', 'sample');
  await mkdir(runDir, { recursive: true });
  let attempts = 0;

  const result = await runGateRepairLoop({
    runDir,
    gate: 'tool-spec',
    maxAttempts: 5,
    gateRunner: async () => {
      attempts += 1;
      return attempts === 2
        ? { passed: true, failures: [] }
        : { passed: false, failures: ['missing words counter'] };
    },
    repairRunner: async () => ({ repaired: true }),
  });

  assert.equal(result.code, GATE_REPAIR_PASSED);
  assert.equal(attempts, 2);
});

test('desktop gate repair loop does not edit gate-results', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-repair-gates-'));
  const runDir = path.join(root, 'runs', 'sample');
  const gateDir = path.join(runDir, 'gate-results');
  await mkdir(gateDir, { recursive: true });
  const gatePath = path.join(gateDir, 'tool-spec.json');
  const original = '{"status":"fail","passed":false}\n';
  await writeFile(gatePath, original);

  const result = await runGateRepairLoop({
    runDir,
    gate: 'tool-spec',
    maxAttempts: 2,
    gateRunner: async () => ({ passed: false, failures: ['still failing'] }),
    repairRunner: async () => ({ repaired: true }),
  });

  assert.equal(result.code, NEEDS_HUMAN_DECISION);
  assert.equal(await readFile(gatePath, 'utf8'), original);
  assert.equal(result.gateResultsUntouched, true);
});

