---
name: perfect-season-local-runtime
description: Run and verify the Perfect Season Next.js web app (apps/web) locally, in dev and production mode.
---

# Local runtime testing

- Use Node 20+ and install from the repo root (`npm install`, npm workspaces). On Windows Git Bash, use `npm.cmd`/`npx.cmd` if the extensionless shims fail.
- Dev: from the repo root run `npm run dev`; open `http://localhost:3000/`.
- Production: stop the dev server first (both use `apps/web/.next`), then `npm run build` and `npm run start -w @perfect-season/web`. There is no root `start` script.
- The placeholder home page imports the NFL/CFB workspace constants and needs no backend credentials — Supabase/Redis are not required to test it.
- Verify: heading and both sport identifiers render, browser console has no errors/hydration warnings, Tailwind preflight is applied (zero default margins). A classless page emits Tailwind's "no utility classes" warning; that is expected.

## Devin Secrets Needed

None for the static placeholder. Backend-connected routes need the variables documented in `.env.example`.
