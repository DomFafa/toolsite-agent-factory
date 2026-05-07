import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function read(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('Agent 2.5 requires usability-first calculator design constraints', async () => {
  const prompt = await read('agents/agent-2-5-ui-design-generation/prompt.md');
  const checklist = await read('agents/agent-2-5-ui-design-generation/checklist.md');
  const outputSchema = await read('agents/agent-2-5-ui-design-generation/output.schema.md');
  const template = await read('shared/templates/design-generation-input.template.md');

  for (const source of [prompt, checklist, outputSchema, template]) {
    assert.match(source, /Usability|usability/);
    assert.match(source, /interaction|state|control/i);
    assert.match(source, /dynamic|realistic|real data|data/i);
    assert.match(source, /overflow/i);
    assert.match(source, /thumbnail|preset/i);
    assert.match(source, /asset|image/i);
  }

  assert.match(prompt, /1,090mg/);
  assert.match(prompt, /2,400mg/);
  assert.match(prompt, /Do not put text inside/i);
  assert.match(prompt, /1000x360/);
  assert.match(prompt, /300x190/);
  assert.match(prompt, /selected-option-assets\.zip/);
  assert.match(prompt, /Post-Selection High-Resolution Asset Acquisition/i);
  assert.match(prompt, /white-margin|white margin|white gutters/i);
  assert.match(prompt, /no-op|zero-effect/i);
  assert.match(prompt, /meal-format|meal format/i);
  assert.match(outputSchema, /usability-contract\.md/);
  assert.match(outputSchema, /interaction-state-model\.md/);
  assert.match(outputSchema, /asset-quality-contract\.md/);
  assert.match(outputSchema, /asset-acquisition-report\.md/);
  assert.match(outputSchema, /selected-option-assets\.zip/);
  assert.match(outputSchema, /ux-self-audit\.md/);
});

test('Agent 5 gates reject visually pretty but unusable UI packages', async () => {
  const prompt = await read('agents/agent-5-strict-qa/prompt.md');
  const checklist = await read('agents/agent-5-strict-qa/checklist.md');
  const outputSchema = await read('agents/agent-5-strict-qa/output.schema.md');
  const qaStandards = await read('docs/qa-standards.md');

  for (const source of [prompt, checklist, outputSchema, qaStandards]) {
    assert.match(source, /Usability|usability/);
    assert.match(source, /interaction|state|no-op|task-flow|task flow/i);
    assert.match(source, /overflow/i);
    assert.match(source, /thumbnail|preset/i);
    assert.match(source, /readability|readable/i);
    assert.match(source, /asset quality|asset-quality|low-resolution|source size/i);
  }

  assert.match(prompt, /Design Package Gate/i);
  assert.match(prompt, /fail/i);
  assert.match(prompt, /asset-quality-gate/i);
  assert.match(prompt, /selected-option-assets\.zip/);
  assert.match(prompt, /primary task-flow|task-flow interaction|UX Interaction QA/i);
  assert.match(outputSchema, /data-fit score/i);
  assert.match(outputSchema, /UX interaction flow score/i);
  assert.match(outputSchema, /Post-selection high-resolution asset acquisition status/i);
  assert.match(outputSchema, /thumbnail/i);
});
