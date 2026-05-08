# External ChatGPT Response Evidence

Source URL: https://chatgpt.com/c/69fcfcc5-7dc4-8321-b82e-6728fe80d267
Conversation title: UI设计方向建议
Browser target ID: CBA18A00DCA0C5E4C004AF1FA0F6770B
Extracted at: 2026-05-07T22:13:29.595Z
Message count extracted: 3

## Message 1 - user

# Design Generation Prompt

## External Design Brief

You are generating implementation-ready UI design directions for typing-test-online.com, a static browser-based typing speed test. The output will be restored by Codex in Astro using HTML, CSS, and vanilla JavaScript. The default visual restoration target is 90% screenshot similarity between the selected design target and the rendered implementation.

Use references only within these boundaries:

- Stripe: visual mood only, especially crisp typography, dense-but-breathable spacing, restrained depth, and professional SaaS polish. Do not copy Stripe layout, gradients, brand assets, navigation, text, or trade dress.
- SpeedTypingOnline typing test: functional coverage only, especially timed test workflow, live WPM/accuracy feedback, restartable practice, and character-level highlighting. Do not copy layout, sample passages, account features, protected text, ads, or dated styling.

## Product Scope

- Positioning: professional benchmark + practice feedback.
- V1 is timed-test only. Do not include fixed word-count tests.
- Global English only. No regional exam, language, or local-market elements.
- Static frontend only: no backend, login, database, API keys, leaderboard, server persistence, paid plans, or server-verified certificate links.
- Prefer no bitmap/image assets. Use HTML text, CSS, stable layout, and simple inline SVG/iconography only when useful.
- Functionality and SEO work are deferred until after the selected visual design passes the visual restoration gate.

## First Viewport Requirements

The first viewport must be the usable typing tool, not a marketing hero. Include:

- Header with brand Typing Test Online.
- H1 Typing Test Online.
- Support line: Start typing to measure WPM, CPM, accuracy, and mistakes.
- Duration segmented control: 30 sec, 1 min, 2 min, 3 min, 5 min.
- Passage mode selector: Words, Sentences, Practice, Numbers.
- Difficulty selector: Easy, Standard, Advanced.
- Live metrics: Time, WPM, CPM, Accuracy, Mistakes, Progress.
- Large passage display with current/correct/incorrect states.
- Typing input.
- Restart and New passage buttons.

Use this original placeholder passage, or another original non-copied passage of similar length:

Steady practice builds speed. Focus on each word, keep a calm rhythm, and correct mistakes before they become habits.

## Usability Requirements

- Usability comes before visual polish.
- Design for realistic dynamic values: 00:00, 125 WPM, 625 CPM, 100%, 48 mistakes, 100%, and long mode/difficulty labels if future copy expands.
- Minimum desktop body/control label target: 12px. Minimum mobile label target: 14px unless secondary metadata.
- Desktop click targets should be at least 32px. Mobile tap targets should be at least 44px where space permits.
- Controls must have visible effects. No no-op controls.
- Changing duration, mode, or difficulty while running should reset the test with clear state.
- Restart resets input and metrics while keeping selected duration/mode/difficulty.
- New passage resets input and metrics and loads a different bundled passage.
- Optional toggles must affect visible state or be omitted.
- Current character and mistakes must not rely on color alone; use underline, border, shape, or background changes.
- Mobile must keep passage and input readable and avoid keyboard-covering sticky controls.
- Avoid cards inside cards and generic Tailwind/SaaS template patterns.

## Required Output Per Direction

Generate at least three distinct desktop/mobile UI directions. Each direction must include:

- Desktop and mobile design targets.
- Design tokens with concrete values.
- Component and layout specs.
- Usability contract.
- Asset-quality contract.
- Interaction state model.
- Dynamic data fit notes.
- UX self-audit.
- Asset plan.
- Restoration rules.
- Forbidden deviations.
- Runnable frontend code when possible.
- Short rationale and codability notes.

If the selected design uses no image slots, the selected asset-quality contract and asset acquisition report must explicitly state: required image slots: none; selected-option-assets.zip is not required because the selected design contains no image slots.
展开

## Message 2 - assistant

我会把它整理成 3 个可交给 Codex 的设计方向，并直接推荐一个最适合实现的版本；为了避免后续复刻跑偏，我会把“视觉边界”和“交互状态”写得比较硬。

## Message 3 - assistant

下面给你一份可以直接交给 Codex / Agent 3 / Agent 5 使用的设计方向包。三套都不使用图片资产，默认用 Astro + HTML + CSS + vanilla JS 可复刻。

推荐结论

推荐选择 Option A：Benchmark Console

原因：它最适合 typing-test-online.com 的定位——专业测速、清晰反馈、首屏即工具。它有足够的 SaaS 精致感，但不依赖复杂插画、图片、拟物纹理或难还原动画，Astro/CSS 复刻稳定性最高，最容易达到 90% screenshot similarity。

