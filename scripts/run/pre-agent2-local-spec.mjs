import { attachmentPurpose } from './pre-agent2-question-planner.mjs';

const LOCAL_REVIEW_MESSAGE_MAX_CHARS = 3500;

function asText(value) {
  return String(value || '').trim();
}

function normalizeLabel(value) {
  return asText(value)
    .replace(/^[\s>*#\-.•\d）)、.]+/, '')
    .replace(/\s+/g, ' ')
    .replace(/[：:]/g, ':')
    .toLowerCase()
    .trim();
}

function findLabeledValue(text, aliases) {
  for (const line of String(text || '').split(/\r?\n/)) {
    const separatorIndex = line.search(/[：:]/);
    if (separatorIndex < 0) continue;
    const rawLabel = line.slice(0, separatorIndex);
    const rawValue = line.slice(separatorIndex + 1);
    const label = normalizeLabel(rawLabel);
    if (aliases.some((alias) => label.includes(normalizeLabel(alias)))) return asText(rawValue);
  }
  return '';
}

function cleanupMarkdownSection(value) {
  return asText(value) || '- 本节没有额外补充，按已确认的网站需求执行。';
}

function findMarkdownSection(text, headings) {
  const lines = String(text || '').split(/\r?\n/);
  const normalizedHeadings = headings.map((heading) => normalizeLabel(heading));

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const heading = normalizeLabel(match[1]);
    if (!normalizedHeadings.includes(heading)) continue;

    const body = [];
    for (let bodyIndex = index + 1; bodyIndex < lines.length; bodyIndex += 1) {
      if (/^#{1,6}\s+/.test(lines[bodyIndex])) break;
      body.push(lines[bodyIndex]);
    }
    return cleanupMarkdownSection(body.join('\n'));
  }

  return '';
}

function requiredInputValue(specText, aliases) {
  const requiredInputs = findMarkdownSection(specText, ['Required Inputs', '必填输入', '基础输入']);
  return findLabeledValue(requiredInputs, aliases);
}

function fallbackTargetUsersAndUseCases(specText) {
  const keyword = requiredInputValue(specText, ['Keyword', '关键词']);
  const domain = requiredInputValue(specText, ['Target Domain', '目标域名']);
  const toolName = keyword || domain || '这个工具';
  return [
    `- 目标用户是打开页面后需要快速完成 ${toolName} 任务的访问者。`,
    '- 使用场景以已确认的工具目标、第一屏 UX 和输入 / 输出模型为准。',
  ].join('\n');
}

function specSection(specText, headings, fallback = '') {
  return findMarkdownSection(specText, headings) || cleanupMarkdownSection(fallback);
}

export function parseRunInput(text) {
  const inputAssets = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/-\s+image:\s+(.+?)\s+\((.+?)\)\s*$/i);
    if (!match) continue;
    const metadata = Object.fromEntries(
      match[2]
        .split(/,\s*/)
        .map((part) => {
          const separator = part.indexOf(':');
          if (separator < 0) return ['', ''];
          return [
            part.slice(0, separator).trim().toLowerCase().replace(/\s+/g, '_'),
            part.slice(separator + 1).trim(),
          ];
        })
        .filter(([key]) => key),
    );
    inputAssets.push({
      kind: 'image',
      run_path: asText(match[1]),
      source_local_path: asText(metadata.source),
      purpose: asText(metadata.purpose) || 'design_reference',
    });
  }

  return {
    keyword: findLabeledValue(text, ['keyword', 'primary keyword', '关键词']),
    target_domain: findLabeledValue(text, ['target domain', 'target domain / 目标域名', '目标域名']),
    ui_reference: findLabeledValue(text, ['ui reference', 'ui reference / ui 参考', 'ui 参考']),
    ux_reference: findLabeledValue(text, ['ux reference', 'ux reference / ux 参考', 'ux 参考']),
    extra_notes: findLabeledValue(text, [
      'extra ideas',
      'constraints',
      'mimic points',
      '额外想法',
      '限制',
      '模仿点',
    ]),
    input_assets: inputAssets,
  };
}

