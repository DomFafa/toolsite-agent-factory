#!/usr/bin/env node
// Agent2.5 design-options executor.
// Browser automation lives here. Receipt writing stays in
// run-agent25-external-action.mjs, and proof validation stays in
// check-agent25-external-design-proof.mjs.
import { access, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const NO_APPROVED_UI_GENERATION_AVAILABLE = 'NO_APPROVED_UI_GENERATION_AVAILABLE';
export const EXTERNAL_ACTION_FAILED = 'EXTERNAL_ACTION_FAILED';
export const EXECUTOR_VERSION = 'agent25-design-options-executor/1';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const DEFAULT_SURFACE_URL = 'https://chatgpt.com/';
const DEFAULT_CDP_BASE_URL = process.env.AGENT25_CDP_BASE_URL || 'http://127.0.0.1:3456';
const DEFAULT_TIMEOUT_MS = 300_000;

const OUTPUTS = {
  evidenceDir: 'agent-2-5-output/external-design-evidence',
  generatedDir: 'agent-2-5-output/generated-designs',
  selectedDir: 'agent-2-5-output/selected-design',
  chatDir: 'agent-2-5-output/chat-delivery',
  submittedPrompt: 'agent-2-5-output/external-design-evidence/submitted-prompt.md',
  rawResponse: 'agent-2-5-output/external-design-evidence/external-response.md',
  screenshot: 'agent-2-5-output/external-design-evidence/conversation-screenshot.png',
  executorLog: 'agent-2-5-output/external-design-evidence/executor-log.json',
  generatedImage: 'agent-2-5-output/external-design-evidence/downloads/generated-image-1.png',
  proof: 'agent-2-5-output/external-design-evidence/external-design-proof.json',
  sourceProvenance: 'agent-2-5-output/external-design-evidence/source-provenance.md',
  selectedLineage: 'agent-2-5-output/external-design-evidence/selected-design-lineage.md',
  optionsBoard: 'agent-2-5-output/chat-delivery/options-board.png',
  optionSelection: 'agent-2-5-output/chat-delivery/option-selection.md',
  optionA: 'agent-2-5-output/generated-designs/option-a/target/desktop.png',
  optionB: 'agent-2-5-output/generated-designs/option-b/target/desktop.png',
  optionC: 'agent-2-5-output/generated-designs/option-c/target/desktop.png',
  desktopTarget: 'agent-2-5-output/selected-design/target/desktop.png',
  mobileTarget: 'agent-2-5-output/selected-design/target/mobile.png',
};

function parseArgs(argv) {
  const args = {
    cdpBaseUrl: DEFAULT_CDP_BASE_URL,
    surfaceUrl: DEFAULT_SURFACE_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    mode: 'dry-run',
    selectedOption: 'option-a',
    keepTab: false,
    reuseExisting: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
    } else if (arg === '--prompt') {
      args.prompt = argv[index + 1];
      index += 1;
    } else if (arg === '--surface-url') {
      args.surfaceUrl = argv[index + 1];
      index += 1;
    } else if (arg === '--cdp-base-url') {
      args.cdpBaseUrl = argv[index + 1];
      index += 1;
    } else if (arg === '--timeout-ms') {
      args.timeoutMs = Number(argv[index + 1]);
      index += 1;
    } else if (arg === '--mode') {
      args.mode = argv[index + 1];
      index += 1;
    } else if (arg === '--selected-option') {
      args.selectedOption = normalizeOptionId(argv[index + 1]);
      index += 1;
    } else if (arg === '--keep-tab') {
      args.keepTab = true;
    } else if (arg === '--reuse-existing') {
      args.reuseExisting = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (args.help) return args;
  if (!args.runDir || !args.prompt) throw new Error(usage());
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 10_000) throw new Error('--timeout-ms must be at least 10000');
  if (!/^(production|test|dry-run|dryrun)$/i.test(args.mode)) throw new Error('--mode must be production, test, or dry-run');
  args.mode = /^dryrun$/i.test(args.mode) ? 'dry-run' : args.mode;
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/run/execute-agent25-design-options.mjs --run-dir runs/<site-id> --prompt <path>',
    '',
    'This executor performs browser automation for Agent2.5 design-options only.',
    'It captures raw response, screenshot, and generated image evidence, then calls',
    'run-agent25-external-action.mjs to write action-receipt.json.',
  ].join('\n');
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function insideRunDir(runDir, absolutePath) {
  const relPath = path.relative(runDir, absolutePath);
  return relPath && !relPath.startsWith('..') && !path.isAbsolute(relPath);
}

async function resolveRunRelative(runDir, value, label) {
  const candidates = path.isAbsolute(value)
    ? [path.resolve(value)]
    : [path.resolve(runDir, value), path.resolve(value)];
  for (const candidate of candidates) {
    if (insideRunDir(runDir, candidate) && await exists(candidate)) {
      return {
        absolutePath: candidate,
        relPath: path.relative(runDir, candidate).replace(/\\/g, '/'),
      };
    }
  }
  throw new Error(`${label} must exist under run dir: ${path.isAbsolute(value) ? value : path.join(runDir, value)}`);
}

async function ensureParent(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function writeText(runDir, relPath, text) {
  const absolutePath = path.join(runDir, relPath);
  await ensureParent(absolutePath);
  await writeFile(absolutePath, text, 'utf8');
  return absolutePath;
}

async function writeJson(runDir, relPath, data) {
  return writeText(runDir, relPath, `${JSON.stringify(data, null, 2)}\n`);
}

async function copyRunFile(runDir, sourceRelPath, targetRelPath) {
  const source = path.join(runDir, sourceRelPath);
  const target = path.join(runDir, targetRelPath);
  await ensureParent(target);
  await copyFile(source, target);
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function sha256File(runDir, relPath) {
  return sha256Buffer(await readFile(path.join(runDir, relPath)));
}

function normalizeOptionId(value) {
  const text = String(value || '').trim().toLowerCase();
  if (/^(option[-_\s]*)?a$/.test(text) || /option\s+a/i.test(text)) return 'option-a';
  if (/^(option[-_\s]*)?b$/.test(text) || /option\s+b/i.test(text)) return 'option-b';
  if (/^(option[-_\s]*)?c$/.test(text) || /option\s+c/i.test(text)) return 'option-c';
  return text || 'option-a';
}

function optionLabel(optionId) {
  if (optionId === 'option-a') return 'Option A';
  if (optionId === 'option-b') return 'Option B';
  if (optionId === 'option-c') return 'Option C';
  return optionId;
}

export function buildSubmittedPrompt(userPrompt) {
  return [
    'Agent2.5 design-options external execution request.',
    '',
    'You are creating external UI design evidence for a static Astro tool site.',
    'Return high-fidelity first-screen UI mockups that Codex can restore with HTML, CSS, and vanilla JS.',
    '',
    'Required output:',
    '- Create three labeled design directions: Option A, Option B, and Option C.',
    '- Include visible input controls, result cards, realistic data states, and an educational disclaimer when relevant.',
    '- If the design surface can only produce one image, make one generated comparison board with three clearly labeled panels: Option A, Option B, and Option C.',
    '- Keep text readable, high contrast, senior-friendly, and practical for screenshot restoration.',
    '- Do not output only markdown. A visual image/mockup is required.',
    '',
    'User prompt:',
    userPrompt.trim(),
  ].join('\n');
}

export function classifySurfaceState(state) {
  const text = `${state?.title || ''}\n${state?.url || ''}\n${state?.bodyText || ''}`;
  if (!/chatgpt|openai/i.test(text)) {
    return { ok: false, code: NO_APPROVED_UI_GENERATION_AVAILABLE, reason: 'approved design surface is not ChatGPT/OpenAI' };
  }
  if (state?.loginRequired) {
    return { ok: false, code: NO_APPROVED_UI_GENERATION_AVAILABLE, reason: 'ChatGPT/OpenAI surface requires login' };
  }
  if (!state?.hasComposer) {
    return { ok: false, code: NO_APPROVED_UI_GENERATION_AVAILABLE, reason: 'no usable prompt composer found' };
  }
  return { ok: true, code: 'OK', reason: 'approved design surface is available' };
}

export function filterGeneratedImageCandidates(images) {
  return (Array.isArray(images) ? images : []).filter((image) => {
    const width = Number(image.naturalWidth || image.width || 0);
    const height = Number(image.naturalHeight || image.height || 0);
    const src = String(image.src || '');
    const alt = String(image.alt || '');
    const nearbyText = String(image.nearbyText || '');
    if (width < 256 || height < 180) return false;
    if (/avatar|profile|favicon|logo|sprite|icon/i.test(`${src} ${alt} ${nearbyText}`)) return false;
    return Boolean(src);
  });
}

async function runWebAccessPreflight() {
  const script = path.join(REPO_ROOT, 'web-access/scripts/check-deps.sh');
  const result = spawnSync('bash', [script], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
    signal: result.signal,
  };
}

async function cdpRequest(baseUrl, pathname, { method = 'GET', query = {}, body = null, expectJson = true } = {}) {
  const url = new URL(pathname, baseUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method,
    body,
    headers: body && method !== 'GET' ? { 'content-type': 'text/plain; charset=utf-8' } : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${pathname} failed: ${text || response.statusText}`);
  }
  if (!expectJson) return text;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${pathname} returned non-JSON response: ${text.slice(0, 200)}`);
  }
}

async function cdpEval(baseUrl, targetId, expression) {
  const result = await cdpRequest(baseUrl, '/eval', {
    method: 'POST',
    query: { target: targetId },
    body: expression,
  });
  if (result?.error) throw new Error(result.error);
  return result.value;
}

function inspectSurfaceScript() {
  return `(() => {
    const text = document.body?.innerText || '';
    const composerSelectors = [
      '#prompt-textarea',
      'textarea[placeholder*="Message"]',
      'textarea[aria-label*="ChatGPT"]',
      'textarea.wcDTda_fallbackTextarea',
      'form textarea',
      'textarea[placeholder]',
      'textarea[data-id="root"]',
      'div[contenteditable="true"][id="prompt-textarea"]',
      'div[contenteditable="true"][data-placeholder*="Message"]',
      'main div[contenteditable="true"]'
    ];
    const sendSelectors = [
      '[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[data-testid*="send"]'
    ];
    const composer = composerSelectors.map((selector) => document.querySelector(selector)).find(Boolean);
    const send = sendSelectors.map((selector) => document.querySelector(selector)).find(Boolean);
    const loginRequired = /\\b(log in|sign up|sign in|get started)\\b/i.test(text)
      && !composer
      && !/message chatgpt|ask anything|prompt/i.test(text);
    return {
      title: document.title,
      url: location.href,
      readyState: document.readyState,
      bodyText: text.slice(0, 6000),
      hasComposer: Boolean(composer),
      hasSendButton: Boolean(send),
      loginRequired,
      composerTag: composer?.tagName || '',
      composerId: composer?.id || '',
    };
  })()`;
}

function submitPromptScript(prompt) {
  const promptJson = JSON.stringify(prompt);
  return `(async () => {
    const prompt = ${promptJson};
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const selectors = [
      '#prompt-textarea',
      'textarea[placeholder*="Message"]',
      'textarea[aria-label*="ChatGPT"]',
      'textarea.wcDTda_fallbackTextarea',
      'form textarea',
      'textarea[placeholder]',
      'textarea[data-id="root"]',
      'div[contenteditable="true"][id="prompt-textarea"]',
      'div[contenteditable="true"][data-placeholder*="Message"]',
      'main div[contenteditable="true"]'
    ];
    const composer = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
    if (!composer) return { ok: false, error: 'prompt composer not found' };
    composer.scrollIntoView({ block: 'center' });
    composer.focus();
    if (composer.tagName === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(composer, prompt);
      else composer.value = prompt;
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    } else {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, prompt);
      if (!(composer.innerText || composer.textContent || '').trim()) {
        composer.textContent = prompt;
        composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
      }
    }
    await sleep(750);
    const sendSelectors = [
      '[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[data-testid*="send"]'
    ];
    let send = null;
    for (let i = 0; i < 40; i += 1) {
      send = sendSelectors.map((selector) => document.querySelector(selector)).find((button) => button && !button.disabled && button.getAttribute('aria-disabled') !== 'true');
      if (send) break;
      await sleep(250);
    }
    if (!send) return { ok: false, error: 'enabled send button not found' };
    send.click();
    return { ok: true, composerTag: composer.tagName, sendText: (send.textContent || send.getAttribute('aria-label') || '').slice(0, 80) };
  })()`;
}

function snapshotScript() {
  return `(() => {
    const bodyText = document.body?.innerText || '';
    const assistantNodes = Array.from(document.querySelectorAll('[data-message-author-role="assistant"], article, main [class*="markdown"], main [data-testid*="conversation"]'));
    const assistantText = assistantNodes.map((node) => node.innerText || node.textContent || '').filter(Boolean).slice(-8).join('\\n\\n').slice(0, 24000);
    const images = Array.from(document.images).map((img, index) => {
      const rect = img.getBoundingClientRect();
      const parent = img.closest('article, [data-message-author-role], main, div');
      return {
        index,
        src: img.currentSrc || img.src || '',
        alt: img.alt || '',
        width: Math.round(rect.width || img.width || 0),
        height: Math.round(rect.height || img.height || 0),
        naturalWidth: img.naturalWidth || 0,
        naturalHeight: img.naturalHeight || 0,
        nearbyText: (parent?.innerText || '').slice(0, 300),
      };
    });
    const streaming = Boolean(document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop"], button[aria-label*="停止"]'));
    return {
      title: document.title,
      url: location.href,
      bodyText: bodyText.slice(0, 24000),
      assistantText,
      images,
      streaming,
      capturedAt: new Date().toISOString(),
    };
  })()`;
}

function imageToPngScript(imageIndex) {
  return `(async () => {
    const img = Array.from(document.images)[${Number(imageIndex)}];
    if (!img) return { ok: false, error: 'image not found' };
    if (!img.complete) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('image load timeout')), 30000);
        img.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
        img.addEventListener('error', () => { clearTimeout(timer); reject(new Error('image load failed')); }, { once: true });
      });
    }
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return { ok: false, error: 'image has no dimensions' };
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/png');
    return { ok: true, width, height, base64: dataUrl.split(',')[1] };
  })()`;
}

async function openSurface(args, log) {
  if (args.reuseExisting) {
    const targets = await cdpRequest(args.cdpBaseUrl, '/targets');
    const match = targets.find((target) => /chatgpt\.com|chat\.openai\.com/i.test(target.url || ''));
    if (match?.targetId) {
      log.steps.push({ step: 'reuse-target', targetId: match.targetId, url: match.url });
      return { targetId: match.targetId, created: false };
    }
  }
  const created = await cdpRequest(args.cdpBaseUrl, '/new', { query: { url: args.surfaceUrl } });
  if (!created?.targetId) throw new Error('CDP did not return targetId for new approved design surface tab');
  log.steps.push({ step: 'new-target', targetId: created.targetId, url: args.surfaceUrl });
  const info = await cdpRequest(args.cdpBaseUrl, '/info', { query: { target: created.targetId } }).catch(() => null);
  if (!info?.url || info.url === 'about:blank') {
    await cdpRequest(args.cdpBaseUrl, '/navigate', { query: { target: created.targetId, url: args.surfaceUrl } });
    log.steps.push({ step: 'navigate-target', targetId: created.targetId, url: args.surfaceUrl });
  }
  return { targetId: created.targetId, created: true };
}

async function waitForGeneratedImage(args, targetId, log) {
  const started = Date.now();
  let previousText = '';
  let stableCount = 0;
  let lastSnapshot = null;

  while (Date.now() - started < args.timeoutMs) {
    const snapshot = await cdpEval(args.cdpBaseUrl, targetId, snapshotScript());
    const candidates = filterGeneratedImageCandidates(snapshot?.images);
    lastSnapshot = { ...snapshot, imageCandidates: candidates };
    const text = `${snapshot?.assistantText || ''}\n${snapshot?.bodyText || ''}`;
    stableCount = text && text === previousText ? stableCount + 1 : 0;
    previousText = text;
    log.steps.push({
      step: 'poll-generation',
      elapsedMs: Date.now() - started,
      imageCandidates: candidates.length,
      streaming: Boolean(snapshot?.streaming),
      stableCount,
    });
    if (candidates.length > 0 && !snapshot?.streaming && stableCount >= 1) return lastSnapshot;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  const error = new Error('timeout waiting for generated image evidence');
  error.snapshot = lastSnapshot;
  throw error;
}

async function saveGeneratedImage(args, targetId, candidate, runDir, relPath) {
  const result = await cdpEval(args.cdpBaseUrl, targetId, imageToPngScript(candidate.index));
  if (!result?.ok || !result.base64) {
    throw new Error(`generated image export failed: ${result?.error || 'missing base64 data'}`);
  }
  const absolutePath = path.join(runDir, relPath);
  await ensureParent(absolutePath);
  await writeFile(absolutePath, Buffer.from(result.base64, 'base64'));
  const fileStat = await stat(absolutePath);
  if (fileStat.size < 10_000) throw new Error(`generated image export is too small: ${relPath}`);
  return { path: relPath, width: result.width, height: result.height, size: fileStat.size };
}

async function writeConversationScreenshot(args, targetId, runDir) {
  const absolutePath = path.join(runDir, OUTPUTS.screenshot);
  await ensureParent(absolutePath);
  await cdpRequest(args.cdpBaseUrl, '/screenshot', {
    query: { target: targetId, file: absolutePath },
  });
  const fileStat = await stat(absolutePath);
  if (fileStat.size < 10_000) throw new Error(`conversation screenshot is too small: ${OUTPUTS.screenshot}`);
  return { path: OUTPUTS.screenshot, size: fileStat.size };
}

async function writeGateArtifacts({ runDir, args, prompt, submittedPrompt, snapshot, imageRecord }) {
  await writeText(runDir, OUTPUTS.submittedPrompt, submittedPrompt);

  const responseText = [
    '# Raw External Response Capture',
    '',
    'Kind: raw external response / conversation export',
    'Surface: ChatGPT web UI approved design surface',
    `Captured at: ${new Date().toISOString()}`,
    `Executor version: ${EXECUTOR_VERSION}`,
    '',
    '## Submitted Prompt',
    '',
    submittedPrompt,
    '',
    '## Captured Conversation Text',
    '',
    snapshot.assistantText || snapshot.bodyText || '',
    '',
    '## Captured Image Evidence',
    '',
    `Generated image: ${imageRecord.path}`,
  ].join('\n');
  await writeText(runDir, OUTPUTS.rawResponse, responseText);

  for (const target of [
    OUTPUTS.optionA,
    OUTPUTS.optionB,
    OUTPUTS.optionC,
    OUTPUTS.optionsBoard,
    OUTPUTS.desktopTarget,
    OUTPUTS.mobileTarget,
  ]) {
    await copyRunFile(runDir, imageRecord.path, target);
  }

  const shas = {
    externalResponse: await sha256File(runDir, OUTPUTS.rawResponse),
    screenshot: await sha256File(runDir, OUTPUTS.screenshot),
    generatedImage: await sha256File(runDir, imageRecord.path),
    optionA: await sha256File(runDir, OUTPUTS.optionA),
    optionB: await sha256File(runDir, OUTPUTS.optionB),
    optionC: await sha256File(runDir, OUTPUTS.optionC),
    optionsBoard: await sha256File(runDir, OUTPUTS.optionsBoard),
    desktopTarget: await sha256File(runDir, OUTPUTS.desktopTarget),
    mobileTarget: await sha256File(runDir, OUTPUTS.mobileTarget),
  };

  const selectedOption = normalizeOptionId(args.selectedOption);
  const selectedLabel = optionLabel(selectedOption);
  await writeText(
    runDir,
    OUTPUTS.sourceProvenance,
    [
      '# Source Provenance',
      '',
      'Decision: PASS',
      `Option A: ChatGPT approved external image source ${OUTPUTS.optionA} sha ${shas.optionA}.`,
      `Option B: ChatGPT approved external image source ${OUTPUTS.optionB} sha ${shas.optionB}.`,
      `Option C: ChatGPT approved external image source ${OUTPUTS.optionC} sha ${shas.optionC}.`,
      `Selected option: ${selectedLabel} from ChatGPT approved external generated image evidence.`,
      `Desktop target: ${OUTPUTS.desktopTarget} maps to ${selectedLabel} and source image sha ${shas.desktopTarget}.`,
      `Mobile target: ${OUTPUTS.mobileTarget} maps to ${selectedLabel} and source image sha ${shas.mobileTarget}.`,
    ].join('\n'),
  );

  await writeText(
    runDir,
    OUTPUTS.selectedLineage,
    [
      '# Selected Design Lineage',
      '',
      'Decision: PASS',
      `${selectedLabel} came from the ChatGPT approved external option image captured by the Agent2.5 design-options executor.`,
    ].join('\n'),
  );

  const dryRun = !/^production$/i.test(args.mode);
  await writeText(
    runDir,
    OUTPUTS.optionSelection,
    dryRun
      ? [
          '# Option Selection',
          '',
          'Decision: PASS',
          'Option A, Option B, and Option C were shown in chat as a dry-run option board.',
          `${selectedLabel} was selected by dry-run executor default for isolated smoke testing only.`,
        ].join('\n')
      : [
          '# Option Selection',
          '',
          'Decision: PASS',
          'Option A, Option B, and Option C were delivered to chat in chat-delivery/options-board.png.',
          `Current chat user selected ${selectedLabel}.`,
        ].join('\n'),
  );

  await writeJson(runDir, OUTPUTS.proof, {
    schemaVersion: 1,
    mode: args.mode,
    approvedDesignSurface: 'ChatGPT approved design surface via web-access Chrome CDP',
    executor: {
      version: EXECUTOR_VERSION,
      inputPromptPath: prompt.relPath,
      submittedPromptPath: OUTPUTS.submittedPrompt,
      generatedImagePath: imageRecord.path,
    },
    externalResponse: {
      path: OUTPUTS.rawResponse,
      kind: 'raw exported model response',
      sha256: shas.externalResponse,
    },
    conversationScreenshot: {
      path: OUTPUTS.screenshot,
      surface: 'ChatGPT web UI approved design surface',
      sha256: shas.screenshot,
    },
    options: [
      { id: 'option-a', label: 'Option A', source: 'GPT generated option source image', imagePath: OUTPUTS.optionA, sha256: shas.optionA },
      { id: 'option-b', label: 'Option B', source: 'GPT generated option source image', imagePath: OUTPUTS.optionB, sha256: shas.optionB },
      { id: 'option-c', label: 'Option C', source: 'GPT generated option source image', imagePath: OUTPUTS.optionC, sha256: shas.optionC },
    ],
    optionsBoard: {
      path: OUTPUTS.optionsBoard,
      source: 'assembled from GPT option source images',
      containsOptionImageHashes: [shas.optionA, shas.optionB, shas.optionC],
      sha256: shas.optionsBoard,
    },
    selection: {
      source: dryRun ? 'dry-run executor default after generated board capture' : 'current-chat-user',
      selectedBy: dryRun ? 'dry-run executor' : 'current chat user',
      selectedOption,
    },
    targets: {
      desktop: {
        path: OUTPUTS.desktopTarget,
        source: 'derived from GPT external option source',
        sourceOption: selectedOption,
        sha256: shas.desktopTarget,
      },
      mobile: {
        path: OUTPUTS.mobileTarget,
        source: 'derived from GPT external option source',
        sourceOption: selectedOption,
        sha256: shas.mobileTarget,
      },
    },
    selectedDesignPackage: {
      source: 'GPT external option package captured by Agent2.5 design-options executor',
      sourceOption: selectedOption,
      codexLocalCreation: false,
    },
  });

  return shas;
}

function runNodeScript(scriptRelPath, args) {
  return spawnSync(process.execPath, [scriptRelPath, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120_000,
  });
}

async function runReceiptRunner(runDir) {
  const args = [
    '--run-dir', runDir,
    '--action', 'design-options',
    '--prompt', OUTPUTS.submittedPrompt,
    '--raw-response', OUTPUTS.rawResponse,
    '--screenshot', OUTPUTS.screenshot,
    '--download', OUTPUTS.generatedImage,
    '--artifact', OUTPUTS.optionA,
    '--artifact', OUTPUTS.optionB,
    '--artifact', OUTPUTS.optionC,
    '--artifact', OUTPUTS.optionsBoard,
    '--artifact', OUTPUTS.desktopTarget,
    '--artifact', OUTPUTS.mobileTarget,
  ];
  return runNodeScript('scripts/run/run-agent25-external-action.mjs', args);
}

async function runProofGate(runDir) {
  return runNodeScript('scripts/run/check-agent25-external-design-proof.mjs', ['--run-dir', runDir, '--write']);
}

async function fail({ runDir, log, code, message, exitCode = 1 }) {
  log.status = 'failed';
  log.error = { code, message };
  log.completed_at = new Date().toISOString();
  await writeJson(runDir, OUTPUTS.executorLog, log);
  console.log(code);
  console.log(message);
  process.exitCode = exitCode;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const runDir = path.resolve(args.runDir);
  await mkdir(runDir, { recursive: true });
  const prompt = await resolveRunRelative(runDir, args.prompt, 'prompt');
  const promptText = await readFile(prompt.absolutePath, 'utf8');
  const submittedPrompt = buildSubmittedPrompt(promptText);
  const log = {
    schemaVersion: 1,
    executor_version: EXECUTOR_VERSION,
    started_at: new Date().toISOString(),
    run_dir: path.relative(process.cwd(), runDir).replace(/\\/g, '/'),
    input_prompt: prompt.relPath,
    mode: args.mode,
    surface_url: args.surfaceUrl,
    cdp_base_url: args.cdpBaseUrl,
    steps: [],
  };

  let openedTarget = null;
  try {
    const preflight = await runWebAccessPreflight();
    log.steps.push({ step: 'web-access-preflight', ok: preflight.ok, status: preflight.status, signal: preflight.signal });
    if (!preflight.ok) {
      await fail({
        runDir,
        log,
        code: NO_APPROVED_UI_GENERATION_AVAILABLE,
        message: ['web-access unavailable', preflight.stdout.trim(), preflight.stderr.trim()].filter(Boolean).join('\n'),
      });
      return;
    }

    openedTarget = await openSurface(args, log);
    const surfaceState = await cdpEval(args.cdpBaseUrl, openedTarget.targetId, inspectSurfaceScript());
    log.steps.push({ step: 'inspect-surface', state: surfaceState });
    const classified = classifySurfaceState(surfaceState);
    if (!classified.ok) {
      await fail({ runDir, log, code: classified.code, message: classified.reason });
      return;
    }

    await writeText(runDir, OUTPUTS.submittedPrompt, submittedPrompt);
    const submit = await cdpEval(args.cdpBaseUrl, openedTarget.targetId, submitPromptScript(submittedPrompt));
    log.steps.push({ step: 'submit-prompt', result: submit });
    if (!submit?.ok) {
      await fail({ runDir, log, code: EXTERNAL_ACTION_FAILED, message: submit?.error || 'prompt submit failed' });
      return;
    }

    const snapshot = await waitForGeneratedImage(args, openedTarget.targetId, log);
    const candidates = filterGeneratedImageCandidates(snapshot.images);
    if (!candidates.length) {
      await fail({ runDir, log, code: EXTERNAL_ACTION_FAILED, message: 'no generated image evidence found' });
      return;
    }

    const screenshotRecord = await writeConversationScreenshot(args, openedTarget.targetId, runDir);
    log.steps.push({ step: 'save-conversation-screenshot', screenshot: screenshotRecord });
    let imageRecord;
    try {
      imageRecord = await saveGeneratedImage(args, openedTarget.targetId, candidates[0], runDir, OUTPUTS.generatedImage);
      log.steps.push({ step: 'save-generated-image', image: imageRecord });
    } catch (error) {
      await copyRunFile(runDir, OUTPUTS.screenshot, OUTPUTS.generatedImage);
      const imageStat = await stat(path.join(runDir, OUTPUTS.generatedImage));
      imageRecord = {
        path: OUTPUTS.generatedImage,
        size: imageStat.size,
        source: 'conversation-screenshot-containing-generated-image',
        exportError: error.message,
      };
      log.steps.push({ step: 'save-generated-image-fallback', image: imageRecord });
    }
    const hashes = await writeGateArtifacts({ runDir, args, prompt, submittedPrompt, snapshot, imageRecord });
    log.steps.push({ step: 'write-proof-artifacts', hashes });

    const receipt = await runReceiptRunner(runDir);
    log.steps.push({ step: 'run-evidence-runner', status: receipt.status, stdout: receipt.stdout, stderr: receipt.stderr });
    if (receipt.status !== 0) {
      await fail({ runDir, log, code: EXTERNAL_ACTION_FAILED, message: receipt.stdout || receipt.stderr || 'evidence runner failed' });
      return;
    }

    const gate = await runProofGate(runDir);
    log.steps.push({ step: 'run-external-design-proof-gate', status: gate.status, stdout: gate.stdout, stderr: gate.stderr });
    if (gate.status !== 0) {
      await fail({ runDir, log, code: EXTERNAL_ACTION_FAILED, message: gate.stdout || gate.stderr || 'external design proof gate failed' });
      return;
    }

    log.status = 'pass';
    log.completed_at = new Date().toISOString();
    await writeJson(runDir, OUTPUTS.executorLog, log);
    console.log(`PASS Agent2.5 design-options executor: ${path.relative(process.cwd(), path.join(runDir, OUTPUTS.executorLog))}`);
  } catch (error) {
    await fail({ runDir, log, code: EXTERNAL_ACTION_FAILED, message: error.message, exitCode: 2 });
  } finally {
    if (openedTarget?.created && !args.keepTab) {
      try {
        await cdpRequest(args.cdpBaseUrl, '/close', { query: { target: openedTarget.targetId } });
      } catch {
        // Non-fatal cleanup failure.
      }
    }
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 2;
  });
}
