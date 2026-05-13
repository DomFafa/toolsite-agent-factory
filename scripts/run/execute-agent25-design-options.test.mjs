import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NO_APPROVED_UI_GENERATION_AVAILABLE,
  buildSubmittedPrompt,
  classifySurfaceState,
  filterGeneratedImageCandidates,
} from './execute-agent25-design-options.mjs';

test('executor submitted prompt preserves user request and enforces design-options evidence contract', () => {
  const submitted = buildSubmittedPrompt('Generate one retirement calculator mockup.');

  assert.match(submitted, /Generate one retirement calculator mockup/);
  assert.match(submitted, /Option A/);
  assert.match(submitted, /Option B/);
  assert.match(submitted, /Option C/);
  assert.match(submitted, /visual image\/mockup is required/i);
});

test('executor rejects unavailable ChatGPT surface instead of falling back locally', () => {
  const result = classifySurfaceState({
    title: 'ChatGPT',
    url: 'https://chatgpt.com/',
    bodyText: 'Log in Sign up',
    loginRequired: true,
    hasComposer: false,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, NO_APPROVED_UI_GENERATION_AVAILABLE);
  assert.match(result.reason, /requires login/);
});

test('executor accepts approved surface only when a prompt composer exists', () => {
  const result = classifySurfaceState({
    title: 'ChatGPT',
    url: 'https://chatgpt.com/',
    bodyText: 'Message ChatGPT',
    loginRequired: false,
    hasComposer: true,
  });

  assert.equal(result.ok, true);
});

test('executor image candidate filter drops avatars, icons, logos, and tiny images', () => {
  const candidates = filterGeneratedImageCandidates([
    { src: 'https://example.com/avatar.png', naturalWidth: 512, naturalHeight: 512, alt: 'profile avatar' },
    { src: 'https://example.com/logo.png', naturalWidth: 800, naturalHeight: 300, alt: 'logo' },
    { src: 'https://example.com/tiny.png', naturalWidth: 128, naturalHeight: 128, alt: 'mockup' },
    { src: 'blob:https://chatgpt.com/generated', naturalWidth: 1024, naturalHeight: 768, alt: 'Generated UI mockup' },
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].src, 'blob:https://chatgpt.com/generated');
});