function cleanSpecText(value) {
  return String(value || '')
    .replace(/任何搜索内容|搜索内容/g, 'SEO 内容')
    .replace(/,\s+and\s+speaking time/gi, ', speaking time')
    .replace(/、\s*and\s+speaking time/gi, '、speaking time')
    .replace(/(https?:\/\/[^\s)`）]+?)(?:%EF%BC%9A|%EF%BC%9B|%E3%80%82|%EF%BC%8C)[^\s)`）]*/gi, '$1')
    .replace(/。。+/g, '。')
    .replace(/\.\.+/g, '.')
    .replace(/\s+$/g, '');
}

const INTERNAL_META_PATTERNS = [
  /需按已确认\s*SPEC\s*执行/i,
  /不能保留英文整句说明/i,
  /已确认\s*SPEC/i,
  /SPEC\s*审核卡/i,
  /\bAgent[2-6]\b/i,
  /\bgate\b/i,
  /human_review/i,
  /\bconfirmation\b/i,
  /\breview\b/i,
  /blocks\s*=\s*agent-2/i,
  /generated before dynamic gap analysis/i,
  /fixed generic Pre-Agent2/i,
];

const DIRTY_SOURCE_SNIPPET_PATTERNS = [
  /^\s*(?:source|来源|搜索结果|snippet|title)\s*[:：]/i,
  /^\s*(?:calculator\.net|www\.calculator\.net)\s*[-–—:：]/i,
  /%EF%BC%9A|%EF%BC%9B|%E3%80%82|%EF%BC%8C/i,
  /(?:Search Results?|网页快照|source title|result snippet)/i,
];

function isInternalSpecMetaLine(line) {
  return INTERNAL_META_PATTERNS.some((pattern) => pattern.test(line));
}

function isDirtySourceSnippetLine(line) {
  return DIRTY_SOURCE_SNIPPET_PATTERNS.some((pattern) => pattern.test(line));
}

