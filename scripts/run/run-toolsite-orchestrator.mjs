import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkRunGates, SMOKE_RUN_BLOCK_MESSAGE } from './check-gates.mjs';
import {
  continueHumanReview,
  NO_OPEN_REVIEW,
  REVIEW_RESOLVED,
  AGENT6_READY,
} from './continue-human-review.mjs';
import { summarizeReviewEvents } from './resolve-human-review-from-hermes-inbox.mjs';

export const STOPPED_AT_HUMAN_REVIEW = 'STOPPED_AT_HUMAN_REVIEW';
export const NEXT_STAGE_READY = 'NEXT_STAGE_READY';
export const FLOW_COMPLETE = 'FLOW_COMPLETE';
export const DEPLOY_BLOCKED = 'DEPLOY_BLOCKED';
export const DEPLOY_NOT_RUN = 'DEPLOY_NOT_RUN';

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
  continueReview = continueHumanReview,
  stageRunner = defaultStageRunner,
  maxSteps = 20,
} = {}) {
  if (!runDir) throw new Error('Missing --run-dir');
  const absoluteRunDir = path.resolve(runDir);

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

      const result = await continueReview({ runDir: absoluteRunDir, inboxPath });
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
        };
      }

      if (result.code === AGENT6_READY) {
        return result;
      }
      continue;
    }

    const stage = await detectNextStage(absoluteRunDir);
    if (stage === 'agent-6') return guardAgent6(absoluteRunDir);

    const stageResult = await stageRunner({ runDir: absoluteRunDir, stage, remote });
    const afterStage = await readHumanReviewSummary(absoluteRunDir);
    if (afterStage.openReviews.length > 0) {
      return {
        ok: true,
        code: STOPPED_AT_HUMAN_REVIEW,
        stage,
        stageResult,
        openReviews: afterStage.openReviews,
      };
    }

    if (!stageResult?.ok || stageResult?.code === NEXT_STAGE_READY) {
      return {
        ok: Boolean(stageResult?.ok),
        code: stageResult?.code || NEXT_STAGE_READY,
        stage,
        stageResult,
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
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      args[key] = argv[i + 1];
      i += 1;
    }
  }
  if (!args['run-dir']) throw new Error('Missing --run-dir');
  return args;
}

function printResult(result) {
  console.log(result.code || (result.ok ? 'OK' : 'FAILED'));
  if (result.message) console.log(result.message);
  if (result.stage) console.log(`stage: ${result.stage}`);
  if (result.openReviews?.length) {
    console.log('open_reviews:');
    for (const review of result.openReviews) console.log(`- ${review.id}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runToolsiteOrchestrator({
    runDir: args['run-dir'],
    inboxPath: args['inbox-path'],
    remote: Boolean(args.remote),
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
};
