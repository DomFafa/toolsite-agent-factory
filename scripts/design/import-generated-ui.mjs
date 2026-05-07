#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const OPTION_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;

export function expandHome(input) {
  if (!input) return input;
  if (input === '~') return os.homedir();
  if (input.startsWith('~/')) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function assertSafeOption(option) {
  if (!OPTION_RE.test(option)) {
    throw new Error('--option must use letters, numbers, and hyphens, starting with a letter or number');
  }
  return option.toLowerCase();
}

export function assertInside(parent, candidate) {
  const parentPath = path.resolve(parent);
  const candidatePath = path.resolve(candidate);
  const relative = path.relative(parentPath, candidatePath);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return candidatePath;
  throw new Error(`Refusing path outside expected directory: ${candidate}`);
}

export function assertSafeZipEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Zip archive has no entries');
  }

  for (const entry of entries) {
    if (!entry || entry.trim() !== entry) throw new Error(`Unsafe zip entry: ${entry}`);
    if (entry.includes('\\')) throw new Error(`Unsafe zip entry uses backslashes: ${entry}`);
    if (entry.startsWith('/') || entry.startsWith('~') || /^[A-Za-z]:/.test(entry)) {
      throw new Error(`Unsafe absolute zip entry: ${entry}`);
    }
    const parts = entry.split('/').filter(Boolean);
    if (parts.includes('..')) throw new Error(`Unsafe parent-directory zip entry: ${entry}`);
    if (parts.some((part) => /[\u0000-\u001f]/.test(part))) {
      throw new Error(`Unsafe control character in zip entry: ${entry}`);
    }
  }

  return entries;
}

export function buildImportPaths({ runDir, option }) {
  const finalOption = assertSafeOption(option);
  const runRoot = path.resolve(expandHome(runDir));
  const outputRoot = path.join(runRoot, 'agent-2-5-output');
  const generatedRoot = path.join(outputRoot, 'generated-designs', finalOption);
  const codeRoot = path.join(generatedRoot, 'code');
  const archiveRoot = path.join(outputRoot, 'source-archives');
  const selectedRoot = path.join(outputRoot, 'selected-design');
  const selectedCodeRoot = path.join(selectedRoot, 'code');

  for (const candidate of [outputRoot, generatedRoot, codeRoot, archiveRoot, selectedRoot, selectedCodeRoot]) {
    assertInside(runRoot, candidate);
  }

  return {
    runRoot,
    outputRoot,
    generatedRoot,
    codeRoot,
    archiveRoot,
    selectedRoot,
    selectedCodeRoot,
    archivePath: path.join(archiveRoot, `${finalOption}.zip`),
    option: finalOption,
  };
}

export function listZipEntries(zipPath) {
  const result = spawnSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Failed to list zip entries with unzip: ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function runUnzip(zipPath, targetDir) {
  const result = spawnSync('unzip', ['-q', zipPath, '-d', targetDir], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Failed to extract zip with unzip: ${result.stderr || result.stdout}`.trim());
  }
}

export function writeImportReport({ paths, zipPath, select, entryCount }) {
  const report = `# Generated UI Import

- Option: ${paths.option}
- Source zip: ${path.resolve(zipPath)}
- Archived zip: ${paths.archivePath}
- Extracted code: ${paths.codeRoot}
- Selected: ${select ? 'yes' : 'no'}
- Entry count: ${entryCount}
- Imported at: ${new Date().toISOString()}
`;

  fs.writeFileSync(path.join(paths.generatedRoot, 'import-report.md'), report, 'utf8');
  if (select) fs.writeFileSync(path.join(paths.selectedRoot, 'import-report.md'), report, 'utf8');
  return report;
}

export function importGeneratedUi({ runDir, zipPath, option = 'option-a', select = false, overwrite = false }) {
  if (!runDir) throw new Error('--run-dir is required');
  if (!zipPath) throw new Error('--zip is required');

  const finalZipPath = path.resolve(expandHome(zipPath));
  if (!fs.existsSync(finalZipPath)) throw new Error(`Zip file not found: ${finalZipPath}`);

  const paths = buildImportPaths({ runDir, option });
  const entries = assertSafeZipEntries(listZipEntries(finalZipPath));

  if (fs.existsSync(paths.codeRoot)) {
    if (!overwrite) throw new Error(`Target already exists: ${paths.codeRoot}. Use --overwrite to replace it.`);
    fs.rmSync(paths.codeRoot, { recursive: true, force: true });
  }

  fs.mkdirSync(paths.archiveRoot, { recursive: true });
  fs.mkdirSync(paths.generatedRoot, { recursive: true });
  fs.copyFileSync(finalZipPath, paths.archivePath);
  fs.mkdirSync(paths.codeRoot, { recursive: true });
  runUnzip(finalZipPath, paths.codeRoot);

  if (select) {
    if (fs.existsSync(paths.selectedCodeRoot)) {
      if (!overwrite) throw new Error(`Selected design already exists: ${paths.selectedCodeRoot}. Use --overwrite to replace it.`);
      fs.rmSync(paths.selectedCodeRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(paths.selectedRoot, { recursive: true });
    fs.cpSync(paths.codeRoot, paths.selectedCodeRoot, { recursive: true });
  }

  writeImportReport({ paths, zipPath: finalZipPath, select, entryCount: entries.length });

  return {
    option: paths.option,
    archivePath: paths.archivePath,
    codeRoot: paths.codeRoot,
    selectedCodeRoot: select ? paths.selectedCodeRoot : null,
    entryCount: entries.length,
  };
}

function printUsage() {
  console.error(`Usage:
  node scripts/design/import-generated-ui.mjs --run-dir runs/<site-id> --zip <downloaded.zip> --option option-a
  node scripts/design/import-generated-ui.mjs --run-dir runs/<site-id> --zip <downloaded.zip> --option option-a --select --overwrite`);
}

function main() {
  const { values } = parseArgs({
    options: {
      'run-dir': { type: 'string' },
      zip: { type: 'string' },
      option: { type: 'string', default: 'option-a' },
      select: { type: 'boolean', default: false },
      overwrite: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    printUsage();
    return;
  }

  const result = importGeneratedUi({
    runDir: values['run-dir'],
    zipPath: values.zip,
    option: values.option,
    select: values.select,
    overwrite: values.overwrite,
  });

  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
