import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runPagePlanGate } from './check-page-plan.mjs';

async function makeRun() {
  const root = await mkdtemp(path.join(tmpdir(), 'page-plan-'));
  const runDir = path.join(root, 'runs', 'sample');
  await mkdir(path.join(runDir, 'agent-2-output'), { recursive: true });
  return runDir;
}

function pagePlan(rows) {
  return [
    '# Page Plan',
    '',
    '| page | type | status | reason | implementation owner |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

const REQUIRED_ROWS = [
  '| / | tool | required | Primary tool route. | Agent4 |',
  '| /privacy | legal | required | Required privacy page. | Agent4 |',
  '| /terms | legal | required | Required terms page. | Agent4 |',
  '| /sitemap.xml | system | required | Required search crawler sitemap. | Agent4 |',
  '| /robots.txt | system | required | Required crawler policy file. | Agent4 |',
];

async function writePlan(runDir, rows = REQUIRED_ROWS, file = 'page-plan.md') {
  await writeFile(path.join(runDir, 'agent-2-output', file), pagePlan(rows));
}

async function writeSite(runDir, { extraPages = [], sitemapRoutes = ['/', '/privacy/', '/terms/'], robots = true } = {}) {
  const pagesDir = path.join(runDir, 'site/src/pages');
  await mkdir(pagesDir, { recursive: true });
  await writeFile(path.join(pagesDir, 'index.astro'), '<main>Tool</main>');
  await writeFile(path.join(pagesDir, 'privacy.astro'), '<main>Privacy</main>');
  await writeFile(path.join(pagesDir, 'terms.astro'), '<main>Terms</main>');
  await writeFile(path.join(pagesDir, 'sitemap.xml.ts'), `const pages = ${JSON.stringify(sitemapRoutes)};`);
  if (robots) await writeFile(path.join(pagesDir, 'robots.txt.ts'), 'User-agent: *\\nAllow: /\\nSitemap: https://example.com/sitemap.xml');
  for (const route of extraPages) {
    const name = route.replace(/^\//, '');
    await writeFile(path.join(pagesDir, `${name}.astro`), `<main>${name}</main>`);
  }
}

test('passes a valid Agent2 page plan before implementation exists', async () => {
  const runDir = await makeRun();
  await writePlan(runDir);

  const result = await runPagePlanGate({ runDir });
  assert.equal(result.passed, true);
  assert.equal(result.details.implementationCheckSkipped, true);
});

test('accepts the page plan table inside content-plan.md', async () => {
  const runDir = await makeRun();
  await writePlan(runDir, REQUIRED_ROWS, 'content-plan.md');

  const result = await runPagePlanGate({ runDir });
  assert.equal(result.passed, true);
  assert.equal(result.details.planPath, 'agent-2-output/content-plan.md');
});

test('passes when implemented pages, sitemap, and robots match approved plan', async () => {
  const runDir = await makeRun();
  await writePlan(runDir, [...REQUIRED_ROWS, '| /faq | seo | optional-recommended | Useful SEO support page. | Agent4 |']);
  await writeSite(runDir, { extraPages: ['/faq'], sitemapRoutes: ['/', '/privacy/', '/terms/', '/faq/'] });

  const result = await runPagePlanGate({ runDir });
  assert.equal(result.passed, true);
});

test('fails when page plan table is missing', async () => {
  const runDir = await makeRun();
  await writeFile(path.join(runDir, 'agent-2-output/content-plan.md'), '# Content Plan\\nNo table here.');

  const result = await runPagePlanGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /missing page plan table/);
});

test('fails when a required page is omitted or not marked required', async () => {
  const runDir = await makeRun();
  await writePlan(
    runDir,
    REQUIRED_ROWS.filter((row) => !row.startsWith('| /privacy ')).concat(
      '| /terms | legal | optional-recommended | Terms is important. | Agent4 |',
    ),
  );

  const result = await runPagePlanGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /missing required page plan row: \/privacy/);
  assert.match(result.failures.join('\n'), /\/terms must have status required/);
});

test('fails when forbidden pages are approved without explicit user request', async () => {
  const runDir = await makeRun();
  await writePlan(runDir, [
    ...REQUIRED_ROWS,
    '| /login | app | optional-recommended | Common SaaS page. | Agent4 |',
    '| /blog/typing-tips | content | optional-recommended | Common SEO page. | Agent4 |',
  ]);

  const result = await runPagePlanGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /\/login is forbidden unless/);
  assert.match(result.failures.join('\n'), /\/blog\/typing-tips is forbidden unless/);
});

test('passes forbidden page only when explicit user request is recorded', async () => {
  const runDir = await makeRun();
  await writePlan(runDir, [...REQUIRED_ROWS, '| /login | app | optional-recommended | Explicit user request for gated beta access. | Agent4 |']);

  const result = await runPagePlanGate({ runDir });
  assert.equal(result.passed, true);
});

test('fails when implementation adds unplanned or rejected pages', async () => {
  const runDir = await makeRun();
  await writePlan(runDir, [...REQUIRED_ROWS, '| /blog | content | rejected | Blog is forbidden for this tool site. | none |']);
  await writeSite(runDir, { extraPages: ['/blog'] });

  const result = await runPagePlanGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /implemented page is not approved.*\/blog/);
  assert.match(result.failures.join('\n'), /rejected or optional-not-needed page is implemented: \/blog/);
});

test('fails when sitemap or robots do not cover approved pages correctly', async () => {
  const runDir = await makeRun();
  await writePlan(runDir, [...REQUIRED_ROWS, '| /faq | seo | optional-recommended | Useful SEO support page. | Agent4 |']);
  await writeSite(runDir, { extraPages: ['/faq'], sitemapRoutes: ['/', '/privacy/', '/terms/'], robots: false });

  const result = await runPagePlanGate({ runDir });
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /sitemap does not include approved page: \/faq/);
  assert.match(result.failures.join('\n'), /missing robots.txt implementation/);
});

test('writes page-plan gate result through CLI --write', async () => {
  const runDir = await makeRun();
  await writePlan(runDir);

  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, ['scripts/qa/check-page-plan.mjs', '--run-dir', runDir, '--write'], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const written = JSON.parse(await readFile(path.join(runDir, 'gate-results/page-plan.json'), 'utf8'));
  assert.equal(written.gate, 'page-plan');
  assert.equal(written.passed, true);
});
