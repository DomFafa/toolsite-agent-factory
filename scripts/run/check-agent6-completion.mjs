#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readJsonOptional, readTextOptional, resultFromFailures, writeGateResult } from './gate-result-utils.mjs';

const LAUNCH_REPORT_PATH = 'agent-6-output/launch-report.md';

const REQUIRED_GATES = [
  {
    key: 'pages_deployment',
    label: 'Pages deployment completed',
    aliases: ['pages deployment', 'pages deployment completed', 'cloudflare pages deployment'],
  },
  {
    key: 'apex_custom_domain',
    label: 'apex custom domain active',
    aliases: ['apex custom domain', 'apex custom domain active', 'apex domain bound'],
  },
  {
    key: 'www_custom_domain',
    label: 'www custom domain active',
    aliases: ['www custom domain', 'www custom domain active', 'www domain bound'],
  },
  {
    key: 'dns_switched_to_pages',
    label: 'DNS switched from old provider to Cloudflare Pages',
    aliases: ['dns switched to cloudflare pages', 'dns records point to pages', 'dns switched from old provider to cloudflare pages'],
  },
  {
    key: 'email_routing_catch_all',
    label: 'Email Routing catch-all completed',
    aliases: ['email routing catch all', 'email routing catch-all', 'cloudflare email routing catch all'],
  },
  {
    key: 'speed_settings',
    label: 'Cloudflare Speed Settings completed',
    aliases: ['cloudflare speed settings', 'speed settings', 'enable all available settings'],
  },
  {
    key: 'image_transformations',
    label: 'Cloudflare Images / Transformations enabled',
    aliases: ['cloudflare images transformations', 'image transformations', 'images transformations'],
  },
  {
    key: 'web_analytics',
    label: 'Cloudflare Web Analytics token created/reused, injected, redeployed, and beacon verified',
    aliases: ['cloudflare web analytics', 'web analytics', 'web analytics beacon'],
  },
  {
    key: 'indexnow',
    label: 'IndexNow completed',
    aliases: ['indexnow', 'index now'],
  },
  {
    key: 'google_search_console',
    label: 'Google Search Console completed or hard blocker recorded',
    aliases: ['google search console', 'gsc'],
  },
  {
    key: 'bing_webmaster_tools',
    label: 'Bing Webmaster Tools completed or hard blocker recorded',
    aliases: ['bing webmaster tools', 'bing webmaster', 'bing'],
  },
  {
    key: 'api_first_fallback',
    label: 'API-first fallback recorded when API/permission errors occur',
    aliases: ['api first fallback', 'api-first fallback', 'api fallback', 'dashboard fallback'],
  },
];

const FINAL_STATUSES = new Set(['full_launch_completed', 'partial_launch_blocked']);
const COMPLETED_PATTERN = /\b(completed|complete|passed|pass|done|verified|active|enabled)\b/i;
const HARD_BLOCKER_PATTERN = /\b(hard[-_\s]*blocker|blocked|blocker)\b/i;
const EMPTY_PATTERN = /^(?:|n\/a|na|none|null|-|tbd|pending|not\s+applicable)$/i;
const INCOMPLETE_PATTERN = /\b(pending|todo|not\s+started|incomplete|missing|skipped|failed|fail|partial)\b/i;
const API_FAILURE_PATTERN =
  /\b(?:403|authentication\s+error|code\s*10000|permission\s+denied|read[-\s]*only\s+token|unsupported\s+endpoint|api\s+(?:failed|failure|error)|token\s+lacks|lacks\s+permission|cannot\s+edit\s+dns|dns\s+permissions|wrangler\s+.*cannot)\b/i;
const DASHBOARD_FALLBACK_PATTERN = /\b(?:web-access|dashboard\s+same[-\s]*origin|dashboard\s+fallback|manual\s+dashboard|cloudflare\s+dashboard)\b/i;

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
    throw new Error('Usage: node scripts/run/check-agent6-completion.mjs --run-dir runs/<site-id> [--write]');
  }
  return args;
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*]/g, '')
    .trim();
}

