#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { runPreAgent2TelegramLoop } from './pre-agent2-telegram-loop.mjs';

function parseArgs(argv) {
  const args = { preset: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--preset') {
      args.preset = argv[index + 1];
      index += 1;
    } else if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    }
  }
  if (args.preset !== 'word-counter') {
    throw new Error('Usage: node scripts/run/smoke-pre-agent2-batch.mjs --preset word-counter [--run-dir runs/<site-id>]');
  }
  return args;
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').toLowerCase();
}

function wordCounterInput(siteId) {
  return [
    '# Run Input',
    '',
    `- 关键词：word counter`,
    `- 目标域名：${siteId}.local`,
    '- UI 参考：Stripe',
    '- UX 参考：wordcounter.net',
    '- 额外想法 / 限制 / 模仿点：第一屏必须直接可用；输入文本后实时展示 words / characters / sentences / paragraphs / reading time / speaking time；浏览器本地处理；不要登录；不要后端；不要数据库；不要 AI 改写；不要历史保存；页面底部可以有 /privacy /terms /sitemap.xml /robots.txt。',
    '',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDir = path.resolve(args.runDir || path.join('runs', `wordcounter-pre-agent2-smoke-${timestampSlug()}`));
  const siteId = path.basename(runDir);
  await mkdir(runDir, { recursive: true });
  await writeFile(
    path.join(runDir, 'run-meta.json'),
    `${JSON.stringify(
      {
        run_type: 'smoke',
        deployable: false,
        created_for: 'pipeline smoke test',
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(path.join(runDir, 'input.md'), wordCounterInput(siteId), 'utf8');
  const remoteStatePath = path.join(runDir, '.smoke-remote-state.json');
  await writeFile(remoteStatePath, `${JSON.stringify({ remote_mode: true }, null, 2)}\n`, 'utf8');

  const sentMessages = [];
  const result = await runPreAgent2TelegramLoop({
    runDir,
    remoteStatePath,
    pollMs: 0,
    sender: async (text) => {
      sentMessages.push(text);
      return { ok: true, dryRun: true };
    },
  });

  if (!result.ok) {
    console.log(result.message || `Smoke Pre-Agent2 batch failed: ${result.code}`);
    process.exitCode = 1;
    return;
  }
  const legacyQuestionLeaks = [
    '这个工具站最核心要帮用户' + '完成什么任务',
    '第一屏应该优先呈现' + '什么体验',
    '输入和输出模型应该' + '怎么设计',
  ];
  if (sentMessages.some((message) => /Pre-Agent2 Q\d+/.test(message) || legacyQuestionLeaks.some((leak) => message.includes(leak)))) {
    console.log('Smoke Pre-Agent2 batch failed: generic fixed questionnaire leaked into user-visible output');
    process.exitCode = 1;
    return;
  }

  console.log('PASS smoke Pre-Agent2 batch');
  console.log(`Run dir: ${path.relative(process.cwd(), runDir)}`);
  console.log(`Messages prepared: ${sentMessages.length}`);
  console.log(`Stopped reason: ${result.lastResult?.reason || result.lastResult?.action || 'unknown'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
