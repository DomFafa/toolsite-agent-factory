import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkRunGates, SMOKE_RUN_BLOCK_MESSAGE } from './check-gates.mjs';
import {
  continueHumanReview,
  INVALID_REPLY,
  NO_REPLY_FOUND,
  NO_OPEN_REVIEW,
  REVIEW_RESOLVED,
  AGENT6_READY,
} from './continue-human-review.mjs';
import {
  DEFAULT_HERMES_INBOX,
  DEFAULT_HERMES_REMOTE_STATE,
  INCOMPLETE_INTAKE,
  MISSING_REQUIRED_ATTACHMENT,
  MISSING_PRODUCTION_START_INTENT,
  readHermesIntake,
  STALE_INTAKE_REJECTED,
} from './read-hermes-intake.mjs';
import { runLoopIteration } from './pre-agent2-telegram-loop.mjs';
import { attachmentPurpose } from './pre-agent2-question-planner.mjs';
import { summarizeReviewEvents } from './resolve-human-review-from-hermes-inbox.mjs';

export const STOPPED_AT_HUMAN_REVIEW = 'STOPPED_AT_HUMAN_REVIEW';
export const NEXT_STAGE_READY = 'NEXT_STAGE_READY';
export const FLOW_COMPLETE = 'FLOW_COMPLETE';
export const DEPLOY_BLOCKED = 'DEPLOY_BLOCKED';
export const DEPLOY_NOT_RUN = 'DEPLOY_NOT_RUN';
export const WAITING_FOR_FRESH_INTAKE = 'WAITING_FOR_FRESH_INTAKE';
export const RUN_ALREADY_EXISTS = 'RUN_ALREADY_EXISTS';
export const PRODUCTION_RUN_CREATED = 'PRODUCTION_RUN_CREATED';
export const ATTACHMENT_FILE_MISSING = 'ATTACHMENT_FILE_MISSING';

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

