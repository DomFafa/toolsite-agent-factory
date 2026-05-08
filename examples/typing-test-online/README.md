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

