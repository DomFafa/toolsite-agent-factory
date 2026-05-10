#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { resultFromFailures, writeGateResult } from '../run/gate-result-utils.mjs';

export const PRE_AGENT2_BLOCK_MESSAGE = 'Pre-Agent2 Toolsite SPEC Gate is not complete. Agent2 is blocked.';

const SPEC_PATH = 'toolsite-spec.md';

const FIVE_ELEMENTS = [
  {
    key: 'keyword',
    label: 'Keyword / 关键词',
    aliases: ['keyword', 'primary keyword', '关键词'],
  },
  {
    key: 'targetDomain',
    label: 'Target Domain / 目标域名',
    aliases: ['target domain', 'domain', '目标域名'],
  },
  {
    key: 'uiReference',
    label: 'UI Reference / UI 参考',
    aliases: ['ui reference', 'ui 参考'],
  },
  {
    key: 'uxReference',
    label: 'UX Reference / UX 参考',
    aliases: ['ux reference', 'ux 参考'],
  },
  {
    key: 'extraIdeas',
    label: 'Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点',
    aliases: ['extra ideas', 'constraints', 'mimic points', '额外想法', '限制', '模仿点'],
  },
];

const USER_DECISION_SECTIONS = [
  'Tool Purpose',
  'First Viewport UX',
  'Input / Output Model',
  'Result Experience',
  'UI / UX Direction',
  'Non-goals',
];

const SYSTEM_DEFAULT_SECTIONS = [
  'Technical Constraints',
  'Page Boundary',
  'Agent Workflow Boundary',
  'SEO Baseline',
  'Success Criteria Baseline',
];

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
  if (!args.runDir) {
    throw new Error('Usage: node scripts/qa/check-pre-agent2-toolsite-spec.mjs --run-dir runs/<site-id> [--write]');
  }
  return args;
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/^[-\s#]+/, '')
    .trim();
}

function normalize(value) {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[：:]/g, ':')
    .replace(/[^a-z0-9\u4e00-\u9fff/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasUsefulValue(value) {
  const cleaned = stripMarkdown(value);
  if (!cleaned) return false;
  if (/^(?:todo|tbd|pending|placeholder|<[^>]+>)$/i.test(cleaned)) return false;
  return true;
}

function findLabeledValue(text, aliases) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const separatorIndex = line.search(/[：:]/);
    if (separatorIndex < 0) continue;
    const rawLabel = line.slice(0, separatorIndex);
    const rawValue = line.slice(separatorIndex + 1);
    const normalizedLabel = normalize(rawLabel);
    const matched = aliases.some((alias) => normalizedLabel.includes(normalize(alias)));
    if (matched) return stripMarkdown(rawValue);
  }
  return '';
}

function sectionContent(text, heading) {
  const lines = text.split(/\r?\n/);
  const target = normalize(heading);
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^##\s+(.+?)\s*$/);
    if (match && normalize(match[1]) === target) {
      start = index + 1;
      break;
    }
  }
  if (start < 0) return '';
  const body = [];
  for (let index = start; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) break;
    body.push(lines[index]);
  }
  return body.join('\n').trim();
}

function hasCompleteSection(text, heading) {
  return hasUsefulValue(sectionContent(text, heading));
}

function extractQuestionRounds(text) {
  const value = findLabeledValue(text, ['question rounds', 'q&a rounds', 'qa rounds', '问答轮数']);
  const fromField = value.match(/\d+/)?.[0];
  if (fromField) return Number(fromField);
  const fallback = text.match(/(?:question|q&a|qa|问答)[^\n]{0,40}?(\d+)/i)?.[1];
  return fallback ? Number(fallback) : NaN;
}

function isComplexTool(text) {
  const value = findLabeledValue(text, ['complex tool', '复杂工具']);
  return /\b(?:yes|true|complex)\b|是|复杂/i.test(value);
}

function hasEarlySpecConsent(text) {
  return /六个用户决策区已清楚，用户同意提前输出\s*SPEC。?/i.test(text);
}

function validateQuestionRounds(text, failures) {
  const rounds = extractQuestionRounds(text);
  const complex = isComplexTool(text);
  const earlyConsent = hasEarlySpecConsent(text);

  if (!Number.isFinite(rounds)) {
    failures.push('Lightweight Q&A Record is missing question rounds');
    return { rounds: null, complex, earlyConsent };
  }

  if (rounds < 12 && !earlyConsent) {
    failures.push('fewer than 12 question rounds requires the early SPEC consent sentence');
  }
  if (rounds > 20 && !complex) {
    failures.push('more than 20 question rounds is allowed only when Complex tool is yes');
  }
  if (rounds > 30) {
    failures.push('question rounds must not exceed 30');
  }
  return { rounds, complex, earlyConsent };
}

function validateUserConfirmation(text, failures) {
  const section = sectionContent(text, 'User Confirmation');
  if (!hasUsefulValue(section)) {
    failures.push('missing User Confirmation section');
    return;
  }
  if (!/-\s+\[x\]\s+User confirmed this Toolsite SPEC before Agent2 starts\./i.test(section)) {
    failures.push('User Confirmation checkbox must be checked before Agent2 starts');
  }
  for (const field of ['Confirmation text', 'Confirmed by', 'Confirmed at']) {
    const value = findLabeledValue(section, [field]);
    if (!hasUsefulValue(value)) failures.push(`User Confirmation is missing ${field}`);
  }
}

export async function runPreAgent2ToolsiteSpecGate({ runDir }) {
  const absoluteRunDir = path.resolve(runDir);
  const specText = await readOptional(path.join(absoluteRunDir, SPEC_PATH));
  const failures = [];

  if (!specText.trim()) {
    failures.push(`missing ${SPEC_PATH}`);
  } else {
    for (const field of FIVE_ELEMENTS) {
      const value = findLabeledValue(specText, field.aliases);
      if (!hasUsefulValue(value)) failures.push(`missing required five-element field: ${field.label}`);
    }

    const qna = validateQuestionRounds(specText, failures);

    for (const heading of USER_DECISION_SECTIONS) {
      if (!hasCompleteSection(specText, heading)) failures.push(`missing user decision section: ${heading}`);
    }

    for (const heading of SYSTEM_DEFAULT_SECTIONS) {
      if (!hasCompleteSection(specText, heading)) failures.push(`missing system default section: ${heading}`);
    }

    validateUserConfirmation(specText, failures);

    return resultFromFailures({
      gate: 'pre-agent2-toolsite-spec',
      runDir: absoluteRunDir,
      failures,
      details: {
        questionRounds: qna.rounds,
        complexTool: qna.complex,
        earlySpecConsent: qna.earlyConsent,
      },
      evidence: {
        spec: SPEC_PATH,
        output: 'gate-results/pre-agent2-toolsite-spec.json',
      },
    });
  }

  return resultFromFailures({
    gate: 'pre-agent2-toolsite-spec',
    runDir: absoluteRunDir,
    failures,
    evidence: {
      spec: SPEC_PATH,
      output: 'gate-results/pre-agent2-toolsite-spec.json',
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runPreAgent2ToolsiteSpecGate({ runDir: args.runDir });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'pre-agent2-toolsite-spec.json', result);
  if (result.passed) {
    console.log('PASS Pre-Agent2 Toolsite SPEC Gate');
  } else {
    console.log(PRE_AGENT2_BLOCK_MESSAGE);
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
