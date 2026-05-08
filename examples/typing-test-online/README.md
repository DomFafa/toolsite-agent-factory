# Typing Test Online Golden Example

## Purpose

This folder is the Golden Example for future tool-site runs from Agent 2 through Agent 6.

It is not a project diary. It is the standard operating sample for:

- GPT option generation through Agent 2.5
- human option review
- selected-assets handling
- static visual restoration
- toolsite design-review subset
- final QA
- production approval blocking

## Non-Negotiable Gates

- Run Start Gate: before any work, output flow files read, current phase, next Agent, and forbidden actions.
- Agent 2.5 GPT Prompt Gate: GPT prompt must include Astro + HTML/CSS/vanilla JS restoration, 90% screenshot similarity, real-tool first viewport, no dynamic-data overflow, mobile usability, complete interaction states, no pretty-but-unusable UI, and no UX sacrifice for visual impact.
- Post-Final-QA Launch Stop Gate: after Final QA passes, stop; without explicit `批准上线` in the current chat, do not enter Agent 6, deploy, push production, change Cloudflare/DNS/analytics/indexing, or make production changes.

## Use In New Runs

Before starting a new tool site, read these files and mirror the sequence:

1. Agent 2 defines product, SEO, content, tool spec, and design input.
2. Agent 2.5 generates 3 GPT options through `web-access`.
3. The user sees the 3-option board before implementation.
4. Selected assets run as a separate stage.
5. Agent 5 blocks weak UX before Agent 3 starts.
6. Agent 3 restores visuals only.
7. Agent 3 visual restoration passes mechanical screenshot similarity.
8. Agent 4 adds functionality and SEO after visual lock.
9. Agent 5 final QA sends target and final screenshots to chat.
10. Agent 6 waits for all `approval.md` boxes.

## Hard Rule

No Agent may treat a written report as enough when a mechanical gate exists.
