#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const url = process.argv[2];

if (!url) {
  console.error('Usage: node scripts/qa/check-centered-layout.mjs <url>');
  process.exit(2);
}

const browseBin = process.env.GSTACK_BROWSE
  || path.join(os.homedir(), '.codex/skills/gstack/browse/dist/browse');

const viewport = '2048x734';
const maxCenterDelta = 1;

const geometryExpression = `(() => {
  const tool = document.querySelector('.tool-panel')?.getBoundingClientRect();
  const section = document.querySelector('.content-band')?.getBoundingClientRect();
  if (!tool || !section) {
    return JSON.stringify({ error: 'missing .tool-panel or .content-band' });
  }
  const pageCenter = innerWidth / 2;
  return JSON.stringify({
    innerWidth,
    toolLeft: Math.round(tool.left),
    toolRight: Math.round(tool.right),
    toolCenterDelta: Math.round((tool.left + tool.width / 2) - pageCenter),
    sectionLeft: Math.round(section.left),
    sectionRight: Math.round(section.right),
    sectionCenterDelta: Math.round((section.left + section.width / 2) - pageCenter),
    bodyScrollWidth: document.documentElement.scrollWidth
  });
})()`;

const chain = [
  ['viewport', viewport],
  ['goto', url],
  ['wait', '--networkidle'],
  ['js', geometryExpression],
];

const result = spawnSync(browseBin, ['chain'], {
  input: JSON.stringify(chain),
  encoding: 'utf8',
});

if (result.error) {
  console.error(`FAIL could not run browse: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const jsLine = result.stdout.split('\n').find((line) => line.startsWith('[js] '));

if (!jsLine) {
  console.error('FAIL missing browser geometry output');
  process.exit(1);
}

let metrics;
try {
  metrics = JSON.parse(jsLine.slice(5));
} catch (error) {
  console.error(`FAIL could not parse browser geometry: ${error.message}`);
  process.exit(1);
}

if (metrics.error) {
  console.error(`FAIL ${metrics.error}`);
  process.exit(1);
}

const failures = [];

if (Math.abs(metrics.toolCenterDelta) > maxCenterDelta) {
  failures.push(`tool panel center delta ${metrics.toolCenterDelta}px`);
}

if (Math.abs(metrics.sectionCenterDelta) > maxCenterDelta) {
  failures.push(`content section center delta ${metrics.sectionCenterDelta}px`);
}

if (metrics.bodyScrollWidth > metrics.innerWidth) {
  failures.push(`horizontal overflow ${metrics.bodyScrollWidth}px > ${metrics.innerWidth}px`);
}

if (failures.length > 0) {
  console.error(`FAIL centered layout: ${failures.join('; ')}`);
  console.error(JSON.stringify(metrics, null, 2));
  process.exit(1);
}

console.log('PASS centered layout');
console.log(JSON.stringify(metrics, null, 2));
