#!/usr/bin/env node
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const FINAL_VISUAL_TARGET_COMPLETE = 'FINAL_VISUAL_TARGET_COMPLETE';
export const FINAL_VISUAL_TARGET_MISSING = 'FINAL_VISUAL_TARGET_MISSING';
export const FINAL_VISUAL_TARGET_DIMENSION_MISMATCH = 'FINAL_VISUAL_TARGET_DIMENSION_MISMATCH';
export const NO_APPROVED_UI_GENERATION_AVAILABLE = 'NO_APPROVED_UI_GENERATION_AVAILABLE';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');

const OUTPUT_DIR = 'agent-5-output/final-visual-target';
const PROMPT_PATH = `${OUTPUT_DIR}/final-visual-target-prompt.md`;
const MANIFEST_PATH = `${OUTPUT_DIR}/final-visual-target-manifest.json`;
const SOURCE_MAP_PATH = `${OUTPUT_DIR}/source-map.json`;
const DESKTOP_TARGET_PATH = `${OUTPUT_DIR}/desktop.png`;
const MOBILE_TARGET_PATH = `${OUTPUT_DIR}/mobile.png`;

const SELECTED_PACKAGE_PATH = 'agent-2-5-output/selected-assets/selected-design-package.md';
const SELECTED_ASSETS_MANIFEST_PATH = 'agent-2-5-output/selected-assets/selected-assets-manifest.json';
const SELECTED_ASSETS_SOURCE_MAP_PATH = 'agent-2-5-output/selected-assets/source-map.json';
const SELECTED_DESKTOP_TARGET_PATH = 'agent-2-5-output/selected-assets/selected-target-desktop.png';
const SELECTED_MOBILE_TARGET_PATH = 'agent-2-5-output/selected-assets/selected-target-mobile.png';
const ACTION_RECEIPT_PATH = 'agent-2-5-output/external-design-evidence/action-receipt.json';
const FINAL_LOCK_DESKTOP_PATH = 'agent-5-output/final-visual-lock/desktop.png';
const FINAL_LOCK_MOBILE_PATH = 'agent-5-output/final-visual-lock/mobile.png';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