Option A — Benchmark Console
1. Design target
Desktop target

整体像一个专业 typing benchmark 控制台。

布局：

顶部 header，高度 64px。

主体最大宽度：1180px。

H1 + support line 在工具顶部左侧。

Duration / Mode / Difficulty 是同一行控制带。

Live metrics 是 6 个横向指标块。

Passage 是最大视觉中心，占首屏主面积。

Typing input 在 passage 下方。

Restart / New passage 在底部右侧。

视觉关键词：

crisp

professional

calm benchmark

SaaS polish

precise but not cold

Mobile target

390px 宽度下：

Header 保持单行。

H1 缩小。

Duration chips 横向滚动或自动换行。

Mode / Difficulty 两列换行。

Metrics 变成 2 列 x 3 行。

Passage 字号不低于 18px。

Input 高度 112px。

操作按钮全宽或 50/50 分布。

2. Design tokens
Font family:
- Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif

Colors:
- Page background: #F6F8FC
- Surface: #FFFFFF
- Elevated surface: #FBFCFF
- Text strong: #0F172A
- Text normal: #334155
- Text muted: #64748B
- Border: #D9E2EF
- Border strong: #B8C4D6
- Primary accent: #635BFF
- Primary accent soft: #EEF0FF
- Cyan accent: #22D3EE
- Correct bg: #EAF8F0
- Correct text: #166534
- Incorrect bg: #FDECEC
- Incorrect text: #991B1B
- Current bg: #FFF7CC
- Current border: #C084FC

Radius:
- Page shell: 0
- Main tool panel: 28px
- Control chip: 999px
- Metric block: 18px
- Passage panel: 24px
- Input: 18px

Shadow:
- Main panel: 0 24px 80px rgba(15, 23, 42, 0.10)
- Small elevated: 0 10px 30px rgba(15, 23, 42, 0.08)

Spacing:
- Desktop page padding: 32px
- Mobile page padding: 16px
- Main panel padding desktop: 28px
- Main panel padding mobile: 18px
- Control gap: 8px
- Section gap: 20px

Typography:
- H1 desktop: 48px / 1.02 / 760 weight
- H1 mobile: 34px / 1.08 / 760 weight
- Support line: 17px desktop, 15px mobile
- Control label: 12px desktop, 14px mobile
- Chip text: 14px
- Metric label: 12px
- Metric value: 22px desktop, 20px mobile
- Passage text: 25px desktop, 19px mobile
- Input text: 18px
3. Component and layout specs
Header

Left: brand Typing Test Online

Right: small Tools link placeholder

Height: 64px

No heavy nav.

No account/login/leaderboard.

Main tool panel

One large parent surface.

Do not create nested cards inside nested cards.

Use subtle border and shadow.

Tool starts immediately in first viewport.

Control band

Contains:

Duration: 30 sec, 1 min, 2 min, 3 min, 5 min

Passage mode: Words, Sentences, Practice, Numbers

Difficulty: Easy, Standard, Advanced

Controls are segmented buttons, not dropdowns.

Active state:

Background: #0F172A

Text: white

Slight shadow

Inactive state:

White / soft blue background

Border visible

Metrics

Six metric blocks:

Time

WPM

CPM

Accuracy

Mistakes

Progress

Each metric block must support realistic values:

00:00

125 WPM

625 CPM

100%

48 mistakes

100%

Passage display

Large readable text.

Each character is wrapped in a span.

Correct state: soft green background.

Incorrect state: red background + border-bottom or wavy underline.

Current state: yellow highlight + underline.

Current character must not rely on color alone.

Typing input

Large textarea.

Placeholder: Start typing here...

Focus state: accent border + glow.

Input must not be hidden behind mobile sticky controls.

Buttons

Restart: secondary button.

New passage: primary button.

Desktop target height: 40px+

Mobile target height: 44px+

4. Usability contract

Option A passes the usability contract.

First viewport is the usable typing tool.

No marketing-only hero.

All controls visibly affect state.

Changing duration/mode/difficulty resets test.

Restart keeps selected duration/mode/difficulty.

New passage changes bundled passage and resets metrics.

Metrics support long values.

Character states use color + background + underline/border.

Mobile passage and input stay readable.

No sticky bottom control that fights the keyboard.

No login, backend, leaderboard, certificate, or fixed word-count mode.

5. Asset-quality contract

Required image slots: none.

Use only:

HTML text

CSS gradients

CSS borders

CSS shadows

Optional tiny inline SVG icons only if they improve clarity

Selected-option asset acquisition report:

required image slots: none
selected-option-assets.zip is not required because the selected design contains no image slots.
6. Interaction state model

States:

idle:
- input empty
- timer not running
- metrics reset
- current character is first character

