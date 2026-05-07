# UI Design Generation Runbook

## Purpose

Every site must pass through GPT-powered UI design generation before implementation. User references are optional; design generation is mandatory.

## Standard Flow

1. Agent 2 writes product, SEO, content, tool specs, `ui-reference-dossier.md`, and `design-generation-input.md`.
2. Agent 2.5 builds `design-generation-prompt.md`.
3. Agent 2.5 uses `web-access` to submit the prompt and any allowed reference assets to the ChatGPT web UI or another approved design generation surface.
4. Agent 2.5 requests at least three UI directions, each with desktop/mobile design targets and runnable frontend code.
5. Agent 2.5 imports any downloaded code archive with `scripts/design/import-generated-ui.mjs`.
6. Agent 2.5 runs each option locally and captures desktop/mobile screenshots.
7. Agent 2.5 selects one option and writes `design-manifest.md`.
8. Agent 5 runs in Design Gate mode. Agent 3 cannot start until this gate passes.

## Reference Modes

`reference-guided` mode is used when the user provides reference sites, screenshots, illustrations, components, or interaction examples.

`open-exploration` mode is used when no references are provided. It still requires external design generation and at least three distinct directions.

## External LLM Safety

Never send:

- `.env.local`
- Cloudflare tokens
- account IDs not needed for design
- destination emails
- private credentials
- unpublished user personal data

The design model may adjust UI hierarchy and interaction layout, but Agent 2 remains the source of truth for product requirements, SEO targets, and content intent.

## Importing Downloaded Code

When ChatGPT produces a zip archive, import it with:

```bash
node scripts/design/import-generated-ui.mjs \
  --run-dir runs/<site-id> \
  --zip ~/Downloads/<generated-ui>.zip \
  --option option-a
```

Use `--select` only for the approved option:

```bash
node scripts/design/import-generated-ui.mjs \
  --run-dir runs/<site-id> \
  --zip ~/Downloads/<generated-ui>.zip \
  --option option-b \
  --select
```

The script validates zip paths before extraction and writes into:

```txt
runs/<site-id>/agent-2-5-output/generated-designs/<option>/code/
runs/<site-id>/agent-2-5-output/selected-design/code/
```

## Design Gate

Agent 5 Design Gate must fail if:

- no runnable code exists
- no desktop/mobile screenshots exist
- generated code screenshots do not resemble the design target
- first viewport is a marketing page instead of the tool
- mobile layout is unusable
- the result looks generic or template-like
- protected assets, logos, exact layouts, or reference copy are copied
