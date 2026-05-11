#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REQUIRED_AGENT2_OUTPUTS = [
  'agent-2-output/site-brief.md',
  'agent-2-output/tool-spec.md',
  'agent-2-output/content-plan.md',
  'agent-2-output/seo-plan.md',
  'agent-2-output/ui-reference-dossier.md',
  'agent-2-output/design-generation-input.md',
];

const REQUIRED_SPEC_FIELDS = [
  ['keyword', ['keyword', 'primary keyword', '关键词']],
  ['target_domain', ['target domain', 'domain', '目标域名']],
  ['ui_reference', ['ui reference', 'ui 参考']],
  ['ux_reference', ['ux reference', 'ux 参考']],
];

const REQUIRED_PAGES = new Set(['/', '/privacy', '/terms', '/sitemap.xml', '/robots.txt']);
const SUGGESTED_OPTIONAL_PAGES = new Set([
  '/about',
  '/faq',
  '/guides',
  '/practice',
  '/modes',
  '/time-modes',
  '/formula',
  '/how-it-works',
  '/related-tools',
]);
const FORBIDDEN_BY_DEFAULT_PAGES = new Set([
  '/login',
  '/dashboard',
  '/account',
  '/pricing',
  '/leaderboard',
  '/api',
  '/blog',
]);
const APPROVED_STATUSES = new Set(['required', 'optional-recommended']);

const FORBIDDEN_FEATURES = [
  ['login', /\blog\s*in\b|\blogin\b/i],
  ['account', /\baccount\b/i],
  ['dashboard', /\bdashboard\b/i],
  ['pricing', /\bpricing\b/i],
  ['API', /\bapi\b/i],
  ['upload', /\bupload\b|\bfile\s+import\b|\bfile\s+upload\b/i],
  ['history', /\bhistory\b|\bsaved\s+history\b/i],
  ['AI rewrite', /\bai\s+(?:rewrite|rewriting|generate|generation|suggestion|suggestions)\b/i],
];

const NEGATION_PATTERN =
  /\b(no|not|without|never|reject(?:ed)?|forbidden|excluded|avoid|do not|don't|must not|should not)\b|不|不要|禁止|拒绝|排除/i;

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const args = { write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') {
      args.write = true;
    } else if (arg === '--run-dir') {
      args.runDir = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.runDir && !args.help) {
    throw new Error('Usage: node scripts/run/check-agent2-brief-compliance.mjs --run-dir runs/<site-id> [--write]');
  }
  return args;
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_]/g, '')
    .trim();
}

function normalizeText(value) {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLabel(value) {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[：:]/g, ':')
    .replace(/[^a-z0-9\u4e00-\u9fff/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findLabeledValue(text, aliases) {
  for (const line of String(text || '').split(/\r?\n/)) {
    const separatorIndex = line.search(/[：:]/);
    if (separatorIndex < 0) continue;
    const label = normalizeLabel(line.slice(0, separatorIndex));
    const value = stripMarkdown(line.slice(separatorIndex + 1));
    if (aliases.some((alias) => label.includes(normalizeLabel(alias)))) return value;
  }
  return '';
}

function parseSpecFields(specText) {
  const fields = {};
  for (const [key, aliases] of REQUIRED_SPEC_FIELDS) fields[key] = findLabeledValue(specText, aliases);
  return fields;
}

function meaningfulTokens(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !['the', 'and', 'for', 'with'].includes(token));
}

function valuePreserved(value, combinedText) {
  const normalizedValue = normalizeText(value);
  const normalizedText = normalizeText(combinedText);
  if (!normalizedValue) return null;
  if (normalizedText.includes(normalizedValue)) return true;
  const tokens = meaningfulTokens(value);
  if (tokens.length === 0) return null;
  return tokens.some((token) => normalizedText.includes(token));
}

function splitMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function normalizeHeader(value) {
  return normalizeText(value);
}

function normalizeRoute(value) {
  let route = stripMarkdown(value).trim();
  if (!route) return '';
  route = route.split(/\s+/)[0];
  if (/^https?:\/\//i.test(route)) {
    try {
      route = new URL(route).pathname;
    } catch {
      return '';
    }
  }
  if (!route.startsWith('/')) route = `/${route}`;
  route = route.replace(/\/{2,}/g, '/').toLowerCase();
  if (route.length > 1 && route.endsWith('/')) route = route.slice(0, -1);
  return route || '/';
}

function parsePagePlanTable(source) {
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const headerCells = splitMarkdownRow(lines[index]);
    if (!headerCells) continue;
    const headers = headerCells.map(normalizeHeader);
    if (!headers.includes('page') || !headers.includes('status') || !headers.includes('reason')) continue;
    const separator = splitMarkdownRow(lines[index + 1] || '');
    if (!separator || !isSeparatorRow(separator)) continue;
    const rows = [];
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const cells = splitMarkdownRow(lines[rowIndex]);
      if (!cells) break;
      const row = {};
      for (let cellIndex = 0; cellIndex < headers.length; cellIndex += 1) {
        row[headers[cellIndex]] = cells[cellIndex] || '';
      }
      rows.push(row);
    }
    return rows.map((row) => ({
      page: normalizeRoute(row.page),
      status: stripMarkdown(row.status).toLowerCase(),
      reason: stripMarkdown(row.reason),
    }));
  }
  return [];
}