running:
- starts on first typed character
- timer counts down
- WPM / CPM / Accuracy / Mistakes / Progress update live

finished:
- triggered when time reaches 0 or passage is completed
- input becomes readonly or ignored
- final metrics remain visible

reset:
- triggered by Restart, New passage, or changing controls
- input clears
- metrics reset
- timer returns to selected duration

Control effects:

Duration change:
- updates selected duration
- resets current test

Mode change:
- updates passage pool
- loads first matching passage
- resets current test

Difficulty change:
- updates passage pool
- loads matching passage
- resets current test

Restart:
- keeps selected controls
- keeps current passage
- resets input and metrics

New passage:
- keeps selected controls
- loads another bundled passage
- resets input and metrics
7. Dynamic data fit notes

Pass.

Metric cards use flexible width and minmax.

48 mistakes fits without wrapping on desktop.

Mobile metrics use 2 columns.

Future longer labels like Advanced Practice can fit if chip padding is retained.

Passage display supports long text with normal wrapping.

Character spans should use inline layout, not fixed grid.

8. UX self-audit

Pass.

Potential risk:

Too many controls in first viewport could feel dense on mobile.

Mitigation:

Use grouped labels.

Allow chips to wrap.

Keep metrics compact.

Keep passage as visual priority.

Agent 5 Design Package Gate:

PASS
9. Restoration rules

Codex must preserve:

One large tool panel.

Header + H1 + support line.

Controls above metrics.

Metrics above passage.

Passage as the dominant visual element.

No marketing hero replacing the tool.

No stock images.

No fake leaderboard.

No fixed word-count mode.

No nested generic SaaS cards.

10. Forbidden deviations

Do not:

Copy Stripe gradients, layout, navigation, or trade dress.

Copy SpeedTypingOnline layout, passages, account features, ads, or styling.

Add login, backend, API, database, certificate, or leaderboard.

Add regional exam/language/local-market features.

Use bitmap images.

Use color alone for character feedback.

Hide the actual typing tool below the fold.

Add controls that do nothing.

Option B — Editorial Practice Sheet
1. Design target
Desktop target

A calm writing-practice workspace, like a premium document editor mixed with a benchmark panel.

Layout:

Header top.

Left side: compact control rail.

Center: large paper-like passage area.

Right side: vertical live metrics rail.

Input below passage.

Visual mood:

editorial

focused

soft paper

less “dashboard”, more “practice studio”

Mobile target

Controls move above passage.

Metrics become horizontal 2-column grid.

Paper-like passage panel remains central.

Left/right rails disappear.

2. Design tokens
Colors:
- Page background: #FAF7F1
- Surface: #FFFDF8
- Text strong: #1E293B
- Text muted: #6B7280
- Border: #E8DDCC
- Primary accent: #2563EB
- Accent soft: #EFF6FF
- Correct bg: #EAF7E8
- Incorrect bg: #FFE8E8
- Current bg: #FFF3B0

Typography:
- H1: 44px desktop, 32px mobile
- Passage: 26px desktop, 20px mobile
- Metric value: 24px desktop, 20px mobile
- Labels: 12px desktop, 14px mobile

Radius:
- Main sheet: 22px
- Control rail: 24px
- Chips: 12px
- Input: 16px

Shadow:
- Paper sheet: 0 18px 60px rgba(92, 64, 33, 0.10)
3. Component and layout specs

Main shell uses 3-column grid on desktop:

260px / 1fr / 220px

Control rail is not a nested card inside a card; it is a sibling panel.

Passage area resembles a clean document sheet.

Metrics rail uses stacked values.

Input is wide and directly connected to passage workflow.

4. Usability contract

Pass with caution.

All required first viewport controls included.

Passage remains readable.

Metrics are visible while typing.

Mobile removes side rails to avoid cramped layout.

Restart/New passage remain accessible under input.

Caution:

Three-column layout is more complex to restore than Option A.

On smaller laptops, right metrics rail may compress.

5. Asset-quality contract
required image slots: none
selected-option-assets.zip is not required if this option is selected because it contains no image slots.
6. Interaction state model

Same as Option A.

Additional visible effects:

Active control in left rail receives blue fill.

Current passage sheet gains a subtle active border while running.

Finished state shows Complete badge above metrics.

7. Dynamic data fit notes

Mostly pass.

Right metrics rail can fit 48 mistakes, but values need white-space: nowrap.

On desktop below 1100px, switch to 2-column or stacked layout.

Mobile should not keep side rail.

8. UX self-audit

Strength:

Best readability.

Strong practice feeling.

Good for users who care about calm focus.

Weakness:

Less visually “benchmark SaaS”.

More layout breakpoint risk.

Slightly harder for Codex to reproduce consistently.

Agent 5 Design Package Gate:

PASS, but not the safest implementation option.
9. Asset plan

No assets.

Use:

CSS paper tone

borders

small text dividers