function bulletKey(line) {
  return cleanSpecText(line)
    .replace(/^[-*]\s+/, '')
    .replace(/[。.!！?？]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function sanitizeSpecDocument(lines) {
  const output = [];
  let sectionBulletKeys = new Set();

  for (const rawLine of lines) {
    const line = cleanSpecText(rawLine);
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      sectionBulletKeys = new Set();
      output.push(line);
      continue;
    }
    if (isInternalSpecMetaLine(line) || isDirtySourceSnippetLine(line)) continue;

    if (/^[-*]\s+/.test(line)) {
      const content = line.replace(/^[-*]\s+/, '').trim();
      if (isInternalSpecMetaLine(content) || isDirtySourceSnippetLine(content)) continue;
      const key = bulletKey(line);
      if (key && sectionBulletKeys.has(key)) continue;
      if (key) sectionBulletKeys.add(key);
    }

    output.push(line);
  }

  return output.join('\n');
}

export function sanitizeSpecContent(specText) {
  return sanitizeSpecDocument(String(specText || '').split(/\r?\n/));
}

function decisionFor(event) {
  if (event.answer_type === 'option') return event.option_decisions?.[event.resolution_text] || event.resolution_text;
  return event.resolution_text;
}

function summaryForArea(answeredEvents, area) {
  const relevant = answeredEvents.filter((event) => event.decision_area === area);
  if (relevant.length === 0) return '';
  return relevant
    .map((event) => decisionFor(event))
    .filter(Boolean)
    .map((decision) => `- ${cleanSpecText(decision)}`)
    .join('\n');
}

function isWordCounterIntake(intake) {
  return /word\s*counter|wordcounter/i.test(`${intake.keyword || ''} ${intake.target_domain || ''}`);
}

function is401kIntake(intake) {
  return /401\s*k|401k/i.test(`${intake.keyword || ''} ${intake.target_domain || ''}`);
}

function assetLines(intake, { includeSource = false } = {}) {
  if (!Array.isArray(intake.input_assets) || intake.input_assets.length === 0) return [];
  return intake.input_assets.map((asset) => {
    const purpose = attachmentPurpose(intake) || asset.purpose || 'design_reference';
    const purposeLabel = purpose === 'illustration_reference'
      ? 'illustration_reference / design_reference'
      : `${purpose} / visual_reference`;
    const base = `- 使用 ${asset.run_path} 作为 ${purposeLabel}：页面点缀和视觉风格参考，不作为需求问题，不抢占第一屏工具主体。`;
    if (!includeSource || !asset.source_local_path) return base;
    return `${base} 来源文件：${asset.source_local_path}。`;
  });
}

function commonHeader({ siteId, intake, answeredEvents, allowEarlySpec }) {
  const early = allowEarlySpec && answeredEvents.length > 0;
  return [
    `# Toolsite SPEC: ${siteId}`,
    '',
    '## Required Inputs',
    '',
    `- Keyword: ${intake.keyword}`,
    `- Target Domain: ${intake.target_domain}`,
    `- UI Reference: ${intake.ui_reference}`,
    `- UX Reference: ${intake.ux_reference}`,
    `- Extra Ideas / Constraints / Mimic Points: ${intake.extra_notes}`,
    ...(assetLines(intake).length ? ['- Input Assets:', ...assetLines(intake).map((line) => `  ${line}`)] : []),
    '',
    '## Lightweight Q&A Record',
    '',
    `- Question rounds: ${answeredEvents.length}`,
    '- Complex tool: no',
    ...(early ? ['- 项目信息已足够生成工具需求草稿。'] : []),
    '',
  ];
}

function render401kToolsiteSpec({ siteId, intake, answeredEvents, allowEarlySpec = false }) {
  const assets = assetLines(intake);
  return sanitizeSpecDocument([
    ...commonHeader({ siteId, intake, answeredEvents, allowEarlySpec }),
    '## Tool Purpose',
    '',
    `- 为 ${intake.target_domain} 构建 ${intake.keyword}：一个浏览器本地运行的 401K retirement estimate calculator，用于 educational planning。`,
    '- 用户通过简单输入估算退休时的 401(k) balance；结果只用于教育性估算，不提供 investment、tax 或 financial advice。',
    '- 第一屏必须是真实可用的计算器，不是营销 hero。',
    summaryForArea(answeredEvents, 'Tool Purpose'),
    '',
    '## Target Users and Use Cases',
    '',
    '- 目标用户是美国用户、正在规划退休或接近退休的人，以及想理解 401(k) contribution 结果的人。',
    '- 体验必须对老人家友好：大字体、高对比、输入简单、标签清晰。',
    '- 用户无需登录、创建账户、后端存储或保存个人输入，就能完成 educational estimate。',
    '',
    '## First Viewport UX',
    '',
    `- ${intake.keyword} 第一屏必须优先展示 retirement calculator 本体，任何 SEO 内容都不能挤占计算器。`,
    '- 第一屏结构是：清楚标题、简短 educational disclaimer、大号易读输入项，以及桌面端无需滚动即可看到的结果区。',
    '- 移动端先展示输入项，再紧跟 estimated retirement result 和拆分结果。',
    `- 保留用户限制：${intake.extra_notes}。`,
    summaryForArea(answeredEvents, 'First Viewport UX'),
    '',
    '## Input / Output Model',
    '',
    '- 必填输入项：current age、retirement age、current 401(k) balance、annual salary、employee contribution、employer match、expected annual return、salary increase。',
    '- 输出项：estimated 401(k) balance at retirement、total employee contributions、employer match total、investment growth。',
    '- 用户调整输入后结果应即时更新，不需要登录，也不保存用户数据。',
    summaryForArea(answeredEvents, 'Input / Output Model'),
    '',
    '## Result Experience',
    '',
    '- 结果区必须突出 estimated 401(k) balance at retirement、total contributions、employer match 和 investment growth。',
    '- 结果必须明确标注为 educational estimate，用简单说明避免被理解为 financial advice。',
    summaryForArea(answeredEvents, 'Result Experience'),
    '',
    '## UI / UX Direction',
    '',
    `- UI 参考 ${intake.ui_reference}：借鉴清晰、可信、plain language、高对比、强表单标签和稳定留白；不要照搬视觉。`,
    `- UX 参考 ${intake.ux_reference}：借鉴 calculator-first 交互模型；不要照搬布局或样式。`,
    ...(assets.length ? ['- Image reference:', ...assets.map((line) => `  ${line}`)] : []),
    summaryForArea(answeredEvents, 'UI / UX Direction'),
    '',
    '## Non-goals',
    '',
    '- 不做登录、账户、后端、数据库、保存用户输入、云同步、API key、advisor matching、investment recommendations、tax advice、financial advice 或 AI rewrite。',
    '- 不暗示估算结果有保证，也不包装成个性化专业建议。',
    '',
    '## Technical Constraints',
    '',
    '- 静态前端实现。',
    '- 所有计算在浏览器本地运行。',
    '- 不做后端、数据库、登录、账户系统、API key、服务端计算或保存用户输入。',
    '',
    '## Page Boundary',
    '',
    '- 必须包含页面：`/`、`/privacy`、`/terms`、`/sitemap.xml`、`/robots.txt`。',
    '- `/` 是 401K Calculator 工具页，第一屏计算器体验优先于 SEO 内容。',
    '- 默认禁止：`/login`、`/dashboard`、`/account`、`/pricing`、`/advisor`、`/api`、`/history`、`/blog`。',
    '',
    '## SEO Baseline',
    '',
    `- Primary keyword 是 ${intake.keyword}。title、description、H1 和 intro copy 必须保持 educational 401K Calculator 语境。`,
    '- SEO 内容可以在第一屏计算器下方解释 contribution、employer match、expected return 和 assumptions。',
    '',
    '## Success Criteria Baseline',
    '',
    '- 用户打开页面后 3 秒内知道这是 401K retirement estimate calculator。',
    '- 用户可以输入 current age、retirement age、current balance、annual salary、employee contribution、employer match、expected annual return 和 salary increase。',
    '- 页面清楚展示 estimated 401(k) balance at retirement、total contributions、employer match 和 investment growth。',
    '- 页面在移动端和桌面端都保持对老人家友好，包括大号可读输入和高对比。',
    '',
  ]);
}

function renderWordCounterToolsiteSpec({ siteId, intake, answeredEvents, allowEarlySpec = false }) {
  return sanitizeSpecDocument([
    ...commonHeader({ siteId, intake, answeredEvents, allowEarlySpec }),
    '## Tool Purpose',
    '',
    `- Build ${intake.keyword} for ${intake.target_domain}: a browser-local word counter that lets users paste or type plain text and see real-time text statistics.`,
    '- The core task is fast, trustworthy counting for writers, editors, students, SEO/content operators, and anyone checking text length.',
    summaryForArea(answeredEvents, 'Tool Purpose'),
    '',
    '## Target Users and Use Cases',
    '',
    '- Writers and editors checking draft length before publishing.',
    '- Students or professionals checking text length for forms, essays, blurbs, or platform limits.',
    '- SEO/content users who need quick text statistics without login, upload, or saving private text.',
    '',
    '## First Viewport UX',
    '',
    `- The ${intake.keyword} first viewport must make the word counter input and live statistics immediately visible on ${intake.target_domain}.`,
    `- The first viewport must be a clean Stripe-style tool surface inspired by ${intake.ui_reference}: a short title and description, a large text input, and core stat cards below or to the right.`,
    '- On mobile, the text input comes first and the stat cards follow immediately below it. The tool must be usable before any SEO content.',
    `- Preserve the user constraint: ${intake.extra_notes}.`,
    summaryForArea(answeredEvents, 'First Viewport UX'),
    '',
    '## Input / Output Model',
    '',
    '- Input is plain text only. Users paste or type into one large text area.',
    '- Output updates in real time without a submit button.',
    '- Include lightweight actions: clear text, copy results, and insert example text.',
    '- Text must be processed in the local browser only. Do not upload it and do not store user input.',
    summaryForArea(answeredEvents, 'Input / Output Model'),
    '',
    '## Result Experience',
    '',
    '- The first viewport default metrics must include: words, characters, sentences, paragraphs, reading time, speaking time.',
    '- Core metric cards should be visible, scannable, and stable while users type or paste long text.',
    '- Keyword density is not a first-screen core metric. It can only be considered later as an optional advanced module.',
    summaryForArea(answeredEvents, 'Result Experience'),
    '',
    '## UI / UX Direction',
    '',
    `- UI reference: ${intake.ui_reference}. Use a clean, professional Stripe-style visual system with whitespace, subtle cards, clear hierarchy, and restrained color.`,
    `- UX reference: ${intake.ux_reference}. Match the immediacy of wordcounter.net style live statistics, but do not copy its layout or visual design.`,
    '- The experience should feel like a focused utility, not a marketing landing page or dashboard.',
    summaryForArea(answeredEvents, 'UI / UX Direction'),
    '',
    '## Non-goals',
    '',
    '- Do not build login, accounts, database, backend, API keys, AI rewrite, spelling check, grammar check, cloud sync, history, leaderboard, or saved documents.',
    '- Do not make keyword density a first-screen core feature.',
    '- Do not require users to click submit before seeing results.',
    summaryForArea(answeredEvents, 'Non-goals'),
    '',
    '## Privacy',
    '',
    '- User text must stay in the browser. The site must not upload, persist, log, sync, or send pasted text to a server.',
    '',
    '## Technical Constraints',
    '',
    '- Static frontend only.',
    '- No backend, database, login, account system, API key, AI service, server-side text processing, or analytics that captures user text.',
    '- Counting logic must run locally in the browser and handle long text without overflow.',
    '',
    '## Page Boundary',
    '',
    '- Required pages: `/`, `/privacy`, `/terms`, `/sitemap.xml`, and `/robots.txt`.',
    '- The `/` page is the word counter tool page. First-screen tool experience has priority over SEO content.',
    '- Forbidden by default: `/login`, `/dashboard`, `/account`, `/pricing`, `/leaderboard`, `/api`, `/history`, and `/blog`.',
    '',
    '## SEO Baseline',
    '',
    `- Primary keyword is ${intake.keyword}. The title, description, H1, and page intent must stay aligned with a browser-local word counter on ${intake.target_domain}.`,
    '- SEO explanation and FAQ content may appear below the tool, but must not push the tool out of the first viewport.',
    '',
    '## Success Criteria Baseline',
    '',
    '- Users understand within 3 seconds that they can paste or type text and immediately see text statistics.',
    '- Pasting text immediately updates words, characters, sentences, paragraphs, reading time, and speaking time.',
    '- Mobile is usable, long text does not overflow, and the first viewport remains a working tool rather than SEO filler.',
    '',
  ]);
}

function renderGenericToolsiteSpec({ siteId, intake, answeredEvents, allowEarlySpec = false }) {
  return sanitizeSpecDocument([
    ...commonHeader({ siteId, intake, answeredEvents, allowEarlySpec }),
    '## Tool Purpose',
    '',
    `- Build ${intake.keyword} for ${intake.target_domain}. The tool purpose must stay specific to this keyword and not become a generic utility template.`,
    `- Preserve the user-provided constraint and mimic point: ${intake.extra_notes}.`,
    summaryForArea(answeredEvents, 'Tool Purpose'),
    '',
    '## Target Users and Use Cases',
    '',
    `- Target users are visitors who search for ${intake.keyword} and need to complete that specific tool task on ${intake.target_domain}.`,
    `- The accepted user constraints are: ${intake.extra_notes}.`,
    '',
    '## First Viewport UX',
    '',
    `- The first viewport must be specific to ${intake.keyword}; it cannot be a generic calculator/checker shell.`,
    `- Use ${intake.ui_reference} as the visual reference and keep ${intake.extra_notes} visible in the first-screen product behavior.`,
    summaryForArea(answeredEvents, 'First Viewport UX'),
    '',
    '## Input / Output Model',
    '',
    `- Inputs and outputs must match the concrete ${intake.keyword} workflow for ${intake.target_domain}.`,
    `- The output model must reflect the user-provided UX reference ${intake.ux_reference}, without copying it blindly.`,
    summaryForArea(answeredEvents, 'Input / Output Model'),
    '',
    '## Result Experience',
    '',
    `- Results must show the concrete output users expect from ${intake.keyword}; generic "core result" language is not enough.`,
    summaryForArea(answeredEvents, 'Result Experience'),
    '',
    '## UI / UX Direction',
    '',
    `- UI reference: ${intake.ui_reference}.`,
    `- UX reference: ${intake.ux_reference}.`,
    `- Apply those references to ${intake.keyword}, while respecting: ${intake.extra_notes}.`,
    ...(assetLines(intake).length ? ['- Image and attachment references:', ...assetLines(intake).map((line) => `  ${line}`)] : []),
    summaryForArea(answeredEvents, 'UI / UX Direction'),
    '',
    '## Non-goals',
    '',
    `- Do not add features, pages, or workflows outside the confirmed ${intake.keyword} scope for ${intake.target_domain}.`,
    `- Keep the first version within the user constraints: ${intake.extra_notes}.`,
    summaryForArea(answeredEvents, 'Non-goals'),
    '',
    '## Technical Constraints',
    '',
    `- Use static frontend constraints for ${intake.keyword} unless a later approved brief changes them. Do not add backend, database, login, or API key requirements by default.`,
    '',
    '## Page Boundary',
    '',
    '- Required pages: `/`, `/privacy`, `/terms`, `/sitemap.xml`, and `/robots.txt`.',
    '- Build one focused tool page for the target domain. The first viewport must prioritize the usable tool experience.',
    '- Forbidden by default: `/login`, `/dashboard`, `/account`, `/pricing`, `/leaderboard`, `/api`, `/history`, and `/blog`.',
    '',
    '## SEO Baseline',
    '',
    `- Use ${intake.keyword} and ${intake.target_domain} from Required Inputs. Keep SEO content below or around the tool without blocking first-viewport tool usage.`,
    '',
    '## Success Criteria Baseline',
    '',
    `- A visitor can open ${intake.target_domain}, understand the ${intake.keyword} task, complete it, and trust the result without login or unnecessary setup.`,
    '',
  ]);
}

export function renderToolsiteSpec({ siteId, intake, answeredEvents = [], allowEarlySpec = false }) {
  if (is401kIntake(intake)) return render401kToolsiteSpec({ siteId, intake, answeredEvents, allowEarlySpec });
  if (isWordCounterIntake(intake)) return renderWordCounterToolsiteSpec({ siteId, intake, answeredEvents, allowEarlySpec });
  return renderGenericToolsiteSpec({ siteId, intake, answeredEvents, allowEarlySpec });
}

function reviewCardContent(content) {
  return String(content || '')
    .split(/\r?\n/)
    .filter((line) => !isInternalSpecMetaLine(line) && !isDirtySourceSnippetLine(line))
    .map((line) => asText(line).replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join('\n') || '- 本节没有额外补充，按已确认的网站需求执行。';
}

export function renderSpecReviewCard({ specText, specPath }) {
  const cleanSpec = sanitizeSpecContent(specText);
  const sections = [
    ['工具目标', specSection(cleanSpec, ['Tool Purpose', '工具目标'])],
    ['目标用户和使用场景', specSection(cleanSpec, ['Target Users and Use Cases', 'Target Users / Use Cases', '目标用户和使用场景'], fallbackTargetUsersAndUseCases(cleanSpec))],
    ['第一屏 UX', specSection(cleanSpec, ['First Viewport UX', '第一屏 UX', '第一屏体验'])],
    ['输入 / 输出模型', specSection(cleanSpec, ['Input / Output Model', '输入 / 输出模型', '输入输出模型'])],
    ['核心结果展示', specSection(cleanSpec, ['Result Experience', '核心结果展示', '结果体验'])],
    ['UI / UX 方向', specSection(cleanSpec, ['UI / UX Direction', 'UI / UX 方向'])],
    ['明确不做的功能', specSection(cleanSpec, ['Non-goals', 'Non goals', '明确不做的功能', '非目标'])],
    ['技术限制', specSection(cleanSpec, ['Technical Constraints', '技术限制'])],
    ['页面边界', specSection(cleanSpec, ['Page Boundary', '页面边界'])],
    ['成功标准', specSection(cleanSpec, ['Success Criteria Baseline', 'Success Criteria', '成功标准'])],
  ];

  return [
    '【Toolsite 需求确认】',
    '',
    ...sections.flatMap(([label, content], index) => [
      `${index + 1}. ${label}`,
      reviewCardContent(content),
      '',
    ]),
    `附：SPEC 文件：${specPath}`,
    '',
    '请回复：',
    '确认 SPEC',
    '或',
    '修改：...',
  ].join('\n');
}

export function splitLocalReviewMessages(text, maxChars = LOCAL_REVIEW_MESSAGE_MAX_CHARS) {
  const value = asText(text);
  if (!value) return [];
  if (value.length <= maxChars) return [value];

  const chunks = [];
  let current = '';

  const pushCurrent = () => {
    if (current) {
      chunks.push(current);
      current = '';
    }
  };

  for (const rawBlock of value.split(/\n{2,}/)) {
    const block = rawBlock.trim();
    if (!block) continue;

    if (block.length > maxChars) {
      pushCurrent();
      for (let index = 0; index < block.length; index += maxChars) {
        chunks.push(block.slice(index, index + maxChars));
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length > maxChars) {
      pushCurrent();
      current = block;
    } else {
      current = candidate;
    }
  }

  pushCurrent();
  return chunks;
}
