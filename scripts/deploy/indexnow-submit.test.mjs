import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ensureIndexNowKeyFile,
  extractUrlsFromSitemap,
  findIndexNowKeyFile,
  isValidIndexNowKey,
  normalizeHost,
  submitIndexNow,
} from './indexnow-submit.mjs';

test('normalizes domain and URL input to host', () => {
  assert.equal(normalizeHost('Example.com'), 'example.com');
  assert.equal(normalizeHost('https://www.example.com/path'), 'www.example.com');
});

test('creates and reuses a root IndexNow key file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'indexnow-'));
  const created = ensureIndexNowKeyFile(dir, 'abc12345');

  assert.equal(path.basename(created.path), 'abc12345.txt');
  assert.equal(fs.readFileSync(created.path, 'utf8').trim(), 'abc12345');
  assert.deepEqual(findIndexNowKeyFile(dir), created);
  assert.deepEqual(ensureIndexNowKeyFile(dir), created);
});

test('validates IndexNow key format', () => {
  assert.equal(isValidIndexNowKey('abc12345'), true);
  assert.equal(isValidIndexNowKey('too'), false);
  assert.equal(isValidIndexNowKey('bad_key_value'), false);
});

test('extracts only same-host unique URLs from sitemap', () => {
  const xml = `
    <urlset>
      <url><loc>https://example.com/</loc></url>
      <url><loc>https://example.com/privacy/</loc></url>
      <url><loc>https://example.com/privacy/</loc></url>
      <url><loc>https://other.com/</loc></url>
    </urlset>
  `;

  assert.deepEqual(extractUrlsFromSitemap(xml, 'example.com'), [
    'https://example.com/',
    'https://example.com/privacy/',
  ]);
});

test('dry-run submission masks key and does not call network', async () => {
  const result = await submitIndexNow({
    endpoint: 'https://api.indexnow.org/indexnow',
    host: 'example.com',
    key: 'abc12345',
    keyLocation: 'https://example.com/abc12345.txt',
    urls: ['https://example.com/'],
    dryRun: true,
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.key, 'abc1...2345');
  assert.equal(result.urlCount, 1);
});

test('CLI prepare works from paths with non-ASCII characters', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '索引-'));
  const siteDir = path.join(root, 'site');
  fs.mkdirSync(siteDir, { recursive: true });

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/deploy/indexnow-submit.mjs'),
    'prepare',
    '--domain',
    'example.com',
    '--site-dir',
    siteDir,
    '--key',
    'abc12345',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /abc1\.\.\.2345/);
  assert.equal(fs.readFileSync(path.join(siteDir, 'public', 'abc12345.txt'), 'utf8').trim(), 'abc12345');
});