simple CSS-only badges

10. Restoration rules

Codex must preserve:

Desktop 3-zone workspace.

Paper-like passage area.

Metrics always visible.

Controls visible before typing.

No decorative image assets.

11. Forbidden deviations

Do not:

Turn it into a blog/editor landing page.

Hide metrics behind tabs.

Use fake document screenshots.

Use serif-heavy typography that hurts readability.

Use sticky mobile control bars.

12. Rationale and codability notes

Option B is user-friendly and elegant, but the desktop side-rail layout creates more responsive complexity than Option A. Good second choice.

Option C — Kinetic Speed Lab
1. Design target
Desktop target

A brighter, more energetic typing lab. It uses vivid accent gradients and speed-inspired UI elements while keeping the actual tool clear.

Layout:

Header.

Tool panel split into:

top control bar

left passage/input area

right metric stack with progress ring

More colorful than A/B.

Visual mood:

energetic

modern

lightweight game-like

still professional enough for benchmark use

Mobile target

Gradient header area becomes shallow.

Controls stack.

Progress ring becomes linear progress bar.

Metrics become 2-column grid.

Passage remains above input.

2. Design tokens
Colors:
- Page background: #F8FAFF
- Gradient accent 1: #7C3AED
- Gradient accent 2: #06B6D4
- Gradient accent 3: #F97316
- Surface: #FFFFFF
- Text strong: #0B1220
- Text muted: #64748B
- Border: #DAE3F2
- Correct bg: #DFFAEA
- Incorrect bg: #FFE2E2
- Current bg: #FFF2A8

Typography:
- H1 desktop: 46px
- H1 mobile: 33px
- Passage desktop: 24px
- Passage mobile: 19px

Radius:
- Main panel: 30px
- Metric pill: 20px
- Progress ring: circular CSS conic-gradient
3. Component and layout specs

Top of panel has soft gradient ribbon.

Controls sit inside white segmented groups.

Metrics can include a CSS-only progress ring on desktop.

Passage panel remains simple white to protect readability.

Input is white with strong focus border.

4. Usability contract

Pass with caution.

Tool remains first viewport.

All controls visible.

Passage readable.

Controls affect state.

Character states use shape/background/underline.

Caution:

Colorful styling must not reduce contrast.

Progress ring must be decorative but accurate.

Mobile should not waste vertical space on decorative gradient.

5. Asset-quality contract
required image slots: none
selected-option-assets.zip is not required if this option is selected because it contains no image slots.
6. Interaction state model

Same as Option A.

Additional visible effects:

Progress ring updates during typing.

Running state activates subtle pulse on time metric.

Finished state stops pulse and shows complete status.

7. Dynamic data fit notes

Pass if constrained correctly.

Metric values must not be placed inside too-small circular ring.

Ring should only visualize Progress.

Actual metric text should remain in rectangular blocks.

On mobile, replace ring with normal progress metric card.

8. UX self-audit

Strength:

Most visually distinctive.

Better for a slightly gamified typing test.

Could stand out among plain typing tools.

Weakness:

More visual details to restore.

Higher risk of over-polish hurting readability.

More CSS states.

Agent 5 Design Package Gate:

PASS only if implementation team can keep readability above decoration.
9. Asset plan

No assets.

Use:

CSS gradients

CSS conic progress

simple inline SVG optional icons

no bitmap screenshots or illustrations

10. Restoration rules

Codex must preserve:

Passage and input as the main focus.

Colorful accents only around controls/metrics.

No heavy animation.

No image assets.

No game leaderboard.

11. Forbidden deviations

Do not:

Make it dark mode.

Add neon background behind the passage text.

Add distracting animations.

Use fake trophies, badges, or gamified rewards in V1.

Add account features.

12. Rationale and codability notes

Option C is the most visually memorable, but also the easiest to overdo. It is better for a later “more playful” version, not the safest V1.

