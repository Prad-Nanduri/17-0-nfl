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
- When testing external links, compare server-provided attributes against the live DOM if new-tab behavior is unexpected. Tool-managed Chrome may alter `target` attributes. Recheck in an isolated headed Chrome profile on a separate CDP port without modifying app DOM. Capture the popup event and identify pages by URL, not their array index.
- For mobile recordings, an emulated viewport taller than the physical browser content area may clip the footer out of the recording even when a Playwright screenshot captures it. Use a shorter viewport at the same mobile width for visible menu interaction, and capture full-size mobile screenshots separately. Native screenshot pixels and tool-returned DOM can refer to different browser instances when using isolated Chrome; use that instance's CDP page for DOM inspection.

## Devin Secrets Needed

None for guest play or testing the unavailable-account fallback. Account email-delivery tests require the deployment's configured Supabase credentials; ask for the existing secret references rather than inventing them.
