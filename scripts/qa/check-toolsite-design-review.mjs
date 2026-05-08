#!/usr/bin/env node
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { resultFromFailures, writeGateResult } from '../run/gate-result-utils.mjs';
import { reportHasPassDecision } from '../run/check-gates.mjs';

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
  if (!args.runDir) throw new Error('Usage: node scripts/qa/check-toolsite-design-review.mjs --run-dir runs/<site-id> [--write]');
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

async function readFilesRecursive(dir) {
  const texts = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        texts.push(await readFilesRecursive(fullPath));
      } else if (/\.(html|css|js|jsx|ts|tsx|astro|md)$/i.test(entry.name)) {
        texts.push(await readOptional(fullPath));
      }
    }
  } catch {
    return '';
  }
  return texts.join('\n');
}

function has(text, pattern) {
  return pattern.test(text || '');
}

function countMatches(text, pattern) {
  return [...String(text || '').matchAll(pattern)].length;
}

function runCheck(name, passed, failures, message) {
  if (!passed) failures.push(`${name}: ${message}`);
  return { name, passed, message: passed ? 'pass' : message };
}

export async function runToolsiteDesignReviewGate({ runDir }) {
  const absoluteRunDir = path.resolve(runDir);
  const selectedDir = path.join(absoluteRunDir, 'agent-2-5-output/selected-design');
  const paths = {
    componentSpec: path.join(selectedDir, 'component-spec.md'),
    usabilityContract: path.join(selectedDir, 'usability-contract.md'),
    dynamicDataFit: path.join(selectedDir, 'dynamic-data-fit.md'),
    uxSelfAudit: path.join(selectedDir, 'ux-self-audit.md'),
    interactionModel: path.join(selectedDir, 'interaction-state-model.md'),
    forbiddenDeviations: path.join(selectedDir, 'forbidden-deviations.md'),
    restorationRules: path.join(selectedDir, 'restoration-rules.md'),
    designManifest: path.join(absoluteRunDir, 'agent-2-5-output/design-manifest.md'),
    designPackageReport: path.join(absoluteRunDir, 'agent-5-output/design-package-gate-report.md'),
    selectedCode: path.join(selectedDir, 'code'),
  };

  const [
    componentSpec,
    usabilityContract,
    dynamicDataFit,
    uxSelfAudit,
    interactionModel,
    forbiddenDeviations,
    restorationRules,
    designManifest,
    designPackageReport,
    selectedCode,
  ] = await Promise.all([
    readOptional(paths.componentSpec),
    readOptional(paths.usabilityContract),
    readOptional(paths.dynamicDataFit),
    readOptional(paths.uxSelfAudit),
    readOptional(paths.interactionModel),
    readOptional(paths.forbiddenDeviations),
    readOptional(paths.restorationRules),
    readOptional(paths.designManifest),
    readOptional(paths.designPackageReport),
    readFilesRecursive(paths.selectedCode),
  ]);

  const failures = [];
  const requiredFiles = [
    ['component spec', paths.componentSpec],
    ['usability contract', paths.usabilityContract],
    ['dynamic data fit', paths.dynamicDataFit],
    ['UX self-audit', paths.uxSelfAudit],
    ['interaction state model', paths.interactionModel],
    ['forbidden deviations', paths.forbiddenDeviations],
    ['restoration rules', paths.restorationRules],
    ['design manifest', paths.designManifest],
    ['Agent 5 design package gate report', paths.designPackageReport],
  ];
  for (const [label, filePath] of requiredFiles) {
    if (!(await exists(filePath))) failures.push(`missing ${label}: ${path.relative(absoluteRunDir, filePath)}`);
  }
  if (!reportHasPassDecision(designPackageReport)) {
    failures.push('Agent 5 design package gate report must include Decision: PASS before toolsite design-review subset can pass');
  }

  const docsText = [
    componentSpec,
    usabilityContract,
    dynamicDataFit,
    uxSelfAudit,
    interactionModel,
    forbiddenDeviations,
    restorationRules,
    designManifest,
    designPackageReport,
  ].join('\n');
  const combined = `${docsText}\n${selectedCode}`;
  const checks = [];

  checks.push(runCheck(
    'First Impression Gate',
    has(combined, /first\s+viewport/i)
      && has(combined, /\b(tool|calculator|typing|converter|generator|checker|input|workflow)\b/i)
      && has(componentSpec, /\b(input|textarea|upload|paste|select|control|action|button)\b/i)
      && has(componentSpec, /\b(result|output|metric|preview|feedback|WPM|accuracy|score)\b/i),
    failures,
    'selected design must make the tool, primary input/action, and result/feedback area obvious in the first viewport',
  ));

  const genericHeroCopy = /welcome\s+to|unlock\s+the\s+power|all[-\s]in[-\s]one\s+solution|revolutionize\s+your|supercharge\s+your|seamless\s+experience/i;
  const decorativeSlop = /\b(blob|bokeh|orb|floating-circle|decorative-circle|wavy-divider|feature-grid|three-column-feature)\b/i;
  const emojiCount = countMatches(selectedCode, /[\u{1F300}-\u{1FAFF}]/gu);
  const centeredEverythingCount = countMatches(selectedCode, /text-align\s*:\s*center/gi);
  checks.push(runCheck(
    'AI Slop Gate',
    !genericHeroCopy.test(selectedCode)
      && !decorativeSlop.test(selectedCode)
      && emojiCount === 0
      && centeredEverythingCount <= 3,
    failures,
    'selected code must avoid generic hero copy, decorative blobs/orbs, emoji design, and centered-everything template patterns',
  ));

  checks.push(runCheck(
    'Tool-First Trunk Test',
    has(selectedCode, /\b(header|brand|h1|site-header)\b/i)
      && has(selectedCode, /\b(main|tool-panel|calculator|tool-shell|data-tool-root)\b/i)
      && has(combined, /\b(input|textarea|upload|paste|select|control)\b/i)
      && has(combined, /\b(button|action|copy|download|restart|convert|calculate|generate|new\s+passage)\b/i)
      && has(combined, /\b(result|output|metric|preview|feedback|WPM|accuracy|mistake|score)\b/i),
    failures,
    'users must be able to identify site identity, current tool, input path, action path, and output/result path without reading instructions',
  ));

  const firstToolIndex = selectedCode.search(/\b(tool-panel|calculator|tool-shell|data-tool-root|textarea|input)\b/i);
  const firstNonToolIndex = selectedCode.search(/\b(hero|faq|schema|seo|article|blog|content-band|marketing|testimonial|feature-grid|features)\b/i);
  checks.push(runCheck(
    'Visual Hierarchy / Scan Gate',
    has(componentSpec, /first\s+viewport/i)
      && has(uxSelfAudit, /\b(first\s+viewport|live\s+feedback|visible\s+active|readable|tool itself)\b/i)
      && firstToolIndex >= 0
      && (firstNonToolIndex < 0 || firstToolIndex < firstNonToolIndex),
    failures,
    'scan order must put the actual tool before SEO/marketing/support content and make live feedback or active state visible',
  ));

  checks.push(runCheck(
    'Mobile Tool Usability Gate',
    has(`${usabilityContract}\n${dynamicDataFit}\n${uxSelfAudit}`, /mobile/i)
      && has(`${usabilityContract}\n${dynamicDataFit}\n${uxSelfAudit}`, /\b(tap|touch|readable|wrap|responsive|390px|no horizontal overflow)\b/i)
      && !has(selectedCode, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i),
    failures,
    'mobile design must document readable/tappable tool use and must not disable user zoom',
  ));

  checks.push(runCheck(
    'Interaction Feel Gate',
    has(interactionModel, /\b(idle|running|complete|reset|active|selected|error|success|current|feedback)\b/i)
      && has(interactionModel, /\b(input|button|control|typing|toggle|action)\b/i)
      && has(interactionModel, /\b(result|metric|output|status|feedback|state)\b/i)
      && has(usabilityContract, /\b(visibly|visible|active|feedback|clears|updates|resets)\b/i),
    failures,
    'primary interactions must define visible state changes, feedback/results, and reset/clear behavior',
  ));

  return resultFromFailures({
    gate: 'toolsite-design-review',
    runDir: absoluteRunDir,
    failures,
    details: {
      checks,
      antiSlopSignals: {
        emojiCount,
        centeredEverythingCount,
        genericHeroCopy: genericHeroCopy.test(selectedCode),
        decorativeSlop: decorativeSlop.test(selectedCode),
      },
    },
    evidence: {
      componentSpec: 'agent-2-5-output/selected-design/component-spec.md',
      usabilityContract: 'agent-2-5-output/selected-design/usability-contract.md',
      dynamicDataFit: 'agent-2-5-output/selected-design/dynamic-data-fit.md',
      uxSelfAudit: 'agent-2-5-output/selected-design/ux-self-audit.md',
      interactionModel: 'agent-2-5-output/selected-design/interaction-state-model.md',
      selectedCode: 'agent-2-5-output/selected-design/code/',
      designPackageReport: 'agent-5-output/design-package-gate-report.md',
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runToolsiteDesignReviewGate({ runDir: args.runDir });
  if (args.write) await writeGateResult(path.resolve(args.runDir), 'toolsite-design-review.json', result);
  console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} toolsite design-review subset`);
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