Selected Design
Selected option: Option A — Benchmark Console
Reason: Best balance of professional polish, first-viewport usability, readability, and Astro/CSS restoration reliability.
Agent 5 Design Package Gate: PASS
Required image slots: none
selected-option-assets.zip is not required because the selected design contains no image slots.
Selected Option A — Runnable Frontend Code
HTML
<!-- index.html -->
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Typing Test Online</title>
  <meta name="description" content="Start typing to measure WPM, CPM, accuracy, and mistakes with a clean browser-based typing test." />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="site-header">
    <a class="brand" href="#" aria-label="Typing Test Online home">
      <span class="brand-mark">T</span>
      <span>Typing Test Online</span>
    </a>
    <nav class="nav">
      <a href="#">Tools</a>
    </nav>
  </header>

  <main class="page">
    <section class="tool-panel" aria-labelledby="page-title">
      <div class="intro-row">
        <div>
          <p class="eyebrow">Browser benchmark</p>
          <h1 id="page-title">Typing Test Online</h1>
          <p class="support-line">Start typing to measure WPM, CPM, accuracy, and mistakes.</p>
        </div>
        <div class="run-status" id="runStatus">Ready</div>
      </div>

      <div class="control-grid" aria-label="Typing test settings">
        <div class="control-group">
          <div class="control-label">Duration</div>
          <div class="segmented" role="group" aria-label="Duration">
            <button class="seg active" data-duration="30">30 sec</button>
            <button class="seg" data-duration="60">1 min</button>
            <button class="seg" data-duration="120">2 min</button>
            <button class="seg" data-duration="180">3 min</button>
            <button class="seg" data-duration="300">5 min</button>
          </div>
        </div>

        <div class="control-group">
          <div class="control-label">Passage mode</div>
          <div class="segmented" role="group" aria-label="Passage mode">
            <button class="seg active" data-mode="Words">Words</button>
            <button class="seg" data-mode="Sentences">Sentences</button>
            <button class="seg" data-mode="Practice">Practice</button>
            <button class="seg" data-mode="Numbers">Numbers</button>
          </div>
        </div>

        <div class="control-group">
          <div class="control-label">Difficulty</div>
          <div class="segmented" role="group" aria-label="Difficulty">
            <button class="seg" data-difficulty="Easy">Easy</button>
            <button class="seg active" data-difficulty="Standard">Standard</button>
            <button class="seg" data-difficulty="Advanced">Advanced</button>
          </div>
        </div>
      </div>

      <div class="metrics" aria-label="Live typing metrics">
        <div class="metric">
          <span class="metric-label">Time</span>
          <strong id="timeMetric">00:30</strong>
        </div>
        <div class="metric">
          <span class="metric-label">WPM</span>
          <strong id="wpmMetric">0 WPM</strong>
        </div>
        <div class="metric">
          <span class="metric-label">CPM</span>
          <strong id="cpmMetric">0 CPM</strong>
        </div>
        <div class="metric">
          <span class="metric-label">Accuracy</span>
          <strong id="accuracyMetric">100%</strong>
        </div>
        <div class="metric">
          <span class="metric-label">Mistakes</span>
          <strong id="mistakesMetric">0 mistakes</strong>
        </div>
        <div class="metric">
          <span class="metric-label">Progress</span>
          <strong id="progressMetric">0%</strong>
        </div>
      </div>

      <div class="passage-shell">
        <div class="passage-topline">
          <span id="passageMeta">Words · Standard</span>
          <span class="hint">Current character is underlined</span>
        </div>
        <div class="passage" id="passageDisplay" aria-label="Typing passage"></div>
      </div>

      <label class="input-label" for="typingInput">Typing input</label>
      <textarea
        id="typingInput"
        class="typing-input"
        rows="4"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="Start typing here..."
      ></textarea>

      <div class="actions">
        <button class="button secondary" id="restartButton">Restart</button>
        <button class="button primary" id="newPassageButton">New passage</button>
      </div>
    </section>
  </main>

  <script src="script.js"></script>
</body>
</html>
CSS
/* styles.css */
:root {
  --bg: #f6f8fc;
  --surface: #ffffff;
  --surface-soft: #fbfcff;
  --text: #0f172a;
  --text-mid: #334155;
  --muted: #64748b;
  --border: #d9e2ef;
  --border-strong: #b8c4d6;
  --primary: #635bff;
  --primary-soft: #eef0ff;
  --cyan: #22d3ee;
  --correct-bg: #eaf8f0;
  --correct-text: #166534;
  --wrong-bg: #fdecec;
  --wrong-text: #991b1b;
  --current-bg: #fff7cc;
  --current-border: #c084fc;
  --shadow: 0 24px 80px rgba(15, 23, 42, 0.10);
  --small-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

* {
  box-sizing: border-box;
}

html {
  min-height: 100%;
}

body {
  margin: 0;
  min-height: 100%;
  color: var(--text);
  background:
    radial-gradient(circle at 12% 8%, rgba(99, 91, 255, 0.12), transparent 32%),
    radial-gradient(circle at 88% 0%, rgba(34, 211, 238, 0.15), transparent 30%),
    linear-gradient(180deg, #fbfcff 0%, var(--bg) 46%, #eef3fb 100%);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.site-header {
  height: 64px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  text-decoration: none;
  font-size: 15px;
  font-weight: 760;
  letter-spacing: -0.01em;
}

.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: white;
  background: linear-gradient(135deg, var(--primary), var(--cyan));
  box-shadow: var(--small-shadow);
}

.nav a {
  color: var(--muted);
  text-decoration: none;
  font-size: 14px;
  font-weight: 650;
}

.nav a:hover {
  color: var(--text);
}

.page {
  padding: 18px 32px 56px;
}

.tool-panel {
  max-width: 1180px;
  margin: 0 auto;
  padding: 28px;
  border: 1px solid rgba(217, 226, 239, 0.9);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(251, 252, 255, 0.96)),
    var(--surface);
  box-shadow: var(--shadow);
}

