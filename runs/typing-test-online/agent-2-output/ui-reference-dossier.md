# UI Reference Dossier

## Inspection Method

Used the required `web-access` CDP preflight and browser inspection. Screenshot capture timed out for both references, so this dossier is based on DOM structure, visible text, controls, and observed page organization rather than saved screenshots.

CDP preflight result:

- Node: OK
- Chrome remote debugging: OK
- Proxy: ready

## Decisions

- Treat Stripe as mood-only inspiration.
- Treat SpeedTypingOnline as feature-coverage inspiration.
- Do not ask Agent 2.5 to copy reference layouts, assets, sample passages, or trade dress.
- The final design should be global English with no regional exam, language, or local-market references.
- Prefer an implementation-ready no-bitmap-asset interface built from HTML/CSS and simple SVG/iconography only when needed.

## Assumptions

- Reference screenshots are not required because CDP screenshot capture timed out.
- DOM and visible-control inspection provide enough reference evidence for Agent 2.5.
- The final site should look independent from both references.
- The final site should feel like a professional benchmark plus practice tool, not a certificate or exam-prep product.

## Reference 1: Stripe

URL: `https://stripe.com/`

Reference strength: mood

Observed traits to borrow:

- High-precision typography with strong editorial hierarchy.
- Dense but breathable spacing.
- Layered interface depth through panels, cards, and product-like UI fragments.
- Professional trust cues through metrics and compact proof points.
- Confident color accents used with restraint.
- Smooth modern SaaS feel without playful clutter.

Observed traits to avoid:

- Stripe logos or brand assets.
- Exact gradient compositions.
- Exact navigation, section layouts, product cards, or copy.
- Payment, finance, or enterprise metaphors that do not fit typing practice.

Design translation:

- Use polished utility-dashboard styling for the typing test.
- Use crisp labels, compact metrics, and subtle depth around the test surface.
- Use restrained accents for current character, progress, and score states.
- Avoid turning the page into a SaaS marketing homepage.

## Reference 2: SpeedTypingOnline Typing Test

URL: `https://www.speedtypingonline.com/typing-test`

Reference strength: component and interaction

Observed functional elements:

- First content area contains a typing test rather than a pure marketing page.
- Live stats include time, speed WPM, and accuracy.
- Passage text is shown as individually highlighted characters.
- Timer default is 1 minute.
- Text settings include passage selection, text category, duration, color highlighting, restart hotkeys, and keyboard layout.
- Duration options include 30 seconds, 1 minute, 2 minutes, 3 minutes, 5 minutes, 10 minutes, 15 minutes, and 20 minutes.
- Categories include all texts, book summaries, books, short stories, fables, data entry, random pangrams, random facts, random words, proverbs, and custom text.
- Optional custom text textarea exists.
- Results include personalization/save affordances, but those should not be copied into V1 because this run is static-only and no-login.

Observed traits to borrow:

- Practical timed test workflow.
- Live WPM and accuracy feedback.
- Restartable practice loop.
- Passage and duration selection.
- Character-level or word-level highlighting.
- Clear post-test result model.

Observed traits to avoid:

- Dated visual styling.
- Dense account/login navigation.
- Exact layout and exact sample texts.
- Premium/ad-heavy messaging.
- Login/register persistence model.

Design translation:

- Keep the utility depth, simplify the controls, and make the UI feel modern.
- Show the essential controls up front, with secondary settings below or in a compact panel.
- Build a first viewport that feels like a serious speed test tool, not a portal.

## Required Visual Direction For Agent 2.5

Create a refined static tool interface that combines:

- Stripe-inspired polish and spatial confidence.
- SpeedTypingOnline-inspired functional completeness.
- Immediate first-screen typing interaction.
- No local bitmap asset dependency unless the selected design has a compelling, documented reason.

The design should not copy either reference. It should look like a new independent utility at `typing-test-online.com`.

## Component Inventory

Required components:

- Header with small brand and minimal nav.
- Test control bar.
- Metric strip.
- Passage display.
- Typing input.
- Progress indicator.
- Restart/new passage actions.
- Results panel.
- Below-tool content sections.
- FAQ accordion or simple FAQ list.
- Reserved monetization slot below the tool or between content sections, labeled as a future placeholder only if needed.

## Interaction Notes

- Start on first keystroke.
- Keep focus in the input.
- Highlight current character/word.
- Show mistakes without overwhelming the passage.
- Results should appear in place, not as a disruptive modal.
- Restart should be one click.
- Mobile should prioritize passage, input, timer, and WPM.

## Handoff

Agent 2.5 should produce design generation output for a static, responsive typing test interface. The design brief should prioritize the working tool above the fold and avoid landing-page hero composition.
