import fs from 'node:fs';
import path from 'node:path';

const siteDir = process.argv[2] || 'starter-site';
const indexPath = path.join(siteDir, 'src/pages/index.astro');

if (!fs.existsSync(indexPath)) {
  console.error(`Missing index page: ${indexPath}`);
  process.exit(1);
}

const source = fs.readFileSync(indexPath, 'utf8');
const checks = [
  ['has title variable', /const title\s*=/.test(source)],
  ['has description variable', /const description\s*=/.test(source)],
  ['uses BaseLayout', /<BaseLayout/.test(source)],
  ['has FAQ or visible help content', /Faq|FAQ|Frequently asked/i.test(source)],
];

let failed = false;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
  if (!pass) failed = true;
}

if (failed) process.exit(1);
