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
- At completion, click Simulate season and verify a results URL, record, and 17 NFL regular-season game rows (12 for CFB Quick Season).
- Verify sport switching before a pick, locked feedback after a pick, and unlocked navigation after abandonment. Distinguish `aria-disabled` (can dispatch feedback clicks) from native disabled controls.
- Sport toggle buttons have `role="radio"` with accessible names `NFL` and `College Football`; use those roles for Playwright. After switching sports, wait for the destination URL and setup view before selecting draft settings, then verify Position-First is actually checked.
- Capture account errors after scrolling the message into view, not just the form heading.
- If using headed Playwright over CDP, install playwright-core only in an external evidence folder if no existing Playwright dependency is available. Use visible UI clicks and avoid direct API mutations. Incognito cookies may not appear in context.cookies(); a page CDP Network.getCookies check can verify flags without logging token values.
- Save recordings and screenshots in a persistent home-directory folder.

## CFB real-data checks

- A non-perfect Quick Season can legitimately earn a trophy: Statement Win requires beating an opponent at least 1.75 standard deviations above mean strength. Do not assume every non-12-0 result has an empty trophy section.
- To exercise the no-trophy state without server mutations or seed overrides, use Normal/Career-Season/Position-First and choose low-rated candidates. The current candidate list is sorted highest-first, so the last candidate is useful; inspect the rating before selecting. Simulation remains stochastic, so verify actual trophy outcomes instead of assuming them.
- Real player ratings vary; offensive/defensive linemen may display `team_level_rating` badges, and missing headshots use initials. Distinguish supported team-level ratings from fixture-only placeholders.
- Inspect program reveal logos/colors and conference labels independently. For results, inspect all 12 opponent names, points, MVP, postseason N/A, the trophy section, and the visible OG image. Copy image link should open a 1200×630 PNG matching that result.

## Devin Secrets Needed

None for guest play or testing the unavailable-account fallback. Account email-delivery tests require the deployment's configured Supabase credentials; ask for the existing secret references rather than inventing them.