function normalize(value) {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nonEmpty(value) {
  return !EMPTY_PATTERN.test(stripMarkdown(value));
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

function findLaunchGateTable(reportText) {
  const lines = reportText.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const headerCells = splitMarkdownRow(lines[index]);
    if (!headerCells) continue;
    const normalizedHeader = headerCells.map(normalize);
    const hasRequiredHeader =
      normalizedHeader.includes('gate') &&
      normalizedHeader.includes('status') &&
      normalizedHeader.includes('evidence') &&
      normalizedHeader.includes('hard blocker') &&
      normalizedHeader.includes('next action');
    if (!hasRequiredHeader) continue;

    const separator = splitMarkdownRow(lines[index + 1] || '');
    if (!separator || !isSeparatorRow(separator)) continue;

    const rows = [];
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const rowCells = splitMarkdownRow(lines[rowIndex]);
      if (!rowCells) break;
      if (rowCells.length < headerCells.length) continue;
      const row = {};
      for (let cellIndex = 0; cellIndex < headerCells.length; cellIndex += 1) {
        row[normalizedHeader[cellIndex]] = rowCells[cellIndex] || '';
      }
      rows.push(row);
    }
    return rows;
  }
  return null;
}

function gateForRow(gateValue) {
  const normalizedGate = normalize(gateValue);
  return REQUIRED_GATES.find((gate) =>
    gate.aliases.some((alias) => {
      const normalizedAlias = normalize(alias);
      return normalizedGate === normalizedAlias || normalizedGate.includes(normalizedAlias);
    }),
  );
}

function parseGateRows(rows) {
  const byGate = new Map();
  for (const row of rows || []) {
    const gate = gateForRow(row.gate);
    if (!gate) continue;
    byGate.set(gate.key, {
      gate: row.gate,
      status: row.status || '',
      evidence: row.evidence || '',
      hardBlocker: row['hard blocker'] || '',
      nextAction: row['next action'] || '',
    });
  }
  return byGate;
}

function classifyRow(row) {
  const status = stripMarkdown(row?.status || '');
  const statusText = normalize(status);
  if (!row) return 'missing';
  if (HARD_BLOCKER_PATTERN.test(status) || HARD_BLOCKER_PATTERN.test(row.hardBlocker || '')) return 'hard_blocker';
  if (INCOMPLETE_PATTERN.test(status) || !nonEmpty(status)) return 'incomplete';
  if (COMPLETED_PATTERN.test(statusText)) return 'completed';
  return 'incomplete';
}