.intro-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--primary);
  font-size: 12px;
  font-weight: 780;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(34px, 5vw, 48px);
  line-height: 1.02;
  letter-spacing: -0.055em;
  font-weight: 790;
}

.support-line {
  margin: 12px 0 0;
  max-width: 620px;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.55;
}

.run-status {
  flex: 0 0 auto;
  min-width: 96px;
  min-height: 36px;
  padding: 9px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--text-mid);
  font-size: 13px;
  font-weight: 760;
  text-align: center;
}

.run-status.running {
  color: #4338ca;
  background: var(--primary-soft);
  border-color: rgba(99, 91, 255, 0.28);
}

.run-status.finished {
  color: #166534;
  background: var(--correct-bg);
  border-color: rgba(22, 101, 52, 0.20);
}

.control-grid {
  display: grid;
  grid-template-columns: 1.05fr 1.1fr 0.8fr;
  gap: 14px;
  margin-bottom: 18px;
}

.control-group {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
}

.control-label {
  margin: 0 0 9px 2px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 760;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.segmented {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.seg {
  min-height: 34px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-mid);
  font-size: 14px;
  font-weight: 720;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.seg:hover {
  transform: translateY(-1px);
  border-color: var(--border-strong);
}

.seg.active {
  color: white;
  background: var(--text);
  border-color: var(--text);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}

.metric {
  min-width: 0;
  padding: 14px 14px 13px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff, #f8fbff);
}

.metric-label {
  display: block;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 760;
}

.metric strong {
  display: block;
  color: var(--text);
  font-size: 22px;
  line-height: 1.05;
  letter-spacing: -0.035em;
  white-space: nowrap;
}

.passage-shell {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 24px;
  background: var(--surface);
}

.passage-topline {
  min-height: 42px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 690;
}

.hint {
  color: #7c8aa0;
}

.passage {
  min-height: 178px;
  padding: 26px;
  color: var(--text-mid);
  font-size: 25px;
  line-height: 1.82;
  letter-spacing: 0.005em;
  word-break: break-word;
}

.char {
  position: relative;
  border-radius: 6px;
  padding: 1px 1px 2px;
}

.char.correct {
  color: var(--correct-text);
  background: var(--correct-bg);
}

.char.wrong {
  color: var(--wrong-text);
  background: var(--wrong-bg);
  box-shadow: inset 0 -2px 0 var(--wrong-text);
}

.char.current {
  background: var(--current-bg);
  outline: 2px solid rgba(192, 132, 252, 0.45);
  text-decoration: underline;
  text-decoration-thickness: 3px;
  text-underline-offset: 5px;
}

.char.space.wrong::after {
  content: "·";
  color: var(--wrong-text);
}

.input-label {
  display: block;
  margin: 16px 0 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 780;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.typing-input {
  width: 100%;
  min-height: 118px;
  resize: vertical;
  padding: 16px 18px;
  border: 1px solid var(--border-strong);
  border-radius: 18px;
  outline: none;
  background: #fff;
  color: var(--text);
  font-size: 18px;
  line-height: 1.55;
  box-shadow: inset 0 1px 0 rgba(15, 23, 42, 0.03);
}

.typing-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px rgba(99, 91, 255, 0.12);
}

.typing-input:disabled {
  color: var(--muted);
  background: #f8fafc;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}

.button {
  min-height: 42px;
  padding: 10px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 760;
  border: 1px solid transparent;
}

.button.secondary {
  color: var(--text-mid);
  background: var(--surface);
  border-color: var(--border-strong);
}

.button.secondary:hover {
  border-color: var(--text);
}

.button.primary {
  color: white;
  background: linear-gradient(135deg, var(--primary), #4f46e5);
  box-shadow: 0 14px 26px rgba(99, 91, 255, 0.22);
}

.button.primary:hover {
  filter: brightness(0.98);
}

@media (max-width: 980px) {
  .control-grid {
    grid-template-columns: 1fr;
  }

  .metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .site-header {
    height: 58px;
    padding: 0 16px;
  }

  .brand {
    font-size: 14px;
  }

  .brand-mark {
    width: 28px;
    height: 28px;
    border-radius: 9px;
  }

  .page {
    padding: 8px 16px 34px;
  }

  .tool-panel {
    padding: 18px;
    border-radius: 24px;
  }

  .intro-row {
    display: block;
    margin-bottom: 18px;
  }

  .support-line {
    font-size: 15px;
  }

  .run-status {
    margin-top: 14px;
    width: fit-content;
  }

  .control-label {
    font-size: 14px;
  }

  .seg {
    min-height: 44px;
    padding: 10px 13px;
    font-size: 14px;
  }

  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric {
    padding: 13px;
  }

  .metric strong {
    font-size: 20px;
  }

  .passage-topline {
    align-items: flex-start;
    flex-direction: column;
    padding: 12px 14px;
  }

  .passage {
    min-height: 168px;
    padding: 18px;
    font-size: 19px;
    line-height: 1.85;
  }

  .typing-input {
    min-height: 112px;
    font-size: 17px;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .button {
    min-height: 46px;
  }
}
JavaScript
// script.js
const passageBank = {
  Words: {
    Easy: [
      "green river bright window simple garden open morning soft paper clean light",
      "fresh apple quiet table small flower warm summer happy pencil silver cloud"
    ],
    Standard: [
      "Steady practice builds speed. Focus on each word, keep a calm rhythm, and correct mistakes before they become habits.",
      "Clear typing begins with relaxed hands, steady eyes, and a patient rhythm that turns small gains into reliable speed."
    ],
    Advanced: [
      "Accurate momentum develops when deliberate correction, consistent pacing, and focused attention work together under time pressure.",
      "Professional typing rewards controlled movement, rapid recognition, and the discipline to recover smoothly after each error."
    ]
  },
  Sentences: {
    Easy: [
      "The desk is clear. The timer is ready. Type each word with care.",
      "A calm start helps your hands move well. Keep your eyes on the next word."
    ],
    Standard: [
      "Typing speed improves when accuracy comes first. A smooth rhythm often beats a rushed and uneven pace.",
      "Each short test gives useful feedback. Review your mistakes, restart with focus, and build control."
    ],
    Advanced: [
      "The most useful benchmark is not only fast, but repeatable, readable, and calm under changing passage patterns.",
      "When pressure rises, accurate typists maintain rhythm by scanning ahead while correcting small errors before they spread."
    ]
  },
  Practice: {
    Easy: [
      "Practice slowly at first, then increase your pace when the words feel natural.",
      "Keep your shoulders relaxed, breathe evenly, and let each line guide the next."
    ],
    Standard: [
      "Use this practice round to notice where your rhythm breaks, then restart and aim for cleaner movement.",
      "The goal is not a lucky score. The goal is a stable pace that you can repeat across many passages."
    ],
    Advanced: [
      "Advanced practice should expose weak transitions, uneven punctuation timing, and moments where speed outruns attention.",
      "Measure the pattern behind each mistake so the next round improves both confidence and control."
    ]
  },
  Numbers: {
    Easy: [
      "12 24 36 48 60 72 84 96 108 120",
      "101 202 303 404 505 606 707 808 909"
    ],
    Standard: [
      "Order 4821 ships in 24 hours, batch 7305 closes at 18:45, and code 9920 resets after review.",
      "The report shows 125 WPM, 625 CPM, 100% accuracy, 48 mistakes, and 100% progress as test values."
    ],
    Advanced: [
      "Invoice 384-9921 requires 7 checks, 14 notes, 28 updates, and 56 confirmations before 23:59.",
      "Sequence 91827, 74610, 58392, and 10486 should be typed carefully without swapping digits or skipping spaces."
    ]
  }
};

const state = {
  duration: 30,
  mode: "Words",
  difficulty: "Standard",
  passageIndex: 0,
  passage: "",
  started: false,
  finished: false,
  startTime: null,
  timerId: null,
  remaining: 30
};

const els = {
  durationButtons: document.querySelectorAll("[data-duration]"),
  modeButtons: document.querySelectorAll("[data-mode]"),
  difficultyButtons: document.querySelectorAll("[data-difficulty]"),
  passageDisplay: document.getElementById("passageDisplay"),
  passageMeta: document.getElementById("passageMeta"),
  input: document.getElementById("typingInput"),
  restart: document.getElementById("restartButton"),
  newPassage: document.getElementById("newPassageButton"),
  runStatus: document.getElementById("runStatus"),
  time: document.getElementById("timeMetric"),
  wpm: document.getElementById("wpmMetric"),
  cpm: document.getElementById("cpmMetric"),
  accuracy: document.getElementById("accuracyMetric"),
  mistakes: document.getElementById("mistakesMetric"),
  progress: document.getElementById("progressMetric")
};

function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
}

function getPassages() {
  return passageBank[state.mode][state.difficulty];
}

function setStatus(label, type = "idle") {
  els.runStatus.textContent = label;
  els.runStatus.classList.toggle("running", type === "running");
  els.runStatus.classList.toggle("finished", type === "finished");
}

function syncActiveButtons() {
  els.durationButtons.forEach(button => {
    button.classList.toggle("active", Number(button.dataset.duration) === state.duration);
  });

  els.modeButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });

  els.difficultyButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.difficulty === state.difficulty);
  });
}