function nowIso() {
  return new Date().toISOString();
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonOptional(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function sha256File(filePath) {
  return sha256(await readFile(filePath));
}

function pngInfo(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== signature) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function fileInfo(runDir, relPath) {
  const absolutePath = path.join(runDir, relPath);
  if (!(await exists(absolutePath))) return null;
  const buffer = await readFile(absolutePath);
  return {
    path: relPath,
    sha256: sha256(buffer),
    size: buffer.length,
    dimensions: pngInfo(buffer),
  };
}

function failure(code, failures, details = {}) {
  return {
    ok: false,
    code,
    failures: Array.isArray(failures) ? failures : [String(failures)],
    details,
  };
}

function relOutput(runDir, relPath) {
  return {
    relPath,
    absolutePath: path.join(runDir, relPath),
  };
}

function parseProviderFailure(result) {
  const text = `${result?.stdout || ''}\n${result?.stderr || ''}`;
  if (text.includes(NO_APPROVED_UI_GENERATION_AVAILABLE)) return NO_APPROVED_UI_GENERATION_AVAILABLE;
  if (text.includes(FINAL_VISUAL_TARGET_MISSING)) return FINAL_VISUAL_TARGET_MISSING;
  if (text.includes(FINAL_VISUAL_TARGET_DIMENSION_MISMATCH)) return FINAL_VISUAL_TARGET_DIMENSION_MISMATCH;
  return FINAL_VISUAL_TARGET_MISSING;
}

async function defaultGenerateTargets({ runDir, promptPath, outputPaths, env = process.env }) {
  const executor = String(env.DESKTOP_FINAL_VISUAL_TARGET_EXECUTOR || '').trim();
  if (!executor) {
    return failure(
      NO_APPROVED_UI_GENERATION_AVAILABLE,
      'No approved final visual target generator is configured. Set DESKTOP_FINAL_VISUAL_TARGET_EXECUTOR to an approved external design executor.',
    );
  }

  const result = spawnSync(process.execPath, [
    executor,
    '--run-dir',
    runDir,
    '--prompt',
    promptPath,
    '--desktop-output',
    outputPaths.desktop.relPath,
    '--mobile-output',
    outputPaths.mobile.relPath,
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 360_000,
  });

  if (result.error) {
    return failure(NO_APPROVED_UI_GENERATION_AVAILABLE, result.error.message);
  }
  if (result.status !== 0) {
    return failure(parseProviderFailure(result), [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || 'approved final target executor failed');
  }
  return {
    ok: true,
    method: 'approved-external-final-visual-target-executor',
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

async function writePrompt(runDir, context) {
  const prompt = [
    '# Final Visual Target Generation Prompt',
    '',
    'Generate viewport-sized final visual targets for final page similarity QA.',
    '',
    'Rules:',
    '- Use only the selected design evidence, selected design package, selected target references, and approved external action receipt.',
    '- Do not use current site screenshots as targets.',
    '- Do not copy the selected option crop directly as a final visual target.',
    '- Do not create a new A/B/C option or change the selected option.',
    '- Desktop target must be exactly 1440x900.',
    '- Mobile target must be exactly 390x844.',
    '',
    'Outputs:',
    `- ${DESKTOP_TARGET_PATH}`,
    `- ${MOBILE_TARGET_PATH}`,
    '',
    'Sources:',
    `- Selected option: ${context.selectedOption || 'unknown'}`,
    `- Selected design: ${context.selectedDesign || 'unknown'}`,
    `- Selected design package: ${SELECTED_PACKAGE_PATH}`,
    `- Selected assets source map: ${SELECTED_ASSETS_SOURCE_MAP_PATH}`,
    `- Desktop selected option target: ${SELECTED_DESKTOP_TARGET_PATH}`,
    `- Mobile selected option target: ${SELECTED_MOBILE_TARGET_PATH}`,
    `- External action receipt: ${ACTION_RECEIPT_PATH}`,
    '',
    'Selected design package excerpt:',
    '',
    context.selectedPackageText.slice(0, 4000),
    '',
  ].join('\n');

  const absolutePath = path.join(runDir, PROMPT_PATH);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, prompt, 'utf8');
  return PROMPT_PATH;
}

async function loadContext(runDir) {
  const required = [
    SELECTED_PACKAGE_PATH,
    SELECTED_ASSETS_MANIFEST_PATH,
    SELECTED_ASSETS_SOURCE_MAP_PATH,
    SELECTED_DESKTOP_TARGET_PATH,
    SELECTED_MOBILE_TARGET_PATH,
    ACTION_RECEIPT_PATH,
  ];
  const missing = [];
  for (const relPath of required) {
    if (!(await exists(path.join(runDir, relPath)))) missing.push(relPath);
  }
  if (missing.length) return { ok: false, missing };

  const selectedPackageText = await readFile(path.join(runDir, SELECTED_PACKAGE_PATH), 'utf8');
  const selectedAssetsManifest = await readJsonOptional(path.join(runDir, SELECTED_ASSETS_MANIFEST_PATH));
  const selectedAssetsSourceMap = await readJsonOptional(path.join(runDir, SELECTED_ASSETS_SOURCE_MAP_PATH));
  const receipt = await readJsonOptional(path.join(runDir, ACTION_RECEIPT_PATH));
  const selectedDesktop = await fileInfo(runDir, SELECTED_DESKTOP_TARGET_PATH);
  const selectedMobile = await fileInfo(runDir, SELECTED_MOBILE_TARGET_PATH);
  const selectedPackage = await fileInfo(runDir, SELECTED_PACKAGE_PATH);
  const receiptInfo = await fileInfo(runDir, ACTION_RECEIPT_PATH);

  return {
    ok: true,
    selectedOption: selectedAssetsManifest?.selected_option || selectedAssetsSourceMap?.selected_option || '',
    selectedDesign: selectedAssetsManifest?.selected_design || selectedAssetsSourceMap?.selected_design || '',
    selectedPackageText,
    selectedAssetsManifest,
    selectedAssetsSourceMap,
    receipt,
    sources: {
      selectedPackage,
      receipt: receiptInfo,
      selectedTargets: {
        desktop: selectedDesktop,
        mobile: selectedMobile,
      },
    },
  };
}

async function removeGeneratedTargets(runDir) {
  await rm(path.join(runDir, DESKTOP_TARGET_PATH), { force: true });
  await rm(path.join(runDir, MOBILE_TARGET_PATH), { force: true });
}

async function validateGeneratedTargets(runDir, context) {
  const failures = [];
  const outputs = {};

  for (const [name, relPath] of Object.entries({ desktop: DESKTOP_TARGET_PATH, mobile: MOBILE_TARGET_PATH })) {
    const output = await fileInfo(runDir, relPath);
    outputs[name] = output;
    if (!output) {
      failures.push(`${FINAL_VISUAL_TARGET_MISSING}: missing ${relPath}`);
      continue;
    }
    if (!output.dimensions) {
      failures.push(`${FINAL_VISUAL_TARGET_MISSING}: ${relPath} is not a PNG`);
      continue;
    }
    const expected = VIEWPORTS[name];
    if (output.dimensions.width !== expected.width || output.dimensions.height !== expected.height) {
      failures.push(
        `${FINAL_VISUAL_TARGET_DIMENSION_MISMATCH}: ${name} final visual target dimensions ${output.dimensions.width}x${output.dimensions.height} must be ${expected.width}x${expected.height}`,
      );
    }
    const selectedSource = context.sources.selectedTargets[name];
    if (selectedSource?.sha256 && output.sha256 === selectedSource.sha256) {
      failures.push(`${FINAL_VISUAL_TARGET_MISSING}: ${relPath} must not copy the selected option crop target directly`);
    }
    const finalLockPath = name === 'desktop' ? FINAL_LOCK_DESKTOP_PATH : FINAL_LOCK_MOBILE_PATH;
    const finalLock = await fileInfo(runDir, finalLockPath);
    if (finalLock?.sha256 && output.sha256 === finalLock.sha256) {
      failures.push(`${FINAL_VISUAL_TARGET_MISSING}: ${relPath} must not match current final screenshot ${finalLockPath}`);
    }
  }

  if (failures.some((item) => /must not copy|must not match current final screenshot/i.test(item))) {
    await removeGeneratedTargets(runDir);
    return failure(FINAL_VISUAL_TARGET_MISSING, failures, { outputs });
  }
  if (failures.some((item) => item.includes(FINAL_VISUAL_TARGET_DIMENSION_MISMATCH))) {
    return failure(FINAL_VISUAL_TARGET_DIMENSION_MISMATCH, failures, { outputs });
  }
  if (failures.length) return failure(FINAL_VISUAL_TARGET_MISSING, failures, { outputs });
  return { ok: true, outputs };
}

async function writeManifest(runDir, context, promptPath, providerResult, outputs, now) {
  const generatedAt = now();
  const outputPaths = {
    desktop: DESKTOP_TARGET_PATH,
    mobile: MOBILE_TARGET_PATH,
  };
  const targetHashes = {
    [DESKTOP_TARGET_PATH]: outputs.desktop.sha256,
    [MOBILE_TARGET_PATH]: outputs.mobile.sha256,
  };
  const targetDimensions = {
    desktop: outputs.desktop.dimensions,
    mobile: outputs.mobile.dimensions,
  };
  const sourceMap = {
    schema_version: 'final-visual-target-source-map.v1',
    selected_option: context.selectedOption,
    selected_design: context.selectedDesign,
    source_selected_design_package: SELECTED_PACKAGE_PATH,
    source_selected_targets: {
      desktop: SELECTED_DESKTOP_TARGET_PATH,
      mobile: SELECTED_MOBILE_TARGET_PATH,
    },
    external_action_receipt: ACTION_RECEIPT_PATH,
    generation_method: providerResult.method || 'approved-external-final-visual-target-generator',
    prompt_path: promptPath,
    viewport_sizes: VIEWPORTS,
    output_targets: outputPaths,
    target_hashes: targetHashes,
    target_dimensions: targetDimensions,
    generated_at: generatedAt,
  };
  const manifest = {
    schema_version: 'final-visual-target-manifest.v1',
    selected_option: context.selectedOption,
    selected_design: context.selectedDesign,
    source_selected_design_package: SELECTED_PACKAGE_PATH,
    source_selected_design_package_sha256: context.sources.selectedPackage.sha256,
    source_selected_targets: {
      desktop: {
        path: SELECTED_DESKTOP_TARGET_PATH,
        sha256: context.sources.selectedTargets.desktop.sha256,
        dimensions: context.sources.selectedTargets.desktop.dimensions,
      },
      mobile: {
        path: SELECTED_MOBILE_TARGET_PATH,
        sha256: context.sources.selectedTargets.mobile.sha256,
        dimensions: context.sources.selectedTargets.mobile.dimensions,
      },
    },
    external_action_receipt: ACTION_RECEIPT_PATH,
    external_action_receipt_sha256: context.sources.receipt.sha256,
    provider_receipt: providerResult.receipt_path || providerResult.receiptPath || null,
    generation_method: sourceMap.generation_method,
    new_external_action_required: Boolean(providerResult.receipt_path || providerResult.receiptPath),
    prompt_path: promptPath,
    prompt_sha256: await sha256File(path.join(runDir, promptPath)),
    viewport_sizes: VIEWPORTS,
    output_paths: outputPaths,
    sha256_hashes: targetHashes,
    generated_at: generatedAt,
  };
  await writeFile(path.join(runDir, SOURCE_MAP_PATH), `${JSON.stringify(sourceMap, null, 2)}\n`, 'utf8');
  await writeFile(path.join(runDir, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { manifest, sourceMap };
}

export async function generateFinalVisualTargets({
  runDir,
  now = nowIso,
  env = process.env,
  generateTargets = defaultGenerateTargets,
} = {}) {
  const absoluteRunDir = path.resolve(runDir);
  const context = await loadContext(absoluteRunDir);
  if (!context.ok) {
    return failure(FINAL_VISUAL_TARGET_MISSING, context.missing.map((relPath) => `missing ${relPath}`));
  }

  await mkdir(path.join(absoluteRunDir, OUTPUT_DIR), { recursive: true });
  const promptPath = await writePrompt(absoluteRunDir, context);
  const outputPaths = {
    desktop: relOutput(absoluteRunDir, DESKTOP_TARGET_PATH),
    mobile: relOutput(absoluteRunDir, MOBILE_TARGET_PATH),
  };
  const providerResult = await generateTargets({
    runDir: absoluteRunDir,
    promptPath,
    outputDir: OUTPUT_DIR,
    outputPaths,
    selectedOption: context.selectedOption,
    selectedDesign: context.selectedDesign,
    viewportSizes: VIEWPORTS,
    sources: context.sources,
    env,
  });
  if (!providerResult?.ok) {
    return providerResult || failure(FINAL_VISUAL_TARGET_MISSING, 'approved final target generator did not return a result');
  }

  const validation = await validateGeneratedTargets(absoluteRunDir, context);
  if (!validation.ok) return validation;

  const written = await writeManifest(absoluteRunDir, context, promptPath, providerResult, validation.outputs, now);
  return {
    ok: true,
    code: FINAL_VISUAL_TARGET_COMPLETE,
    output_paths: {
      desktop: DESKTOP_TARGET_PATH,
      mobile: MOBILE_TARGET_PATH,
    },
    manifest_path: MANIFEST_PATH,
    source_map_path: SOURCE_MAP_PATH,
    manifest: written.manifest,
    source_map: written.sourceMap,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function usage() {
  return 'Usage: node scripts/desktop/final-visual-target.mjs --run-dir runs/<site-id>';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.runDir) {
    console.log(usage());
    process.exitCode = args.help ? 0 : 2;
    return;
  }
  const result = await generateFinalVisualTargets({ runDir: args.runDir });
  console.log(result.code);
  if (result.failures?.length) {
    for (const failureMessage of result.failures) console.log(`- ${failureMessage}`);
  }
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
