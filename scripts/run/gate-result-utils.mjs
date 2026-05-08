import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function readJsonOptional(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export async function readTextOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

export function gatePasses(result) {
  return Boolean(result && result.status === 'pass' && result.passed === true);
}

export async function writeGateResult(runDir, filename, result) {
  const gateDir = path.join(runDir, 'gate-results');
  await mkdir(gateDir, { recursive: true });
  const outputPath = path.join(gateDir, filename);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return outputPath;
}

export async function requirePassingGateResult(runDir, filename, label) {
  const resultPath = path.join(runDir, 'gate-results', filename);
  const result = await readJsonOptional(resultPath);
  if (gatePasses(result)) return [];
  return [`gate-results/${filename} passing result for ${label}`];
}

export function resultFromFailures({ gate, runDir, failures, details = {}, evidence = {} }) {
  return {
    gate,
    runDir,
    status: failures.length === 0 ? 'pass' : 'fail',
    passed: failures.length === 0,
    failures,
    details,
    evidence,
    generatedAt: new Date().toISOString(),
  };
}