function extractFinalStatus(reportText, state) {
  const lines = reportText.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => /^##\s+Final status\s*$/i.test(line.trim()));
  const sectionLines = [];
  if (startIndex >= 0) {
    for (let index = startIndex + 1; index < lines.length; index += 1) {
      if (/^##\s+/.test(lines[index].trim())) break;
      sectionLines.push(lines[index]);
    }
  }
  const section = sectionLines.join('\n');
  for (const line of section.split(/\r?\n/)) {
    const cleaned = stripMarkdown(line).trim().replace(/\.$/, '');
    const statusMatch = cleaned.match(/^(?:final\s+status|status)\s*:\s*(full_launch_completed|partial_launch_blocked|launched)$/i);
    if (statusMatch) return statusMatch[1].toLowerCase();
    if (/^(?:full_launch_completed|partial_launch_blocked|launched)$/i.test(cleaned)) return cleaned.toLowerCase();
  }
  const stateStatus = normalize(state?.status || state?.launch?.status || '');
  if (stateStatus === 'full launch completed') return 'full_launch_completed';
  if (stateStatus === 'partial launch blocked') return 'partial_launch_blocked';
  if (stateStatus === 'launched') return 'launched';
  return '';
}

function summarizeRows(gateRows) {
  return Object.fromEntries(
    REQUIRED_GATES.map((gate) => {
      const row = gateRows.get(gate.key);
      return [
        gate.key,
        {
          label: gate.label,
          status: row?.status || 'missing',
          classification: classifyRow(row),
        },
      ];
    }),
  );
}

export async function runAgent6CompletionGate({ runDir }) {
  const absoluteRunDir = path.resolve(runDir);
  const failures = [];
  const reportPath = path.join(absoluteRunDir, LAUNCH_REPORT_PATH);
  const reportText = await readTextOptional(reportPath);
  const state = await readJsonOptional(path.join(absoluteRunDir, 'state.json'));

  if (!reportText.trim()) {
    failures.push(`missing ${LAUNCH_REPORT_PATH}`);
  }

  const rows = findLaunchGateTable(reportText);
  if (!rows) {
    failures.push(`${LAUNCH_REPORT_PATH} must include required launch gates table: gate | status | evidence | hard blocker | next action`);
  }

  const gateRows = parseGateRows(rows);
  const completed = [];
  const hardBlocked = [];
  const missingOrIncomplete = [];

  for (const gate of REQUIRED_GATES) {
    const row = gateRows.get(gate.key);
    const classification = classifyRow(row);
    if (classification === 'missing') {
      missingOrIncomplete.push(gate.label);
      failures.push(`missing required launch gate row: ${gate.label}`);
      continue;
    }

    if (classification === 'completed') {
      if (!nonEmpty(row.evidence)) {
        failures.push(`${gate.label} is completed but missing evidence`);
      }
      completed.push(gate.key);
      continue;
    }

    if (classification === 'hard_blocker') {
      if (!nonEmpty(row.evidence)) failures.push(`${gate.label} hard blocker is missing evidence`);
      if (!nonEmpty(row.hardBlocker)) failures.push(`${gate.label} hard blocker column is empty`);
      if (!nonEmpty(row.nextAction)) failures.push(`${gate.label} hard blocker is missing next action`);
      hardBlocked.push(gate.key);
      continue;
    }

    missingOrIncomplete.push(gate.label);
    failures.push(`${gate.label} is not completed and has no valid hard blocker`);
  }

  const reportAndStateText = `${reportText}\n${JSON.stringify(state || {})}`;
  const apiFailureRecorded = API_FAILURE_PATTERN.test(reportAndStateText);
  const fallbackRecorded = DASHBOARD_FALLBACK_PATTERN.test(reportAndStateText);
  if (apiFailureRecorded && !fallbackRecorded) {
    failures.push('API/permission failure recorded without web-access/Cloudflare Dashboard fallback attempt');
  }

  const finalStatus = extractFinalStatus(reportText, state);
  if (!FINAL_STATUSES.has(finalStatus)) {
    failures.push('final status must be exactly full_launch_completed or partial_launch_blocked');
  }

  const allCompleted = completed.length === REQUIRED_GATES.length && hardBlocked.length === 0 && missingOrIncomplete.length === 0;
  const hasValidBlocker =
    hardBlocked.length > 0 &&
    missingOrIncomplete.length === 0 &&
    hardBlocked.every((key) => {
      const row = gateRows.get(key);
      return nonEmpty(row?.evidence) && nonEmpty(row?.hardBlocker) && nonEmpty(row?.nextAction);
    });

  if (allCompleted && finalStatus !== 'full_launch_completed') {
    failures.push('all required launch gates are completed, so final status must be full_launch_completed');
  }

  if (!allCompleted && finalStatus === 'full_launch_completed') {
    failures.push('full_launch_completed is forbidden unless every required launch gate is completed');
  }

  if (hasValidBlocker && finalStatus !== 'partial_launch_blocked') {
    failures.push('hard blockers require final status partial_launch_blocked');
  }

  if (missingOrIncomplete.length > 0 && /\b(?:launched|full_launch_completed|full\s+launch\s+completed)\b/i.test(reportAndStateText)) {
    failures.push('launch-report/state claims launched/full launch completed while required gates are missing or incomplete');
  }

  return resultFromFailures({
    gate: 'agent6-completion',
    runDir: absoluteRunDir,
    failures,
    details: {
      finalStatus,
      requiredGateCount: REQUIRED_GATES.length,
      completed,
      hardBlocked,
      missingOrIncomplete,
      apiFailureRecorded,
      dashboardFallbackRecorded: fallbackRecorded,
      gates: summarizeRows(gateRows),
    },
    evidence: {
      launchReport: LAUNCH_REPORT_PATH,
      state: 'state.json',
      output: 'gate-results/agent6-completion.json',
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runAgent6CompletionGate({ runDir: args.runDir });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'agent6-completion.json', result);
  console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} Agent6 completion`);
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
