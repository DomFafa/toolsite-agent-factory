#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
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
    } else if (arg === '--url') {
      args.url = argv[index + 1];
      index += 1;
    }
  }
  if (!args.runDir || !args.url) {
    throw new Error('Usage: node scripts/qa/check-final-visual-lock.mjs --run-dir runs/<site-id> --url <local-url> [--write]');
  }
  return args;
}

function runBrowse(chain) {
  const browseBin = process.env.GSTACK_BROWSE
    || path.join(os.homedir(), '.codex/skills/gstack/browse/dist/browse');
  const result = spawnSync(browseBin, ['chain'], {
    input: JSON.stringify(chain),
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${result.stdout}\n${result.stderr}`.trim());
  }
  return result.stdout;
}

function parseJsOutput(stdout) {
  const line = stdout.split('\n').find((entry) => entry.startsWith('[js] '));
  if (!line) throw new Error('missing browse js output');
  return JSON.parse(line.slice(5));
}

const geometryExpression = `(() => {
  const main = document.querySelector('main');
  const tool = document.querySelector('.tool-panel, .calculator-shell, .tool-shell, [data-tool-root], main > section');
  const firstContent = document.querySelector('.content-band, .faq-section, main > section:nth-of-type(2)');
  const rect = (element) => {
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return {
      left: Math.round(box.left),
      right: Math.round(box.right),
      top: Math.round(box.top),
      bottom: Math.round(box.bottom),
      width: Math.round(box.width),
      height: Math.round(box.height),
      centerDelta: Math.round((box.left + box.width / 2) - (innerWidth / 2))
    };
  };
  return JSON.stringify({
    innerWidth,
    innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    main: rect(main),
    tool: rect(tool),
    firstContent: rect(firstContent),
    visibleText: document.body.innerText.slice(0, 3000)
  });
})()`;

export async function runFinalVisualLockGate({ runDir, url }) {
  const absoluteRunDir = path.resolve(runDir);
  const screenshotDir = path.join(absoluteRunDir, 'agent-5-output/final-visual-lock');
  await mkdir(screenshotDir, { recursive: true });

  const viewports = [
    ['desktop', '1440x900'],
    ['mobile', '390x844'],
    ['wide', '2048x734'],
  ];
  const failures = [];
  const details = {};
  const evidence = { url, screenshots: {} };

  for (const [name, viewport] of viewports) {
    const screenshotPath = path.join(screenshotDir, `${name}.png`);
    const stdout = runBrowse([
      ['viewport', viewport],
      ['goto', url],
      ['wait', '--networkidle'],
      ['js', geometryExpression],
      ['screenshot', '--viewport', screenshotPath],
    ]);
    const geometry = parseJsOutput(stdout);
    details[name] = geometry;
    evidence.screenshots[name] = path.relative(absoluteRunDir, screenshotPath);

    if (geometry.scrollWidth > geometry.innerWidth) {
      failures.push(`${name}: horizontal overflow ${geometry.scrollWidth}px > ${geometry.innerWidth}px`);
    }
    if (!geometry.tool || geometry.tool.width < 280 || geometry.tool.height < 220) {
      failures.push(`${name}: usable tool surface was not detected in the viewport`);
    }
    if (name === 'wide' && geometry.tool && Math.abs(geometry.tool.centerDelta) > 2) {
      failures.push(`${name}: tool surface center delta ${geometry.tool.centerDelta}px`);
    }
    if (name === 'wide' && geometry.firstContent && Math.abs(geometry.firstContent.centerDelta) > 2) {
      failures.push(`${name}: below-tool content center delta ${geometry.firstContent.centerDelta}px`);
    }
  }

  return resultFromFailures({
    gate: 'final-visual-lock',
    runDir: absoluteRunDir,
    failures,
    details,
    evidence,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runFinalVisualLockGate({ runDir: args.runDir, url: args.url });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'final-visual-lock.json', result);
  console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} final visual lock`);
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