async function readPagePlanEntries(runDir) {
  for (const relPath of ['agent-2-output/page-plan.md', 'agent-2-output/content-plan.md']) {
    const text = await readOptional(path.join(runDir, relPath));
    if (!text.trim()) continue;
    const entries = parsePagePlanTable(text);
    if (entries.length > 0) return { relPath, entries };
  }
  return { relPath: '', entries: [] };
}

function reasonMentionsExplicitUserRequest(reason) {
  return /\b(explicit\s+user\s+request|user\s+(?:requested|approved|confirmed)|human\s+approved|current\s+chat\s+approval|用户.*(?:要求|确认|批准))\b/i.test(
    reason,
  );
}

function findUnapprovedPages(entries) {
  const deviations = [];
  for (const entry of entries) {
    if (!APPROVED_STATUSES.has(entry.status)) continue;
    const defaultAllowed = REQUIRED_PAGES.has(entry.page) || SUGGESTED_OPTIONAL_PAGES.has(entry.page);
    if (FORBIDDEN_BY_DEFAULT_PAGES.has(entry.page)) {
      deviations.push(`unapproved page is approved in Agent2 Page Plan: ${entry.page}`);
    } else if (!defaultAllowed && !reasonMentionsExplicitUserRequest(entry.reason)) {
      deviations.push(`non-baseline page lacks explicit user approval in Agent2 Page Plan: ${entry.page}`);
    }
  }
  return deviations;
}

function findUnapprovedFeatureLines(combinedText) {
  const deviations = [];
  const lines = combinedText.split(/\r?\n/);
  for (const [label, pattern] of FORBIDDEN_FEATURES) {
    for (const line of lines) {
      const clean = stripMarkdown(line);
      if (!clean || !pattern.test(clean)) continue;
      if (NEGATION_PATTERN.test(clean)) continue;
      deviations.push(`unapproved feature reference (${label}): ${clean}`);
      break;
    }
  }
  return deviations;
}

async function readAgent2OutputText(runDir) {
  const parts = [];
  for (const relPath of REQUIRED_AGENT2_OUTPUTS) {
    const text = await readOptional(path.join(runDir, relPath));
    if (text.trim()) parts.push(`\n\n# ${relPath}\n\n${text}`);
  }
  return parts.join('\n');
}

function boolLabel(value, uncertain = false) {
  if (uncertain) return '不确定';
  return value ? '是' : '否';
}

export function renderComplianceSummary(result) {
  const deviations = result.deviations.length > 0 ? result.deviations.map((item) => `- ${item}`) : ['- 无'];
  return [
    '# Agent2 Brief Compliance Summary',
    '',
    'Agent2 Brief Compliance Summary',
    '',
    `1. 是否符合已确认 SPEC：${boolLabel(result.spec_aligned, result.status === 'uncertain')}`,
    `2. 是否新增未批准功能：${boolLabel(result.unapproved_features_found)}`,
    `3. 是否新增未批准页面：${boolLabel(result.unapproved_pages_found)}`,
    `4. 是否保留 UI/UX 方向：${boolLabel(result.ui_ux_direction_preserved, result.ui_ux_direction_preserved === null)}`,
    `5. Page Plan Gate 是否通过：${boolLabel(result.page_plan_passed)}`,
    `6. 是否可以进入 Agent2.5：${boolLabel(result.can_proceed_to_agent25)}`,
    '',
    '偏离点：',
    ...deviations,
    '',
  ].join('\n');
}

