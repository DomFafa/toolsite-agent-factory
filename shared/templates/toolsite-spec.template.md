# Toolsite SPEC

This SPEC is the required hard gate before Agent 2 starts. Agent 2 is blocked until this file is complete, mechanically checked, and explicitly confirmed by the user.

## User-Provided Five Elements

- Keyword / 关键词:
- Target Domain / 目标域名:
- UI Reference / UI 参考:
- UX Reference / UX 参考:
- Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点:

UI Reference and UX Reference are required fields, but they do not require URLs. The user may explicitly write "no clear reference", "open exploration", or "follow tool-site best practices".

The SPEC must be specific to these five elements. Do not leave the substantive sections as generic tool-site boilerplate. The current keyword, target domain, UI reference, UX reference, and extra constraints must appear in the relevant sections below.

## Lightweight Q&A Record

- Question rounds:
- Complex tool: no
- Early SPEC reason:

Target question range is 12-20 rounds. Complex tools may use up to 30 rounds. If fewer than 12 rounds were enough, this section must record: 六个用户决策区已清楚，用户同意提前输出 SPEC。

## Tool Purpose

<!-- Name the exact tool and its concrete user task. Do not replace this with generic "calculation/conversion/checking task" language. -->

## First Viewport UX

<!-- Describe the actual first-screen tool experience for this keyword/domain and the approved UI reference. -->

## Input / Output Model

<!-- Preserve the concrete input and output model from the Q&A, including key user answers. -->

## Result Experience

<!-- List the concrete results/metrics the current tool must show. -->

## UI / UX Direction

<!-- Include the approved UI reference and UX reference, with tool-specific interpretation. -->

## Non-goals

<!-- List the exact excluded features from the Q&A and extra constraints. -->

## Specificity Requirements

- Preserve the current keyword, target domain, UI reference, UX reference, and extra constraints in substantive sections, not only in the five-element list.
- Preserve the key Pre-Agent2 Q&A answers.
- Do not use generic template language as a substitute for tool-specific behavior.
- For `word counter`, include plain text input, real-time statistics, words, characters, sentences, paragraphs, reading time, speaking time, local browser processing, Stripe direction, `wordcounter.net`, and the confirmed non-goals: no login/account/database/AI rewrite/spelling check/grammar check/history.

## Technical Constraints

- Static frontend only.
- No backend.
- No database.
- No login.
- No API keys in the shipped site.

## Page Boundary

- Required pages: `/`, `/privacy`, `/terms`, `/sitemap.xml`, `/robots.txt`.
- Forbidden by default unless explicitly requested: `/login`, `/dashboard`, `/account`, `/pricing`, `/leaderboard`, `/api`, `/blog`.

## Agent Workflow Boundary

- Agent 2 may not start until this SPEC passes the Pre-Agent2 Toolsite SPEC Gate.
- Agent 2 owns product, SEO, content, tool behavior, and design input.
- Agent 2.5 owns external UI design generation after Agent 2.

## SEO Baseline

- Primary keyword must drive title, description, H1, and core page intent.
- Development builds stay `noindex`.
- Production indexing starts only after Final QA and launch approval.

## Success Criteria Baseline

- The first viewport presents the real tool, not marketing filler.
- The tool behavior matches the confirmed input/output model.
- The final site passes required gates before launch.

## User Confirmation

- [ ] User confirmed this Toolsite SPEC before Agent2 starts.
- Confirmation text:
- Confirmed by:
- Confirmed at:
