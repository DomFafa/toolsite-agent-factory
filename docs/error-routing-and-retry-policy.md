# Error Routing and Retry Policy

## Agent 2 errors

Route back to Agent 2 when the site brief is incomplete, unclear, or inconsistent with the keyword/domain.

## Agent 3 errors

Route back to Agent 3 when:

- UI is generic
- Screenshots are missing
- Desktop and mobile layouts are not both provided
- Reference was copied too closely
- Code screenshot and actual UI are not the same artifact

## Agent 4 errors

Route back to Agent 4 when:

- Astro implementation diverges from Agent 3 screenshots
- Tool logic is broken
- Build fails
- SEO fields are missing

## Agent 5 errors

Agent 5 does not fix issues by default. It writes a QA failure report and routes the issue to the responsible agent.

## Agent 6 errors

Agent 6 stops safely when:

- Cloudflare zone is not active
- Domain is missing
- Approval is incomplete
- QA failed
- DNS/SSL state is not ready
