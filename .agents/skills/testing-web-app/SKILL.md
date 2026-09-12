---
name: testing-web-app
description: Run local browser tests for Perfect Season guest drafts on Windows.
---

# Local web testing

- Use `npm.cmd` and `npx.cmd` on Windows; Git Bash npm shims may fail.
- Start the app from `apps/web` with `npx.cmd next dev -p 3000`.
- Guest play requires no account. Use a new incognito window/profile to test fresh sessions.
- Keep the server alive during resume tests: guest draft data may be in memory. A server restart requires a new draft, not merely a browser reload.
- For repeatable full-roster testing, select Position-First. For every pick, click Spin, a visible candidate, then the board slot marked On the clock. Wait for the roster count to increment before spinning again.
- At completion, click Simulate season and verify a results URL, record, and 17 regular-season game rows.
- Verify sport switching before a pick, locked feedback after a pick, and unlocked navigation after abandonment. Distinguish `aria-disabled` (can dispatch feedback clicks) from native disabled controls.
- Capture account errors after scrolling the message into view, not just the form heading.
- If using headed Playwright over CDP, install playwright-core only in an external evidence folder. Use visible UI clicks and avoid direct API mutations. Incognito cookies may not appear in context.cookies(); a page CDP Network.getCookies check can verify flags without logging token values.
- Save recordings and screenshots in a persistent home-directory folder.

## Devin Secrets Needed

None for guest play or testing the unavailable-account fallback. Account email-delivery tests require the deployment's configured Supabase credentials; ask for the existing secret references rather than inventing them.
