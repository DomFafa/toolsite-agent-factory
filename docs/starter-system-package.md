# Starter System Package

This branch was created for the Codex-ready starter system work.

The generated package is delivered as `toolsite-agent-factory-starter-system.zip` in the chat artifact because the package contains a full replacement `starter-site/`, motherboard docs, YAML configs, shared templates, install script, and design scripts.

Install command after unzipping the package into a temporary folder:

```bash
./apply-starter-system.sh /path/to/toolsite-agent-factory
cd /path/to/toolsite-agent-factory
npm run motherboard:validate
npm run motherboard:prompt -- --run-dir runs/<site-id> --write
```

Package contents:

- `starter-site/`: Codex-ready Astro scaffold with A/B structural slots.
- `docs/ui-motherboard-system.md`: human-readable motherboard method.
- `shared/design-motherboards/`: Agent 2.5 readable motherboard rules.
- `shared/design-motherboards/config/`: YAML machine rules.
- `shared/templates/`: Agent 2.5 selection and handoff templates.
- `scripts/design/build-agent25-motherboard-prompt.mjs`: prompt builder.
- `scripts/design/validate-motherboard-config.mjs`: motherboard config validator.
