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

function splitInlineItems(value) {
  return String(value || '')
    .replace(/[。.;；]\s*$/g, '')
    .split(/、|,|，|\s+and\s+/i)
    .map((item) => item.replace(/`/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function findInlineList(source, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`${escaped}\\s*[:：]\\s*([^\\n。]+)`, 'i'));
    if (match?.[1]) return splitInlineItems(match[1]);
  }
  return [];
}

function currentRunInputItems(toolsiteSpec) {
  return findInlineList(toolsiteSpec, [
    '必填输入项',
    'required input items',
    'required inputs',
    'input fields',
    'inputs',
  ]);
}

function currentRunOutputItems(toolsiteSpec) {
  return findInlineList(toolsiteSpec, [
    '输出项',
    'required output items',
    'required outputs',
    'output fields',
    'outputs',
  ]);
}

function looseItemMatch(sourceNormalized, item) {
  if (sourceContains(sourceNormalized, item)) return true;
  const normalized = normalize(item);
  const aliases = [
    [/estimated 401 k balance at retirement|401 k balance at retirement/, ['projected', 'balance', 'retirement']],
    [/total employee contributions|employee contributions/, ['contributions']],
    [/employer match total|employer match/, ['employer', 'match']],
    [/investment growth|estimated growth/, ['growth']],
    [/current 401 k balance|current balance/, ['current', 'balance']],
    [/employee contribution|contribution rate/, ['contribution']],
    [/expected annual return|annual return/, ['return']],
    [/salary increase|annual salary increase/, ['salary', 'increase']],
  ];
  for (const [pattern, tokens] of aliases) {
    if (pattern.test(normalized) && tokens.every((token) => sourceNormalized.includes(token))) return true;
  }
  const importantTokens = normalized
    .split(/\s+/)
    .filter((token) => token.length > 2 && !['estimated', 'required', 'total', 'field', 'fields'].includes(token));
  if (importantTokens.length <= 2) return importantTokens.every((token) => sourceNormalized.includes(token));
  const matches = importantTokens.filter((token) => sourceNormalized.includes(token)).length;
  return matches >= Math.max(2, Math.ceil(importantTokens.length * 0.6));
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

function isTypingTestSpec({ toolsiteSpec, toolSpec, pagePlan }) {
  const combined = normalize([toolsiteSpec, toolSpec, pagePlan].join('\n'));
  return (
    /\btyping test\b|\btyping speed\b|\bwpm\b/.test(combined) &&
    /\bpassage\b|\bduration\b|\brestart\b/.test(combined)
  );
}

function runSpecificBehaviorChecks({ toolsiteSpec, toolSpec, pagePlan }) {
  if (isTypingTestSpec({ toolsiteSpec, toolSpec, pagePlan })) {
    return [
      ['timer starts on first valid typed character', /startTimer|started/i],
      ['paste prevention handled in code', /paste|insertFromPaste|drop|bulk/i],
      ['backspace updates metrics through input handling', /input\.addEventListener\("input"|addEventListener\('input'|addEventListener\("input"/i],
      ['restart behavior implemented', /restart/i],
      ['new passage behavior implemented', /newPassage|new passage/i],
    ];
  }
  const combined = `${toolsiteSpec}\n${toolSpec}\n${pagePlan}`;
  const checks = [];
  if (/即时更新|live|as you type|adjust|updates?/i.test(combined)) {
    checks.push(['input changes update results', /addEventListener\(["']input["']|oninput|input\s*=>/i]);
  }
  if (/浏览器本地|browser[-\s]*local|local in the browser|all calculations/i.test(combined)) {
    checks.push(['local browser calculation implemented', /function\s+calculate|const\s+calculate|=>\s*{[\s\S]*return|addEventListener\(["']input["']/i]);
  }
  return checks;
}

export async function runToolSpecGate({ runDir }) {
  const absoluteRunDir = path.resolve(runDir);
  const toolsiteSpec = await readOptional(path.join(absoluteRunDir, 'toolsite-spec.md'));
  const toolSpec = await readOptional(path.join(absoluteRunDir, 'agent-2-output/tool-spec.md'));
  const pagePlan = await readOptional(path.join(absoluteRunDir, 'agent-2-output/page-plan.md'));
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

  const runSpecificItems = [
    ['Toolsite SPEC required input', currentRunInputItems(toolsiteSpec)],
    ['Toolsite SPEC required output', currentRunOutputItems(toolsiteSpec)],
  ];

  for (const [section, items] of runSpecificItems) {
    for (const item of items) {
      if (!looseItemMatch(normalizedSource, item)) failures.push(`${section} item not found in implementation: ${item}`);
    }
  }

  for (const [label, pattern] of runSpecificBehaviorChecks({ toolsiteSpec, toolSpec, pagePlan })) {
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
      toolsiteSpec: 'toolsite-spec.md',
      toolSpec: 'agent-2-output/tool-spec.md',
      pagePlan: 'agent-2-output/page-plan.md',
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