function loadPassage() {
  const list = getPassages();
  state.passage = list[state.passageIndex % list.length];
  els.passageMeta.textContent = `${state.mode} · ${state.difficulty}`;
  renderPassage();
}

function resetTest({ keepPassage = true, status = "Ready" } = {}) {
  clearInterval(state.timerId);
  state.started = false;
  state.finished = false;
  state.startTime = null;
  state.remaining = state.duration;
  els.input.value = "";
  els.input.disabled = false;

  if (!keepPassage) {
    loadPassage();
  }

  renderPassage();
  updateMetrics();
  setStatus(status);
}

function calculateStats() {
  const typed = els.input.value;
  const elapsedSeconds = state.started
    ? Math.max(1, (Date.now() - state.startTime) / 1000)
    : 0;

  let correct = 0;
  let mistakes = 0;

  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === state.passage[i]) {
      correct++;
    } else {
      mistakes++;
    }
  }

  const minutes = elapsedSeconds / 60;
  const wpm = minutes > 0 ? Math.round((correct / 5) / minutes) : 0;
  const cpm = minutes > 0 ? Math.round(correct / minutes) : 0;
  const accuracy = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;
  const progress = Math.min(100, Math.round((typed.length / state.passage.length) * 100));

  return { typed, correct, mistakes, wpm, cpm, accuracy, progress };
}

