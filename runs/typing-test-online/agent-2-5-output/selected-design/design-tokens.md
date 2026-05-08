# Design Tokens

## Option A — Benchmark Console

Source: ChatGPT conversation `https://chatgpt.com/c/69fcfcc5-7dc4-8321-b82e-6728fe80d267`.

- Font family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- Page background: `#F6F8FC` with system-compliant linear depth only
- Surface: `#FFFFFF`
- Elevated surface: `#FBFCFF`
- Text strong: `#0F172A`
- Text normal: `#334155`
- Text muted: `#64748B`
- Border: `#D9E2EF`
- Border strong: `#B8C4D6`
- Primary accent: `#635BFF`
- Primary accent soft: `#EEF0FF`
- Cyan accent: `#22D3EE`
- Correct bg/text: `#EAF8F0` / `#166534`
- Incorrect bg/text: `#FDECEC` / `#991B1B`
- Current bg/border: `#FFF7CC` / `#C084FC`
- Main panel radius: `28px`; passage panel radius: `24px`; metric block radius: `18px`
- Main panel shadow: `0 24px 80px rgba(15, 23, 42, 0.10)`
- H1: `48px / 1.02` desktop, `34px / 1.08` mobile, zero letter spacing
- Passage text: `25px` desktop, `19px` mobile

System-level normalization from GPT output: radial glow backgrounds and negative letter spacing were removed to satisfy repository frontend rules while preserving selected option, component structure, palette, spacing, and state model.
