#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const DEFAULT_ENDPOINT = 'https://api.indexnow.org/indexnow';
const KEY_RE = /^[A-Za-z0-9-]{8,128}$/;

export function normalizeHost(input) {
  if (!input) throw new Error('Missing domain');
  const value = input.includes('://') ? input : `https://${input}`;
  const url = new URL(value);
  return url.hostname.toLowerCase();
}

export function generateIndexNowKey() {
  return crypto.randomBytes(16).toString('hex');
}

export function isValidIndexNowKey(key) {
  return KEY_RE.test(key);
}

export function maskKey(key) {
  if (!key) return '';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function ensureIndexNowKeyFile(siteDir, key = '') {
  const publicDir = path.join(siteDir, 'public');
  fs.mkdirSync(publicDir, { recursive: true });

  const existing = findIndexNowKeyFile(siteDir);
  if (existing && !key) return existing;

  const finalKey = key || generateIndexNowKey();
  if (!isValidIndexNowKey(finalKey)) {
    throw new Error('IndexNow key must be 8-128 chars using letters, numbers, or hyphen');
  }

  const keyPath = path.join(publicDir, `${finalKey}.txt`);
  fs.writeFileSync(keyPath, `${finalKey}\n`, 'utf8');
  return { key: finalKey, path: keyPath };
}

export function findIndexNowKeyFile(siteDir) {
  const publicDir = path.join(siteDir, 'public');
  if (!fs.existsSync(publicDir)) return null;

  for (const entry of fs.readdirSync(publicDir)) {
    if (!entry.endsWith('.txt')) continue;
    const key = entry.slice(0, -4);
    if (!isValidIndexNowKey(key)) continue;
    const filePath = path.join(publicDir, entry);
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (content === key) return { key, path: filePath };
  }

  return null;
}

export function extractUrlsFromSitemap(xml, host) {
  const urls = [];
  const locRe = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match;

  while ((match = locRe.exec(xml))) {
    try {
      const url = new URL(match[1].trim());
      if (url.hostname.toLowerCase() === host) urls.push(url.toString());
    } catch {
      // Ignore malformed sitemap entries and let the empty-list guard fail if needed.
    }
  }

  return [...new Set(urls)];
}

export async function submitIndexNow({ endpoint = DEFAULT_ENDPOINT, host, key, keyLocation, urls, dryRun = false }) {
  if (!isValidIndexNowKey(key)) throw new Error('Invalid IndexNow key');
  if (!Array.isArray(urls) || urls.length === 0) throw new Error('No URLs to submit');

  const payload = {
    host,
    key,
    keyLocation,
    urlList: urls,
  };

  if (dryRun) {
    return {
      dryRun: true,
      endpoint,
      host,
      key: maskKey(key),
      keyLocation,
      urlCount: urls.length,
      urls,
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  return {
    dryRun: false,
    endpoint,
    status: response.status,
    ok: response.status === 200 || response.status === 202,
    host,
    key: maskKey(key),
    keyLocation,
    urlCount: urls.length,
    responseBody: body.slice(0, 500),
  };
}

function readRepeated(values, name) {
  const value = values[name];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function main() {
  const command = process.argv[2];
  if (!command || !['prepare', 'submit'].includes(command)) {
    printUsage();
    process.exit(1);
  }

  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      domain: { type: 'string' },
      'site-dir': { type: 'string' },
      key: { type: 'string' },
      'sitemap-url': { type: 'string' },
      url: { type: 'string', multiple: true },
      endpoint: { type: 'string', default: DEFAULT_ENDPOINT },
      'dry-run': { type: 'boolean', default: false },
      'skip-key-check': { type: 'boolean', default: false },
    },
  });

  const domain = values.domain;
  const siteDir = values['site-dir'];
  if (!domain) throw new Error('--domain is required');
  const host = normalizeHost(domain);

  if (command === 'prepare') {
    if (!siteDir) throw new Error('--site-dir is required for prepare');
    const keyFile = ensureIndexNowKeyFile(siteDir, values.key || '');
    const keyLocation = `https://${host}/${keyFile.key}.txt`;
    console.log(JSON.stringify({
      command: 'prepare',
      host,
      key: maskKey(keyFile.key),
      keyFile: path.relative(process.cwd(), keyFile.path),
      keyLocation,
    }, null, 2));
    return;
  }

  if (!siteDir) throw new Error('--site-dir is required for submit so the key file can be read');
  const keyFile = findIndexNowKeyFile(siteDir);
  if (!keyFile) throw new Error(`Missing IndexNow key file in ${path.join(siteDir, 'public')}; run prepare first`);

  const keyLocation = `https://${host}/${keyFile.key}.txt`;
  if (!values['dry-run'] && !values['skip-key-check']) {
    const keyResponse = await fetch(keyLocation);
    const keyText = await keyResponse.text();
    if (!keyResponse.ok || keyText.trim() !== keyFile.key) {
      throw new Error(`Live IndexNow key file is not deployed or does not match: ${keyLocation}`);
    }
  }

  let urls = readRepeated(values, 'url');
  if (urls.length === 0) {
    const sitemapUrl = values['sitemap-url'] || `https://${host}/sitemap.xml`;
    const response = await fetch(sitemapUrl);
    if (!response.ok) throw new Error(`Failed to fetch sitemap ${sitemapUrl}: HTTP ${response.status}`);
    const xml = await response.text();
    urls = extractUrlsFromSitemap(xml, host);
  }

  const result = await submitIndexNow({
    endpoint: values.endpoint,
    host,
    key: keyFile.key,
    keyLocation,
    urls,
    dryRun: values['dry-run'],
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok && !result.dryRun) process.exit(1);
}

function printUsage() {
  console.error(`Usage:
  node scripts/deploy/indexnow-submit.mjs prepare --domain <domain> --site-dir <site-dir>
  node scripts/deploy/indexnow-submit.mjs submit --domain <domain> --site-dir <site-dir> [--sitemap-url <url>]
  node scripts/deploy/indexnow-submit.mjs submit --domain <domain> --site-dir <site-dir> --url <url> [--url <url>]`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