function parseJsonl(text) {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function readHumanReviewSummary(runDir) {
  const text = await readOptional(path.join(runDir, 'human-review-events.jsonl'));
  const events = text.trim() ? parseJsonl(text) : [];
  return summarizeReviewEvents(events);
}

async function readRunMeta(runDir) {
  const text = await readOptional(path.join(runDir, 'run-meta.json'));
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function siteIdFromDomain(domain) {
  let clean = String(domain || '').trim().toLowerCase();
  clean = clean.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  clean = clean.split('/')[0] || clean;
  clean = clean.split('?')[0] || clean;
  clean = clean.split('#')[0] || clean;
  clean = clean.split(':')[0] || clean;
  clean = clean.replace(/^www\./, '');

  const labels = clean.split('.').filter(Boolean);
  if (labels.length > 1) labels.pop();
  const base = labels.join('-') || clean;

  return base
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function intakeCodeToProductionStartCode(result) {
  if (result.code === 'stale-intake') return STALE_INTAKE_REJECTED;
  if (result.code === 'missing-production-start-intent') return MISSING_PRODUCTION_START_INTENT;
  if (result.code === 'incomplete-intake') return INCOMPLETE_INTAKE;
  if (result.code === 'missing-required-attachment') return MISSING_REQUIRED_ATTACHMENT;
  return WAITING_FOR_FRESH_INTAKE;
}

function safeFileName(value, fallback = 'attachment') {
  const safe = String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return safe || fallback;
}

async function prepareAttachmentCopyPlan({ runDir, intake }) {
  const attachments = Array.isArray(intake.attachments) ? intake.attachments : [];
  const copyPlan = [];
  const purpose = attachmentPurpose({
    keyword: intake.keyword,
    target_domain: intake.target_domain,
    extra_notes: intake.extra_notes,
  }) || 'design_reference';
  for (const [index, attachment] of attachments.entries()) {
    if (attachment.kind !== 'image') continue;
    const sourcePath = String(attachment.local_path || '').trim();
    if (!sourcePath) {
      return { ok: false, code: MISSING_REQUIRED_ATTACHMENT, message: MISSING_REQUIRED_ATTACHMENT };
    }
    if (!(await exists(sourcePath))) {
      return {
        ok: false,
        code: ATTACHMENT_FILE_MISSING,
        message: `${ATTACHMENT_FILE_MISSING}: ${sourcePath}`,
      };
    }
    const parsed = path.parse(attachment.file_name || sourcePath);
    const extension = parsed.ext || path.extname(sourcePath) || '.jpg';
    const baseName = safeFileName(parsed.name || `image-${index + 1}`, `image-${index + 1}`);
    const fileName = `${String(index + 1).padStart(2, '0')}-${baseName}${extension}`;
    const runRelativePath = path.join('input-assets', fileName);
    copyPlan.push({
      sourcePath,
      destinationPath: path.join(runDir, runRelativePath),
      runRelativePath,
      metadata: {
        kind: attachment.kind,
        telegram_file_id: attachment.telegram_file_id || '',
        source_local_path: sourcePath,
        run_path: runRelativePath,
        purpose,
        mime_type: attachment.mime_type || '',
        file_name: attachment.file_name || fileName,
        width: attachment.width ?? null,
        height: attachment.height ?? null,
      },
    });
  }
  return { ok: true, attachments: copyPlan };
}

function inputAssetsSection(attachmentPlan) {
  if (!attachmentPlan.length) {
    return ['## Input assets', '', '- No image attachments were provided with this intake.', ''];
  }
  return [
    '## Input assets',
    '',
    '- The following assets came from the fresh Hermes Telegram intake and must be visible to later design agents.',
    ...attachmentPlan.map(
      ({ metadata }) =>
        `- ${metadata.kind}: ${metadata.run_path} (purpose: ${metadata.purpose}, source: ${metadata.source_local_path}, telegram_file_id: ${metadata.telegram_file_id || 'unknown'})`,
    ),
    '',
  ];
}

function filledRunInput({ siteId, intake, attachmentPlan = [] }) {
  return [
    '# Run Input',
    '',
    '## Site',
    '',
    `- Site ID: ${siteId}`,
    `- Target domain: ${intake.target_domain}`,
    `- Primary keyword: ${intake.keyword}`,
    `- Brief requirements: ${intake.extra_notes}`,
    '',
    '## Pre-Agent2 required user inputs',
    '',
    '- These five fields were read from a fresh Hermes production-start intake.',
    '',
    `- Keyword / 关键词: ${intake.keyword}`,
    `- Target Domain / 目标域名: ${intake.target_domain}`,
    `- UI Reference / UI 参考: ${intake.ui_reference}`,
    `- UX Reference / UX 参考: ${intake.ux_reference}`,
    `- Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点: ${intake.extra_notes}`,
    '',
    ...inputAssetsSection(attachmentPlan),
    'Before Agent 2 starts, complete and confirm `toolsite-spec.md`, then run:',
    '',
    '```bash',
    `npm run check:pre-agent2-spec -- --run-dir runs/${siteId} --write`,
    '```',
    '',
    '## UI and UX references',
    '',
    '### Reference 1',
    '',
    '- Type: mood | component | layout | interaction',
    '- Reference URL:',
    '- Desktop screenshot path:',
    '- Mobile screenshot path:',
    '- Component/image path:',
    `- What to borrow: ${intake.ui_reference}`,
    `- What to avoid: Do not copy ${intake.ux_reference} layout or visuals verbatim.`,
    '- Reference strength: mood | interaction',
    '',
    '## Constraints',
    '',
    '- Language: English',
    '- Site type: static frontend tool',
    '- Backend: none',
    '- Database: none',
    '- Login: none',
    '- API keys: none',
    '- Analytics: Cloudflare Web Analytics',
    '- Ads: disabled, reserve monetization slots only',
    '- Development indexing: noindex',
    '- Production indexing: index only after approval',
    '',
  ].join('\n');
}

async function writeProductionRunFiles({ rootDir, runDir, siteId, intake, createdAt, attachmentPlan = [] }) {
  const directories = [
    'agent-1-output',
    'agent-2-output',
    'agent-2-5-output/chat-delivery',
    'agent-3-output',
    'agent-4-output',
    'agent-5-output/chat-delivery',
    'agent-6-output',
    'assets',
    'gate-results',
    'input-assets',
    'site',
  ];
  for (const directory of directories) {
    await mkdir(path.join(runDir, directory), { recursive: true });
  }

  for (const item of attachmentPlan) {
    await mkdir(path.dirname(item.destinationPath), { recursive: true });
    await copyFile(item.sourcePath, item.destinationPath);
  }

  await writeFile(path.join(runDir, 'input.md'), filledRunInput({ siteId, intake, attachmentPlan }));
  await copyFile(path.join(rootDir, 'shared/templates/approval.template.md'), path.join(runDir, 'approval.md'));
  await writeFile(path.join(runDir, 'issues.md'), '');
  await writeFile(
    path.join(runDir, 'state.json'),
    `${JSON.stringify(
      {
        site_id: siteId,
        domain: intake.target_domain,
        status: 'initialized',
        current_agent: null,
        approved_for_production: false,
        agent_outputs: {
          agent_1: null,
          agent_2: null,
          agent_2_5: null,
          agent_3: null,
          agent_4: null,
          agent_5: null,
          agent_6: null,
        },
        qa: {
          passed: false,
          report: null,
        },
        launch: {
          cloudflare_project: `dom-tool-${siteId}`,
          production_url: `https://${intake.target_domain}`,
          sitemap_url: `https://${intake.target_domain}/sitemap.xml`,
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(runDir, 'run-meta.json'),
    `${JSON.stringify(
      {
        run_type: 'production',
        deployable: true,
        created_for: 'production toolsite run',
        intake_message_key: intake.source?.key || '',
        intake_created_at: intake.source?.created_at || '',
        intake_attachments: attachmentPlan.map((item) => item.metadata),
        run_created_at: createdAt,
        source: 'hermes-intake',
        status: 'active',
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(runDir, 'README.md'),
    [
      `# Run: ${siteId}`,
      '',
      `- Domain: ${intake.target_domain}`,
      `- Cloudflare Pages project: dom-tool-${siteId}`,
      '- Source: fresh Hermes production-start intake',
      '',
      'Fill `input.md`, then execute agents in order.',
      '',
    ].join('\n'),
  );
}

export async function createProductionRunFromHermesIntake({
  rootDir = process.cwd(),
  inboxPath = DEFAULT_HERMES_INBOX,
  remoteStatePath = DEFAULT_HERMES_REMOTE_STATE,
  startedAt,
  allowExistingIntake = false,
  resumeExistingRun = false,
  now = () => new Date().toISOString(),
} = {}) {
  const createdAt = now();
  const freshAfter = startedAt || createdAt;
  const intake = await readHermesIntake({
    inboxPath,
    remoteStatePath,
    freshAfter,
    allowExistingIntake,
    requireProductionStartIntent: true,
  });

  if (!intake.found) {
    const code = intakeCodeToProductionStartCode(intake);
    return {
      ok: true,
      code,
      message: code,
      missingFields: intake.missing_fields || [],
      intake,
    };
  }

  const siteId = siteIdFromDomain(intake.target_domain);
  const runDir = path.join(path.resolve(rootDir), 'runs', siteId);
  if (await exists(runDir)) {
    if (resumeExistingRun) {
      const meta = await readRunMeta(runDir);
      if (meta && meta.status !== 'aborted') {
        return {
          ok: true,
          code: 'EXISTING_RUN_RESUMED',
          runDir,
          siteId,
          intake,
          runMeta: meta,
        };
      }
    }
    return {
      ok: false,
      code: RUN_ALREADY_EXISTS,
      message: RUN_ALREADY_EXISTS,
      runDir,
      siteId,
      intake,
    };
  }

  const attachmentPlan = await prepareAttachmentCopyPlan({ runDir, intake });
  if (!attachmentPlan.ok) {
    return {
      ok: false,
      code: attachmentPlan.code,
      message: attachmentPlan.message,
      runDir,
      siteId,
      intake,
    };
  }

  await writeProductionRunFiles({
    rootDir: path.resolve(rootDir),
    runDir,
    siteId,
    intake,
    createdAt,
    attachmentPlan: attachmentPlan.attachments,
  });
  const runMeta = await readRunMeta(runDir);
  return {
    ok: true,
    code: PRODUCTION_RUN_CREATED,
    runDir,
    siteId,
    intake,
    runMeta,
  };
}

async function detectNextStage(runDir) {
  if (!(await exists(path.join(runDir, 'toolsite-spec.md')))) return 'pre-agent2';
  if (!(await exists(path.join(runDir, 'agent-2-output/site-brief.md')))) return 'agent-2';
  if (!(await exists(path.join(runDir, 'agent-2-5-output/chat-delivery/options-board.png')))) return 'agent-2.5';
  if (!(await exists(path.join(runDir, 'agent-3-output/implementation-handoff.md')))) return 'agent-3';
  if (!(await exists(path.join(runDir, 'site/package.json')))) return 'agent-4';
  if (!(await exists(path.join(runDir, 'agent-5-output/final-qa-report.md')))) return 'agent-5';
  return 'agent-6';
}

async function defaultStageRunner({ stage }) {
  return {
    ok: true,
    code: NEXT_STAGE_READY,
    stage,
    message: `${stage} is ready for the next runner. No deployment was started.`,
  };
}

async function defaultPreAgent2Runner({ runDir, inboxPath }) {
  return runLoopIteration({ runDir, inboxPath });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientRemoteWait(result) {
  return result?.code === NO_REPLY_FOUND || result?.code === INVALID_REPLY ||
    result?.action === 'waiting' || result?.action === 'invalid-reply';
}

function isPreAgent2Review(review) {
  return String(review?.review_type || '') === 'pre_agent2_interview_question';
}

async function guardAgent6(runDir) {
  const runMeta = await readRunMeta(runDir);
  if (runMeta?.run_type === 'smoke' || runMeta?.deployable === false) {
    return {
      ok: false,
      code: DEPLOY_BLOCKED,
      message: SMOKE_RUN_BLOCK_MESSAGE,
    };
  }

  const gateResult = await checkRunGates({ runDir, before: 'agent-6' });
  if (!gateResult.allowed) {
    return {
      ok: false,
      code: DEPLOY_BLOCKED,
      message: 'Agent6 is blocked by gate checks.',
      gateResult,
    };
  }

  return {
    ok: true,
    code: DEPLOY_NOT_RUN,
    stage: 'agent-6',
    message: 'Agent6 is approved by gates, but deployment is not run by this orchestrator.',
    gateResult,
  };
}

export async function runToolsiteOrchestrator({
  runDir,
  remote = false,
  inboxPath,
  remoteStatePath,
  fromHermesIntake = false,
  allowExistingIntake = false,
  resumeExistingRun = false,
  startedAt,
  rootDir = process.cwd(),
  continueReview = continueHumanReview,
  stageRunner = defaultStageRunner,
  preAgent2Runner = defaultPreAgent2Runner,
  maxSteps = remote ? Infinity : 20,
  pollMs = 10_000,
  maxIdleIterations = Infinity,
} = {}) {
  let absoluteRunDir = runDir ? path.resolve(runDir) : '';
  let productionStart = null;

  if (fromHermesIntake) {
    productionStart = await createProductionRunFromHermesIntake({
      rootDir,
      inboxPath,
      remoteStatePath,
      startedAt,
      allowExistingIntake,
      resumeExistingRun,
    });
    if (!productionStart.ok) return productionStart;
    if (productionStart.code !== PRODUCTION_RUN_CREATED && productionStart.code !== 'EXISTING_RUN_RESUMED') {
      return productionStart;
    }
    absoluteRunDir = productionStart.runDir;
  }

  if (!absoluteRunDir) throw new Error('Missing --run-dir');

  for (let step = 0; step < maxSteps; step += 1) {
    const summary = await readHumanReviewSummary(absoluteRunDir);
    if (summary.openReviews.length > 0) {
      if (!remote) {
        return {
          ok: true,
          code: STOPPED_AT_HUMAN_REVIEW,
          openReviews: summary.openReviews,
        };
      }

      const latestOpenReview = summary.openReviews.at(-1);
      const result = isPreAgent2Review(latestOpenReview)
        ? await preAgent2Runner({ runDir: absoluteRunDir, inboxPath, openReview: latestOpenReview })
        : await continueReview({ runDir: absoluteRunDir, inboxPath });
      if (isTransientRemoteWait(result)) {
        if (step + 1 >= maxIdleIterations) return result;
        if (pollMs > 0) await sleep(pollMs);
        continue;
      }
      if (result.code !== REVIEW_RESOLVED && result.code !== AGENT6_READY) {
        return result;
      }

      const afterReview = await readHumanReviewSummary(absoluteRunDir);
      if (afterReview.openReviews.length > 0) {
        return {
          ok: true,
          code: STOPPED_AT_HUMAN_REVIEW,
          openReviews: afterReview.openReviews,
          previousResult: result,
          productionStart,
        };
      }

      if (result.code === AGENT6_READY) {
        return result;
      }
      continue;
    }

    const stage = await detectNextStage(absoluteRunDir);
    if (stage === 'agent-6') return guardAgent6(absoluteRunDir);

    const stageResult = stage === 'pre-agent2'
      ? await preAgent2Runner({ runDir: absoluteRunDir, inboxPath })
      : await stageRunner({ runDir: absoluteRunDir, stage, remote });
    const afterStage = await readHumanReviewSummary(absoluteRunDir);
    if (afterStage.openReviews.length > 0) {
      if (remote) {
        if (step + 1 >= maxIdleIterations) {
          return {
            ok: true,
            code: STOPPED_AT_HUMAN_REVIEW,
            stage,
            stageResult,
            openReviews: afterStage.openReviews,
            productionStart,
          };
        }
        if (pollMs > 0) await sleep(pollMs);
        continue;
      }
      return {
        ok: true,
        code: STOPPED_AT_HUMAN_REVIEW,
        stage,
        stageResult,
        openReviews: afterStage.openReviews,
        productionStart,
      };
    }

    if (!stageResult?.ok || stageResult?.code === NEXT_STAGE_READY) {
      return {
        ok: Boolean(stageResult?.ok),
        code: stageResult?.code || NEXT_STAGE_READY,
        stage,
        stageResult,
        productionStart,
      };
    }
  }

  return {
    ok: false,
    code: 'MAX_STEPS_EXCEEDED',
    message: `run:toolsite stopped after ${maxSteps} steps without reaching a human review gate.`,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--remote') {
      args.remote = true;
    } else if (arg === '--from-hermes-intake') {
      args.fromHermesIntake = true;
    } else if (arg === '--allow-existing-intake') {
      args.allowExistingIntake = true;
    } else if (arg === '--resume-existing-run') {
      args.resumeExistingRun = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      args[key] = argv[i + 1];
      i += 1;
    }
  }
  if (!args['run-dir'] && !args.fromHermesIntake) throw new Error('Missing --run-dir');
  return args;
}

function printResult(result) {
  console.log(result.code || (result.ok ? 'OK' : 'FAILED'));
  if (result.message) console.log(result.message);
  if (result.siteId) console.log(`site_id: ${result.siteId}`);
  if (result.runDir) console.log(`run_dir: ${result.runDir}`);
  if (result.missingFields?.length) {
    console.log('missing_fields:');
    for (const field of result.missingFields) console.log(`- ${field}`);
  }
  if (result.stage) console.log(`stage: ${result.stage}`);
  if (result.openReviews?.length) {
    console.log('open_reviews:');
    for (const review of result.openReviews) console.log(`- ${review.id}`);
  }
}

async function main() {
  const commandStartedAt = new Date().toISOString();
  const args = parseArgs(process.argv.slice(2));
  const result = await runToolsiteOrchestrator({
    runDir: args['run-dir'],
    inboxPath: args['inbox-path'],
    remoteStatePath: args['remote-state-path'],
    fromHermesIntake: Boolean(args.fromHermesIntake),
    allowExistingIntake: Boolean(args.allowExistingIntake),
    resumeExistingRun: Boolean(args.resumeExistingRun),
    startedAt: args['started-at'] || commandStartedAt,
    remote: Boolean(args.remote),
    pollMs: args['poll-ms'] ? Number(args['poll-ms']) : 10_000,
  });
  printResult(result);
  process.exitCode = result.ok ? 0 : 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}

export const testInternals = {
  detectNextStage,
  readHumanReviewSummary,
  siteIdFromDomain,
};
