# Browser Automation Defaults

- Use `agent-browser` for ad hoc inspection, interaction, screenshots, and local
  UI verification.
- Use Playwright for committed e2e suites and CI regression coverage.
- Use Playwright MCP only when the CLI is unavailable or the task requires that
  surface.
- Load the `browser-runtime` skill only for unattended public-web sessions,
  agent-owned authentication, or shared remote-provider policy. Private targets
  stay local; never pass provider credentials through prompts or repositories.

## Safe operation

- Smoke-check the browser, then interact through fresh snapshots after page
  changes. Verify changed user flows against the running application.
- Keep dashboards, CDP endpoints, cookies, auth state, message bodies, codes,
  magic links, and private screenshots out of logs and commits.
- Stop for human action on CAPTCHA, payment, consent, or personal-profile steps.
- Do not switch remote providers automatically after a failure; follow the
  routed runtime policy.