function updateMetrics() {
  const stats = calculateStats();

  els.time.textContent = formatTime(state.remaining);
  els.wpm.textContent = `${stats.wpm} WPM`;
  els.cpm.textContent = `${stats.cpm} CPM`;
  els.accuracy.textContent = `${stats.accuracy}%`;
  els.mistakes.textContent = `${stats.mistakes} ${stats.mistakes === 1 ? "mistake" : "mistakes"}`;
  els.progress.textContent = `${stats.progress}%`;
}

function renderPassage() {
  const typed = els.input.value;
  const chars = [...state.passage];

  els.passageDisplay.innerHTML = chars.map((char, index) => {
    const typedChar = typed[index];
    const classes = ["char"];

    if (char === " ") classes.push("space");
    if (typedChar != null) {
      classes.push(typedChar === char ? "correct" : "wrong");
    }
    if (!state.finished && index === typed.length) {
      classes.push("current");
    }

    const output = char === " " ? "&nbsp;" : escapeHtml(char);
    return `<span class="${classes.join(" ")}">${output}</span>`;
  }).join("");
}

function escapeHtml(char) {
  return char
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function startTimer() {
  state.started = true;
  state.startTime = Date.now();
  setStatus("Running", "running");

  state.timerId = setInterval(() => {
    const elapsed = (Date.now() - state.startTime) / 1000;
    state.remaining = Math.max(0, state.duration - elapsed);
    updateMetrics();

    if (state.remaining <= 0) {
      finishTest();
    }
  }, 250);
}

function finishTest() {
  clearInterval(state.timerId);
  state.finished = true;
  state.remaining = Math.max(0, state.remaining);
  els.input.disabled = true;
  renderPassage();
  updateMetrics();
  setStatus("Complete", "finished");
}

function handleTyping() {
  if (state.finished) return;

  if (els.input.value.length > state.passage.length) {
    els.input.value = els.input.value.slice(0, state.passage.length);
  }

  if (!state.started && els.input.value.length > 0) {
    startTimer();
  }

  renderPassage();
  updateMetrics();

  if (els.input.value.length >= state.passage.length) {
    finishTest();
  }
}

els.input.addEventListener("input", handleTyping);

els.durationButtons.forEach(button => {
  button.addEventListener("click", () => {
    state.duration = Number(button.dataset.duration);
    state.remaining = state.duration;
    syncActiveButtons();
    resetTest({ keepPassage: true, status: "Reset" });
  });
});

els.modeButtons.forEach(button => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    state.passageIndex = 0;
    syncActiveButtons();
    loadPassage();
    resetTest({ keepPassage: true, status: "Reset" });
  });
});

els.difficultyButtons.forEach(button => {
  button.addEventListener("click", () => {
    state.difficulty = button.dataset.difficulty;
    state.passageIndex = 0;
    syncActiveButtons();
    loadPassage();
    resetTest({ keepPassage: true, status: "Reset" });
  });
});

els.restart.addEventListener("click", () => {
  resetTest({ keepPassage: true, status: "Restarted" });
  els.input.focus();
});

els.newPassage.addEventListener("click", () => {
  state.passageIndex = (state.passageIndex + 1) % getPassages().length;
  loadPassage();
  resetTest({ keepPassage: true, status: "New passage" });
  els.input.focus();
});

syncActiveButtons();
loadPassage();
resetTest();

最终建议：让 Codex 优先实现 Option A，不要混入 Option B/C 的布局元素。
Option A 的视觉目标最清晰，后续做 Astro 组件化、SEO 内容区、FAQ、How it works 都不会破坏首屏工具体验。
