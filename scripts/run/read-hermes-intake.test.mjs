import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  readHermesIntake,
  REMOTE_DISABLED_MESSAGE,
  INBOX_MISSING_MESSAGE,
} from './read-hermes-intake.mjs';

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'hermes-intake-'));
  const stateDir = path.join(root, 'hermes-home', 'state');
  const remoteStatePath = path.join(stateDir, 'toolsite-remote.json');
  const inboxPath = path.join(stateDir, 'toolsite-inbox.jsonl');
  await mkdir(stateDir, { recursive: true });
  return { root, remoteStatePath, inboxPath };
}

async function writeRemote(remoteStatePath, remoteMode) {
  await writeFile(
    remoteStatePath,
    JSON.stringify({ remote_mode: remoteMode, updated_at: '2026-05-11T00:00:00.000Z' }),
  );
}

async function writeInbox(inboxPath, messages) {
  await writeFile(inboxPath, `${messages.map((message) => JSON.stringify(message)).join('\n')}\n`);
}

function message(text, overrides = {}) {
  return {
    type: 'user_message',
    source: 'telegram',
    chat_id: '123',
    message_id: overrides.message_id || '1',
    text,
    created_at: overrides.created_at || '2026-05-11T00:00:00.000Z',
    handled: false,
    ...overrides,
  };
}

function completeIntake({ uiLabel = 'UI 参考', uxLabel = 'UX 参考', domain = 'wordcounter-test.local' } = {}) {
  return [
    '关键词: word counter',
    `目标域名: ${domain}`,
    `${uiLabel}: Stripe 风格`,
    `${uxLabel}: wordcounter.net`,
    '额外想法/限制/模仿点: 第一屏必须是工具，不要登录，不要复杂功能',
  ].join('\n');
}

test('remote_mode=false refuses before reading inbox', async () => {
  const { remoteStatePath, inboxPath } = await makeFixture();
  await writeRemote(remoteStatePath, false);

  const result = await readHermesIntake({ remoteStatePath, inboxPath });

  assert.equal(result.found, false);
  assert.equal(result.code, 'remote-disabled');
  assert.equal(result.message, REMOTE_DISABLED_MESSAGE);
});

test('missing remote state refuses before reading inbox', async () => {
  const { remoteStatePath, inboxPath } = await makeFixture();

  const result = await readHermesIntake({ remoteStatePath, inboxPath });

  assert.equal(result.found, false);
  assert.equal(result.code, 'remote-disabled');
  assert.equal(result.message, REMOTE_DISABLED_MESSAGE);
});

test('remote_mode=true allows reading inbox', async () => {
  const { remoteStatePath, inboxPath } = await makeFixture();
  await writeRemote(remoteStatePath, true);
  await writeInbox(inboxPath, [message(completeIntake())]);

  const result = await readHermesIntake({ remoteStatePath, inboxPath });

  assert.equal(result.found, true);
  assert.equal(result.remote_mode, true);
});

test('parses complete five-element intake', async () => {
  const { remoteStatePath, inboxPath } = await makeFixture();
  await writeRemote(remoteStatePath, true);
  await writeInbox(inboxPath, [message(completeIntake())]);

  const result = await readHermesIntake({ remoteStatePath, inboxPath });

  assert.equal(result.keyword, 'word counter');
  assert.equal(result.target_domain, 'wordcounter-test.local');
  assert.equal(result.ui_reference, 'Stripe 风格');
  assert.equal(result.ux_reference, 'wordcounter.net');
  assert.equal(result.extra_notes, '第一屏必须是工具，不要登录，不要复杂功能');
});

test('recognizes UI参考 and UI 参考 spellings', async () => {
  for (const uiLabel of ['UI参考', 'UI 参考']) {
    const { remoteStatePath, inboxPath } = await makeFixture();
    await writeRemote(remoteStatePath, true);
    await writeInbox(inboxPath, [message(completeIntake({ uiLabel }))]);

    const result = await readHermesIntake({ remoteStatePath, inboxPath });
    assert.equal(result.found, true);
    assert.equal(result.ui_reference, 'Stripe 风格');
  }
});

test('recognizes UX参考 and UX 参考 spellings', async () => {
  for (const uxLabel of ['UX参考', 'UX 参考']) {
    const { remoteStatePath, inboxPath } = await makeFixture();
    await writeRemote(remoteStatePath, true);
    await writeInbox(inboxPath, [message(completeIntake({ uxLabel }))]);

    const result = await readHermesIntake({ remoteStatePath, inboxPath });
    assert.equal(result.found, true);
    assert.equal(result.ux_reference, 'wordcounter.net');
  }
});

test('generates suggested_site_id from target domain', async () => {
  const { remoteStatePath, inboxPath } = await makeFixture();
  await writeRemote(remoteStatePath, true);
  await writeInbox(inboxPath, [message(completeIntake({ domain: 'typing-test-online.com' }))]);

  const result = await readHermesIntake({ remoteStatePath, inboxPath });

  assert.equal(result.suggested_site_id, 'typing-test-online');
});

test('missing fields return found false and missing_fields', async () => {
  const { remoteStatePath, inboxPath } = await makeFixture();
  await writeRemote(remoteStatePath, true);
  await writeInbox(inboxPath, [
    message(['关键词: word counter', '目标域名: wordcounter-test.local', 'UI参考: Stripe 风格'].join('\n')),
  ]);

  const result = await readHermesIntake({ remoteStatePath, inboxPath });

  assert.equal(result.found, false);
  assert.deepEqual(result.missing_fields, ['UX 参考', '额外想法 / 限制 / 模仿点']);
});

test('multiple messages choose the latest complete intake', async () => {
  const { remoteStatePath, inboxPath } = await makeFixture();
  await writeRemote(remoteStatePath, true);
  await writeInbox(inboxPath, [
    message(completeIntake({ domain: 'old-example.com' }), { message_id: '1' }),
    message('普通消息，不是 intake', { message_id: '2' }),
    message(completeIntake({ domain: 'new-example.com' }), { message_id: '3' }),
  ]);

  const result = await readHermesIntake({ remoteStatePath, inboxPath });

  assert.equal(result.found, true);
  assert.equal(result.target_domain, 'new-example.com');
  assert.equal(result.suggested_site_id, 'new-example');
  assert.equal(result.source.message_id, '3');
});

test('missing inbox returns friendly message when remote is enabled', async () => {
  const { remoteStatePath, inboxPath } = await makeFixture();
  await writeRemote(remoteStatePath, true);

  const result = await readHermesIntake({ remoteStatePath, inboxPath });

  assert.equal(result.found, false);
  assert.equal(result.code, 'inbox-missing');
  assert.equal(result.message, INBOX_MISSING_MESSAGE);
});

test('--json output is parseable JSON', async () => {
  const { remoteStatePath, inboxPath } = await makeFixture();
  await writeRemote(remoteStatePath, true);
  await writeInbox(inboxPath, [message(completeIntake())]);

  const result = spawnSync(
    process.execPath,
    [
      'scripts/run/read-hermes-intake.mjs',
      '--remote-state',
      remoteStatePath,
      '--inbox',
      inboxPath,
      '--json',
    ],
    {
      cwd: path.resolve('.'),
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.found, true);
  assert.equal(parsed.keyword, 'word counter');
  assert.equal(parsed.suggested_site_id, 'wordcounter-test');
});