export async function runAgent2BriefComplianceCheck({ runDir }) {
  const absoluteRunDir = path.resolve(runDir);
  const deviations = [];
  const uncertain = [];
  const missingOutputs = [];

  for (const relPath of REQUIRED_AGENT2_OUTPUTS) {
    if (!(await exists(path.join(absoluteRunDir, relPath)))) missingOutputs.push(relPath);
  }
  for (const missing of missingOutputs) deviations.push(`missing Agent2 output: ${missing}`);

  const pagePlanResult = JSON.parse(await readOptional(path.join(absoluteRunDir, 'gate-results/page-plan.json')) || 'null');
  const pagePlanPassed = Boolean(pagePlanResult && pagePlanResult.status === 'pass' && pagePlanResult.passed === true);
  if (!pagePlanPassed) deviations.push('Page Plan Gate is missing or failing: gate-results/page-plan.json');

  const specText = await readOptional(path.join(absoluteRunDir, 'toolsite-spec.md'));
  const specFields = parseSpecFields(specText);
  for (const [key] of REQUIRED_SPEC_FIELDS) {
    if (!specFields[key]) uncertain.push(`required SPEC field is missing or unreadable: ${key}`);
  }

  const agent2Text = await readAgent2OutputText(absoluteRunDir);
  const keywordPreserved = valuePreserved(specFields.keyword, agent2Text);
  const domainPreserved = valuePreserved(specFields.target_domain, agent2Text);
  const uiPreserved = valuePreserved(specFields.ui_reference, agent2Text);
  const uxPreserved = valuePreserved(specFields.ux_reference, agent2Text);

  if (keywordPreserved === false) deviations.push(`Agent2 docs do not preserve SPEC keyword: ${specFields.keyword}`);
  if (domainPreserved === false) deviations.push(`Agent2 docs do not preserve target domain: ${specFields.target_domain}`);
  if (uiPreserved === false) uncertain.push(`Agent2 docs do not clearly preserve UI reference: ${specFields.ui_reference}`);
  if (uxPreserved === false) uncertain.push(`Agent2 docs do not clearly preserve UX reference: ${specFields.ux_reference}`);

  const featureDeviations = findUnapprovedFeatureLines(agent2Text);
  deviations.push(...featureDeviations);

  const { entries: pagePlanEntries } = await readPagePlanEntries(absoluteRunDir);
  if (pagePlanEntries.length === 0) deviations.push('Agent2 Page Plan table is missing or unreadable');
  const pageDeviations = findUnapprovedPages(pagePlanEntries);
  deviations.push(...pageDeviations);

  const hardDeviations = deviations.length > 0;
  const hasUncertainty = uncertain.length > 0;
  const status = hardDeviations ? 'fail' : hasUncertainty ? 'uncertain' : 'pass';
  const uiUxDirectionPreserved =
    uiPreserved === null || uxPreserved === null ? null : Boolean(uiPreserved && uxPreserved);
  const unapprovedFeaturesFound = featureDeviations.length > 0;
  const unapprovedPagesFound = pageDeviations.length > 0;
  const specAligned =
    !hardDeviations &&
    !hasUncertainty &&
    keywordPreserved === true &&
    domainPreserved === true &&
    uiUxDirectionPreserved === true;
  const canProceed = status === 'pass' && pagePlanPassed;

  return {
    gate: 'agent2-brief-compliance',
    runDir: absoluteRunDir,
    passed: canProceed,
    status,
    spec_aligned: specAligned,
    unapproved_features_found: unapprovedFeaturesFound,
    unapproved_pages_found: unapprovedPagesFound,
    ui_ux_direction_preserved: uiUxDirectionPreserved,
    page_plan_passed: pagePlanPassed,
    can_proceed_to_agent25: canProceed,
    deviations: [...deviations, ...uncertain],
    details: {
      required_outputs: REQUIRED_AGENT2_OUTPUTS,
      missing_outputs: missingOutputs,
      spec_fields: specFields,
      keyword_preserved: keywordPreserved,
      domain_preserved: domainPreserved,
      ui_reference_preserved: uiPreserved,
      ux_reference_preserved: uxPreserved,
      checked_page_count: pagePlanEntries.length,
    },
    evidence: {
      spec: 'toolsite-spec.md',
      pagePlanGate: 'gate-results/page-plan.json',
      summary: 'agent-2-output/brief-compliance-summary.md',
      output: 'gate-results/agent2-brief-compliance.json',
    },
    generatedAt: new Date().toISOString(),
  };
}

async function writeOutputs(runDir, result) {
  const gateDir = path.join(runDir, 'gate-results');
  const agent2Dir = path.join(runDir, 'agent-2-output');
  await mkdir(gateDir, { recursive: true });
  await mkdir(agent2Dir, { recursive: true });
  await writeFile(
    path.join(agent2Dir, 'brief-compliance-summary.md'),
    renderComplianceSummary(result),
    'utf8',
  );
  await writeFile(
    path.join(gateDir, 'agent2-brief-compliance.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );
}

function usage() {
  return [
    'Usage:',
    '  node scripts/run/check-agent2-brief-compliance.mjs --run-dir runs/<site-id> [--write]',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const result = await runAgent2BriefComplianceCheck({ runDir: args.runDir });
  if (args.write) await writeOutputs(path.resolve(args.runDir), result);

  console.log(`${result.status.toUpperCase()} Agent2 brief compliance`);
  if (result.deviations.length) {
    for (const deviation of result.deviations) console.log(`- ${deviation}`);
  }
  process.exitCode = result.passed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 2;
  });
}
