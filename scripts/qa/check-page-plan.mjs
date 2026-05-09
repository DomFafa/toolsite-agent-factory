#!/usr/bin/env node
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { resultFromFailures, writeGateResult } from '../run/gate-result-utils.mjs';

const REQUIRED_COLUMNS = ['page', 'type', 'status', 'reason', 'implementation owner'];
const ALLOWED_STATUSES = new Set(['required', 'optional-recommended', 'optional-not-needed', 'rejected']);
const REQUIRED_PAGES = ['/', '/privacy', '/terms', '/sitemap.xml', '/robots.txt'];
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
const SYSTEM_ROUTES = new Set(['/sitemap.xml', '/robots.txt']);
const APPROVED_STATUSES = new Set(['required', 'optional-recommended']);

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
    throw new Error('Usage: node scripts/qa/check-page-plan.mjs --run-dir runs/<site-id> [--write]');
  }
  return args;
}

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

async function isDirectory(filePath) {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*]/g, '')
    .trim();
}

function normalizeHeader(value) {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeRoute(value) {
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

function parsePagePlanTable(source) {
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const headerCells = splitMarkdownRow(lines[index]);
    if (!headerCells) continue;
    const normalizedHeader = headerCells.map(normalizeHeader);
    if (!REQUIRED_COLUMNS.every((column) => normalizedHeader.includes(column))) continue;
    const separator = splitMarkdownRow(lines[index + 1] || '');
    if (!separator || !isSeparatorRow(separator)) continue;

    const rows = [];
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const rowCells = splitMarkdownRow(lines[rowIndex]);
      if (!rowCells) break;
      const row = {};
      for (let cellIndex = 0; cellIndex < normalizedHeader.length; cellIndex += 1) {
        row[normalizedHeader[cellIndex]] = rowCells[cellIndex] || '';
      }
      rows.push(row);
    }
    return { rows, startLine: index + 1 };
  }
  return null;
}

async function readPagePlan(runDir) {
  const candidates = [
    'agent-2-output/page-plan.md',
    'agent-2-output/content-plan.md',
  ];
  for (const relPath of candidates) {
    const text = await readOptional(path.join(runDir, relPath));
    if (!text.trim()) continue;
    const table = parsePagePlanTable(text);
    if (table) return { relPath, text, table };
  }
  return { relPath: '', text: '', table: null };
}

function reasonMentionsExplicitUserRequest(reason) {
  return /\b(explicit\s+user\s+request|user\s+(?:requested|approved|confirmed)|human\s+approved|current\s+chat\s+approval|用户.*(?:要求|确认|批准))\b/i.test(
    reason,
  );
}

function isForbiddenByDefault(route) {
  return [...FORBIDDEN_BY_DEFAULT_PAGES].some((forbiddenRoute) => route === forbiddenRoute || route.startsWith(`${forbiddenRoute}/`));
}

function rowToPlanEntry(row) {
  return {
    page: normalizeRoute(row.page),
    rawPage: stripMarkdown(row.page),
    type: stripMarkdown(row.type),
    status: stripMarkdown(row.status).toLowerCase(),
    reason: stripMarkdown(row.reason),
    implementationOwner: stripMarkdown(row['implementation owner']),
  };
}

function validatePlan(planEntries) {
  const failures = [];
  const byPage = new Map();

  if (planEntries.length === 0) failures.push('page plan table has no page rows');

  for (const entry of planEntries) {
    if (!entry.page) failures.push(`page plan row has invalid page value: ${entry.rawPage || '(empty)'}`);
    if (byPage.has(entry.page)) failures.push(`duplicate page plan row: ${entry.page}`);
    byPage.set(entry.page, entry);

    if (!ALLOWED_STATUSES.has(entry.status)) {
      failures.push(`invalid status for ${entry.page}: ${entry.status || '(empty)'}`);
    }
    if (!entry.type) failures.push(`${entry.page} is missing type`);
    if (!entry.reason) failures.push(`${entry.page} is missing reason`);
    if (!entry.implementationOwner) failures.push(`${entry.page} is missing implementation owner`);

    if (SUGGESTED_OPTIONAL_PAGES.has(entry.page) && !entry.reason) {
      failures.push(`${entry.page} optional page is missing Agent2 reason`);
    }

    if (
      isForbiddenByDefault(entry.page) &&
      APPROVED_STATUSES.has(entry.status) &&
      !reasonMentionsExplicitUserRequest(entry.reason)
    ) {
      failures.push(`${entry.page} is forbidden unless the reason records an explicit user request`);
    }
  }

  for (const requiredPage of REQUIRED_PAGES) {
    const entry = byPage.get(requiredPage);
    if (!entry) {
      failures.push(`missing required page plan row: ${requiredPage}`);
    } else if (entry.status !== 'required') {
      failures.push(`${requiredPage} must have status required`);
    }
  }

  return { failures, byPage };
}

