#!/usr/bin/env node
import { access, copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { writeDesktopState } from './run.mjs';

export const DESKTOP_INTAKE_CREATED = 'DESKTOP_INTAKE_CREATED';
export const INCOMPLETE_INTAKE = 'INCOMPLETE_INTAKE';
export const MISSING_INPUT_ASSET = 'MISSING_INPUT_ASSET';
export const RUN_ALREADY_EXISTS = 'RUN_ALREADY_EXISTS';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');

const RUN_DIRS = [
  'input-assets',
  'pre-agent2-output',
  'agent-2-output',
  'agent-2-5-output',
  'agent-3-output',
  'agent-4-output',
  'site',
  'agent-5-output',
  'gate-results',
  'deployment-output',
];

const REQUIRED_FIELDS = [
  ['keyword', '关键词'],
  ['target_domain', '目标域名'],
  ['ui_reference', 'UI 参考'],
  ['ux_reference', 'UX 参考'],
  ['extra_notes', '额外想法 / 限制 / 模仿点'],
];

const IMAGE_REFERENCE_PATTERN = /参考图|截图|参考我发的图|插画参考|按图片风格|附图|黑白人物插画/i;

function parseArgs(argv) {
  const args = { rootDir: REPO_ROOT, assets: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') {
      args.inputPath = argv[index + 1];
      index += 1;
    } else if (arg === '--site-id') {
      args.siteId = argv[index + 1];
      index += 1;
    } else if (arg === '--keyword') {
      args.keyword = argv[index + 1];
      index += 1;
    } else if (arg === '--domain') {
      args.target_domain = argv[index + 1];
      index += 1;
    } else if (arg === '--ui-ref') {
      args.ui_reference = argv[index + 1];
      index += 1;
    } else if (arg === '--ux-ref') {
      args.ux_reference = argv[index + 1];
      index += 1;
    } else if (arg === '--notes') {
      args.extra_notes = argv[index + 1];
      index += 1;
    } else if (arg === '--assets') {
      args.assets.push(argv[index + 1]);
      index += 1;
    } else if (arg === '--root-dir') {
      args.rootDir = argv[index + 1];
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
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

function normalizeLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[：:]/g, ':')
    .replace(/[`*_#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMarkdownValue(text, aliases) {
  for (const line of String(text || '').split(/\r?\n/)) {
    const cleaned = line.replace(/^\s*[-*]\s*/, '').trim();
    const separatorIndex = cleaned.search(/[：:]/);
    if (separatorIndex < 0) continue;
    const label = normalizeLabel(cleaned.slice(0, separatorIndex));
    const value = cleaned.slice(separatorIndex + 1).trim();
    if (aliases.some((alias) => label.includes(normalizeLabel(alias)))) return value;
  }
  return '';
}

function parseMarkdownIntake(text) {
  return {
    keyword: findMarkdownValue(text, ['关键词', 'keyword']),
    target_domain: findMarkdownValue(text, ['目标域名', 'target domain', 'domain']),
    ui_reference: findMarkdownValue(text, ['UI 参考', 'ui reference', 'ui ref']),
    ux_reference: findMarkdownValue(text, ['UX 参考', 'ux reference', 'ux ref']),
    extra_notes: findMarkdownValue(text, [
      '额外想法 / 限制 / 模仿点',
      '额外想法',
      '额外要求',
      '补充要求',
      '其他要求',
      '限制',
      '模仿点',
      'extra ideas',
      'constraints',
      'mimic points',
      'notes',
    ]),
    asset_reference: findMarkdownValue(text, ['截图 / 参考图', '截图', '参考图', 'image', 'asset', 'assets']),
  };
}

function mergeIntake(cliArgs, markdownIntake = {}) {
  return {
    keyword: cliArgs.keyword || markdownIntake.keyword || '',
    target_domain: cliArgs.target_domain || markdownIntake.target_domain || '',
    ui_reference: cliArgs.ui_reference || markdownIntake.ui_reference || '',
    ux_reference: cliArgs.ux_reference || markdownIntake.ux_reference || '',
    extra_notes: cliArgs.extra_notes || markdownIntake.extra_notes || '',
    asset_reference: markdownIntake.asset_reference || '',
  };
}

function missingFields(intake) {
  return REQUIRED_FIELDS
    .filter(([key]) => !String(intake[key] || '').trim())
    .map(([, label]) => label);
}

function slugFromDomain(domain) {
  const value = String(domain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();
  const labels = value.split('.').filter(Boolean);
  const base = labels.length > 1 ? labels.slice(0, -1).join('-') : value;
  return base.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'toolsite-run';
}

function purposeForIntake(intake) {
  const combined = `${intake.asset_reference || ''}\n${intake.extra_notes || ''}`;
  if (/截图/i.test(combined)) return 'screenshot_reference';
  if (/插画|illustration|黑白人物/i.test(combined)) return 'illustration_reference';
  return 'design_reference';
}

async function listAssetFiles(assetInputs, inputPath = '') {
  const inputDir = inputPath ? path.dirname(path.resolve(inputPath)) : process.cwd();
  const files = [];
  for (const assetInput of assetInputs.filter(Boolean)) {
    const resolved = path.resolve(inputDir, assetInput);
    if (!(await exists(resolved))) continue;
    const info = await stat(resolved);
    if (info.isDirectory()) {
      const entries = await readdir(resolved, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        files.push(path.join(resolved, entry.name));
      }
    } else if (info.isFile()) {
      files.push(resolved);
    }
  }
  return files;
}

function normalizeAssetReferences(value) {
  if (!value) return [];
  return String(value)
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function copyAssets({ assetFiles, runDir, purpose }) {
  const copied = [];
  let index = 1;
  await mkdir(path.join(runDir, 'input-assets'), { recursive: true });
  for (const sourcePath of assetFiles) {
    const info = await stat(sourcePath);
    if (!info.isFile() || info.size <= 0) continue;
    const safeName = path.basename(sourcePath).replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
    const fileName = `${String(index).padStart(2, '0')}-${safeName}`;
    const runPath = path.join('input-assets', fileName).replace(/\\/g, '/');
    await copyFile(sourcePath, path.join(runDir, runPath));
    copied.push({
      kind: 'image',
      purpose,
      source_local_path: sourcePath,
      run_path: runPath,
      file_name: fileName,
      size: info.size,
    });
    index += 1;
  }
  return copied;
}

function renderInputMarkdown(intake, assets) {
  const lines = [
    '# Desktop Toolsite Intake',
    '',
    '## 五要素',
    '',
    `- 关键词: ${intake.keyword}`,
    `- 目标域名: ${intake.target_domain}`,
    `- UI 参考: ${intake.ui_reference}`,
    `- UX 参考: ${intake.ux_reference}`,
    `- 额外想法 / 限制 / 模仿点: ${intake.extra_notes}`,
    '',
  ];
  if (assets.length) {
    lines.push(
      '## Input assets',
      '',
      ...assets.map((asset) => `- image: ${asset.run_path} (purpose: ${asset.purpose}, source: ${asset.source_local_path})`),
      '',
    );
  }
  return lines.join('\n');
}

export async function createDesktopIntakeRun({
  rootDir = REPO_ROOT,
  inputPath = '',
  siteId = '',
  keyword = '',
  target_domain = '',
  ui_reference = '',
  ux_reference = '',
  extra_notes = '',
  assets = [],
  now = () => new Date().toISOString(),
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const rawInput = inputPath ? await readFile(path.resolve(inputPath), 'utf8') : '';
  const markdownIntake = rawInput ? parseMarkdownIntake(rawInput) : {};
  const intake = mergeIntake(
    { keyword, target_domain, ui_reference, ux_reference, extra_notes },
    markdownIntake,
  );
  const missing = missingFields(intake);
  if (missing.length) return { ok: false, code: INCOMPLETE_INTAKE, missing };

  const resolvedSiteId = siteId || slugFromDomain(intake.target_domain);
  const runDir = path.join(absoluteRoot, 'runs', resolvedSiteId);
  if (await exists(runDir)) return { ok: false, code: RUN_ALREADY_EXISTS, runDir, siteId: resolvedSiteId };

  const assetInputs = [
    ...assets,
    ...normalizeAssetReferences(intake.asset_reference),
  ];
  const assetFiles = await listAssetFiles(assetInputs, inputPath);
  const requiresAsset = IMAGE_REFERENCE_PATTERN.test(`${intake.extra_notes}\n${intake.asset_reference}`);
  if (requiresAsset && assetFiles.length === 0) return { ok: false, code: MISSING_INPUT_ASSET, siteId: resolvedSiteId };

  await mkdir(runDir, { recursive: true });
  for (const dir of RUN_DIRS) await mkdir(path.join(runDir, dir), { recursive: true });

  const purpose = purposeForIntake(intake);
  const copiedAssets = await copyAssets({ assetFiles, runDir, purpose });
  const createdAt = now();

  await writeFile(path.join(runDir, 'input.md'), renderInputMarkdown(intake, copiedAssets), 'utf8');
  await writeFile(path.join(runDir, 'human-review-events.jsonl'), '', 'utf8');
  await writeFile(
    path.join(runDir, 'run-meta.json'),
    `${JSON.stringify(
      {
        mode: 'desktop',
        run_type: 'production',
        deployable: true,
        site_id: resolvedSiteId,
        target_domain: intake.target_domain,
        keyword: intake.keyword,
        created_at: createdAt,
        status: 'active',
        source: 'desktop-intake',
        input_path: inputPath ? path.resolve(inputPath) : null,
        assets: copiedAssets,
        input_assets: copiedAssets,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeDesktopState(runDir, {
    mode: 'desktop',
    stage: 'pre-agent2',
    last_completed_stage: 'intake',
    next_action: 'run desktop:pre-agent2',
    blocking_reason: null,
    repair_attempts: {},
    updated_at: createdAt,
  });

  return {
    ok: true,
    code: DESKTOP_INTAKE_CREATED,
    runDir,
    siteId: resolvedSiteId,
    assets: copiedAssets,
  };
}

function usage() {
  return [
    'Usage:',
    '  npm run desktop:intake -- --input path/to/intake.md',
    '  npm run desktop:intake -- --site-id <site-id> --keyword <keyword> --domain <domain> --ui-ref <url-or-note> --ux-ref <url-or-note> --notes <text> [--assets <file-or-dir>]',
    '',
    'Required five elements: 关键词, 目标域名, UI 参考, UX 参考, 额外想法 / 限制 / 模仿点.',
    'Images/screenshots are optional unless the notes mention using a reference image, screenshot, illustration reference, or image style.',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const result = await createDesktopIntakeRun(args);
  console.log(result.code);
  if (result.missing?.length) console.log(`missing: ${result.missing.join(', ')}`);
  if (result.runDir) console.log(`run_dir: ${result.runDir}`);
  process.exitCode = result.ok ? 0 : 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
