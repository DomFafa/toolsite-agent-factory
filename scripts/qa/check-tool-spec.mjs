#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { resultFromFailures, writeGateResult } from '../run/gate-result-utils.mjs';

function parseArgs(argv) {
  const args = { write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') {
      args.write = true;
    } else if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    }
  }
  if (!args.runDir) throw new Error('Usage: node scripts/qa/check-tool-spec.mjs --run-dir runs/<site-id> [--write]');
  return args;
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function sectionItems(source, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`##\\s+${escaped}[\\s\\S]*?(?=\\n##\\s+|$)`, 'i'));
  if (!match) return [];
  return match[0]
    .split('\n')
    .map((line) => line.match(/^\s*-\s+(.+)/)?.[1]?.trim())
    .filter(Boolean)
    .map((line) => line.replace(/`/g, '').replace(/\s+/g, ' ').trim());
}

function requiredControlItems(source) {
  const section = source.match(/##\s+Required Controls[\s\S]*?(?=\n##\s+|$)/i)?.[0] || '';
  const requiredOnly = section.split(/\nOptional\b/i)[0];
  return requiredOnly
    .split('\n')
    .map((line) => line.match(/^\s*-\s+(.+)/)?.[1]?.trim())
    .filter(Boolean)
    .map((line) => line.replace(/`/g, '').replace(/\s+/g, ' ').trim());
}

function subsectionItems(source, sectionHeading, subsectionHeading) {
  const escapedSection = sectionHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const section = source.match(new RegExp(`##\\s+${escapedSection}[\\s\\S]*?(?=\\n##\\s+|$)`, 'i'))?.[0] || '';
  const escapedSubsection = subsectionHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = section.match(new RegExp(`${escapedSubsection}\\s*:[\\s\\S]*?(?=\\n\\s*[A-Z][A-Za-z -]+:\\s*\\n|$)`, 'i'));
  if (!match) return [];
  return match[0]
    .split('\n')
    .map((line) => line.match(/^\s*-\s+(.+)/)?.[1]?.trim())
    .filter(Boolean)
    .map((line) => line.replace(/`/g, '').replace(/\s+/g, ' ').trim());
}

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function sourceContains(sourceNormalized, item) {
  const normalized = normalize(item);
  if (!normalized) return true;
  if (item.includes(':')) {
    const [rawLabel, rawValues] = item.split(/:\s*/, 2);
    const label = normalize(rawLabel);
    const values = rawValues
      .split(/\s*,\s*|\s+and\s+/)
      .map((value) => normalize(value))
      .filter(Boolean);
    const labelOk = label
      .replace(/\bsegmented control\b/g, '')
      .replace(/\bselector\b/g, '')
      .replace(/\bbutton\b/g, '')
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .every((word) => sourceNormalized.includes(word));
    const valuesOk = values.every((value) => sourceNormalized.includes(value));
    if (labelOk && valuesOk) return true;
  }
  const alternatives = new Set([normalized]);
  alternatives.add(normalized.replace(/\bsegmented control\b/g, '').trim());
  alternatives.add(normalized.replace(/\bclear call to action\b/g, '').trim());
  alternatives.add(normalized.replace(/\bselector\b/g, '').trim());
  alternatives.add(normalized.replace(/\bbutton\b/g, '').trim());
  alternatives.add(normalized.replace(/\bfinal\b/g, '').trim());
  alternatives.add(normalized.replace(/\bpassage mode\b/g, 'mode').trim());
  alternatives.add(normalized.replace(/\btime remaining\b/g, 'time').trim());

  return [...alternatives]
    .filter((candidate) => candidate.length >= 2)
    .some((candidate) => sourceNormalized.includes(candidate));
}

export async function runToolSpecGate({ runDir }) {
  const absoluteRunDir = path.resolve(runDir);
  const toolSpec = await readOptional(path.join(absoluteRunDir, 'agent-2-output/tool-spec.md'));
  const source = [
    await readOptional(path.join(absoluteRunDir, 'site/src/pages/index.astro')),
    await readOptional(path.join(absoluteRunDir, 'site/src/styles/global.css')),
  ].join('\n');
  const normalizedSource = normalize(source);
  const failures = [];

  if (!toolSpec.trim()) failures.push('missing agent-2-output/tool-spec.md');
  if (!source.trim()) failures.push('missing site source for tool-spec validation');

  const requiredSections = [
    ['Required Controls', requiredControlItems(toolSpec)],
    ['Live metrics', subsectionItems(toolSpec, 'Metrics', 'Live metrics')],
    ['Post-test results', subsectionItems(toolSpec, 'Metrics', 'Post-test results')],
  ];

  for (const [section, items] of requiredSections) {
    for (const item of items) {
      if (/^optional/i.test(item)) continue;
      if (!sourceContains(normalizedSource, item)) failures.push(`${section} item not found in implementation: ${item}`);
    }
  }

  const edgeCases = [
    ['timer starts on first valid typed character', /startTimer|started/i],
    ['paste prevention handled in code', /paste|insertFromPaste|drop|bulk/i],
    ['backspace updates metrics through input handling', /input\.addEventListener\("input"|addEventListener\('input'/i],
    ['restart behavior implemented', /restart/i],
    ['new passage behavior implemented', /newPassage|new passage/i],
  ];

  for (const [label, pattern] of edgeCases) {
    if (!pattern.test(source)) failures.push(`missing behavior evidence: ${label}`);
  }

  return resultFromFailures({
    gate: 'tool-spec',
    runDir: absoluteRunDir,
    failures,
    details: {
      checkedSections: requiredSections.map(([section, items]) => ({ section, itemCount: items.length })),
    },
    evidence: {
      toolSpec: 'agent-2-output/tool-spec.md',
      implementation: 'site/src/pages/index.astro',
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runToolSpecGate({ runDir: args.runDir });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'tool-spec.json', result);
  console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} tool spec`);
  if (result.failures.length) {
    for (const failure of result.failures) console.log(`- ${failure}`);
  }
  process.exitCode = result.passed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