function routeFromSourcePage(filePath, pagesRoot) {
  const rel = path.relative(pagesRoot, filePath).replace(/\\/g, '/');
  const withoutExtension = rel.replace(/\.(astro|md|mdx|html|js|ts)$/, '');
  let route = withoutExtension;
  route = route.replace(/\/index$/, '');
  route = route.replace(/index$/, '');
  if (!route) route = '/';
  return normalizeRoute(route);
}

function routeFromDistFile(filePath, distRoot) {
  const rel = path.relative(distRoot, filePath).replace(/\\/g, '/');
  if (rel === 'robots.txt' || rel === 'sitemap.xml') return normalizeRoute(rel);
  if (!rel.endsWith('.html')) return '';
  const withoutExtension = rel.replace(/\.html$/, '');
  let route = withoutExtension.replace(/\/index$/, '').replace(/index$/, '');
  if (!route) route = '/';
  return normalizeRoute(route);
}

async function walkFiles(root) {
  if (!(await isDirectory(root))) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.astro') continue;
      files.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function discoverImplementedRoutes(siteDir) {
  const routeToFiles = new Map();
  const addRoute = (route, filePath) => {
    if (!route) return;
    const files = routeToFiles.get(route) || [];
    files.push(path.relative(siteDir, filePath).replace(/\\/g, '/'));
    routeToFiles.set(route, files);
  };

  const pagesRoot = path.join(siteDir, 'src/pages');
  for (const file of await walkFiles(pagesRoot)) {
    if (/\.(astro|md|mdx|html|js|ts)$/.test(file)) addRoute(routeFromSourcePage(file, pagesRoot), file);
  }

  const publicRoot = path.join(siteDir, 'public');
  for (const systemFile of ['robots.txt', 'sitemap.xml']) {
    const fullPath = path.join(publicRoot, systemFile);
    if (await exists(fullPath)) addRoute(normalizeRoute(systemFile), fullPath);
  }

  const distRoot = path.join(siteDir, 'dist');
  for (const file of await walkFiles(distRoot)) {
    addRoute(routeFromDistFile(file, distRoot), file);
  }

  return routeToFiles;
}

async function readFirstExisting(paths) {
  for (const filePath of paths) {
    const text = await readOptional(filePath);
    if (text.trim()) return { filePath, text };
  }
  return { filePath: '', text: '' };
}

function sitemapContainsRoute(sitemapText, route) {
  const normalizedRoute = normalizeRoute(route);
  const locRoutes = [...sitemapText.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => normalizeRoute(match[1]));
  if (locRoutes.length > 0) return locRoutes.includes(normalizedRoute);
  const slashRoute = normalizedRoute === '/' ? '/' : `${normalizedRoute}/`;
  return (
    new RegExp(`['"\`]${normalizedRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`).test(sitemapText) ||
    new RegExp(`['"\`]${slashRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`).test(sitemapText)
  );
}

async function validateImplementation({ runDir, byPage }) {
  const failures = [];
  const siteDir = path.join(runDir, 'site');
  const siteHasImplementation =
    (await isDirectory(path.join(siteDir, 'src/pages'))) ||
    (await isDirectory(path.join(siteDir, 'dist'))) ||
    (await isDirectory(path.join(siteDir, 'public')));

  if (!siteHasImplementation) {
    return {
      failures,
      skipped: true,
      implementedRoutes: [],
      approvedRoutes: [],
      rejectedRoutes: [],
      sitemapPath: '',
      robotsPath: '',
    };
  }

  const implemented = await discoverImplementedRoutes(siteDir);
  const implementedRoutes = [...implemented.keys()].sort();
  const approvedRoutes = [...byPage.values()]
    .filter((entry) => APPROVED_STATUSES.has(entry.status))
    .map((entry) => entry.page)
    .sort();
  const rejectedRoutes = [...byPage.values()]
    .filter((entry) => !APPROVED_STATUSES.has(entry.status))
    .map((entry) => entry.page)
    .sort();
  const approvedSet = new Set(approvedRoutes);

  for (const requiredPage of REQUIRED_PAGES) {
    if (!implemented.has(requiredPage)) failures.push(`required page is not implemented: ${requiredPage}`);
  }

  for (const route of implementedRoutes) {
    if (!approvedSet.has(route)) {
      failures.push(`implemented page is not approved by Agent2 page plan: ${route} (${implemented.get(route).join(', ')})`);
    }
  }

  for (const route of rejectedRoutes) {
    if (implemented.has(route)) failures.push(`rejected or optional-not-needed page is implemented: ${route}`);
  }

  for (const route of implementedRoutes.filter(isForbiddenByDefault)) {
    const entry = byPage.get(route);
    if (!entry || !APPROVED_STATUSES.has(entry.status)) {
      failures.push(`forbidden page is implemented without approved page-plan row: ${route}`);
    }
  }

  const sitemap = await readFirstExisting([
    path.join(siteDir, 'dist/sitemap.xml'),
    path.join(siteDir, 'public/sitemap.xml'),
    path.join(siteDir, 'src/pages/sitemap.xml.ts'),
    path.join(siteDir, 'src/pages/sitemap.xml.js'),
  ]);
  if (!sitemap.text.trim()) {
    failures.push('missing sitemap implementation');
  } else {
    for (const route of approvedRoutes.filter((approvedRoute) => !SYSTEM_ROUTES.has(approvedRoute))) {
      if (!sitemapContainsRoute(sitemap.text, route)) {
        failures.push(`sitemap does not include approved page: ${route}`);
      }
    }
  }

  const robots = await readFirstExisting([
    path.join(siteDir, 'dist/robots.txt'),
    path.join(siteDir, 'public/robots.txt'),
    path.join(siteDir, 'src/pages/robots.txt.ts'),
    path.join(siteDir, 'src/pages/robots.txt.js'),
  ]);
  if (!robots.text.trim()) {
    failures.push('missing robots.txt implementation');
  } else {
    if (!/user-agent/i.test(robots.text)) failures.push('robots.txt is missing User-agent directive');
    if (!/sitemap\s*:/i.test(robots.text)) failures.push('robots.txt is missing Sitemap directive');
  }

  return {
    failures,
    skipped: false,
    implementedRoutes,
    approvedRoutes,
    rejectedRoutes,
    sitemapPath: sitemap.filePath ? path.relative(runDir, sitemap.filePath).replace(/\\/g, '/') : '',
    robotsPath: robots.filePath ? path.relative(runDir, robots.filePath).replace(/\\/g, '/') : '',
  };
}

export async function runPagePlanGate({ runDir }) {
  const absoluteRunDir = path.resolve(runDir);
  const failures = [];
  const { relPath, table } = await readPagePlan(absoluteRunDir);

  if (!table) {
    failures.push('missing page plan table with columns: page | type | status | reason | implementation owner');
    return resultFromFailures({
      gate: 'page-plan',
      runDir: absoluteRunDir,
      failures,
      details: { planPath: relPath || null, implementationCheckSkipped: true },
      evidence: { plan: relPath || 'agent-2-output/page-plan.md or agent-2-output/content-plan.md' },
    });
  }

  const planEntries = table.rows.map(rowToPlanEntry);
  const planValidation = validatePlan(planEntries);
  failures.push(...planValidation.failures);
  const implementation = await validateImplementation({ runDir: absoluteRunDir, byPage: planValidation.byPage });
  failures.push(...implementation.failures);

  return resultFromFailures({
    gate: 'page-plan',
    runDir: absoluteRunDir,
    failures,
    details: {
      planPath: relPath,
      tableStartLine: table.startLine,
      requiredPages: REQUIRED_PAGES,
      suggestedOptionalPages: [...SUGGESTED_OPTIONAL_PAGES],
      forbiddenByDefaultPages: [...FORBIDDEN_BY_DEFAULT_PAGES],
      implementationCheckSkipped: implementation.skipped,
      implementedRoutes: implementation.implementedRoutes,
      approvedRoutes: implementation.approvedRoutes,
      rejectedRoutes: implementation.rejectedRoutes,
    },
    evidence: {
      plan: relPath,
      sitemap: implementation.sitemapPath,
      robots: implementation.robotsPath,
      output: 'gate-results/page-plan.json',
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runPagePlanGate({ runDir: args.runDir });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'page-plan.json', result);
  console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} page plan`);
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
