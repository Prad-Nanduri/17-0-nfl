# Perfect Season visual checkpoint

## Direction and sources

Sports editorial: bold condensed headlines, cool chalk/ink surfaces, one field-green action
accent, monochrome equipment and tunnel photography. The composition borrows the focus of
a sports cover and the clarity of a roster sheet. This is a visual checkpoint, not a functional draft.

Primary guidance: [design-taste-frontend](https://github.com/Leonxlnx/taste-skill),
read from the installed `.claude/skills/design-taste-frontend/SKILL.md`.
The installed `redesign-existing-projects` audit informs stack preservation, contrast, keyboard
states, and responsive validation. `high-end-visual-design` contributes transform-only motion
and physical feedback. Its mandatory oversized pill/nested-card prescriptions conflict with
this brief and the primary skill's shape/card discipline, so they are not applied.

Audit of the starting scaffold: Next 14 App Router, Tailwind 3, strict TypeScript; browser-default
type, no brand palette, no primitives, no interaction or layout states. Preserve the framework
and shared package boundaries; replace the placeholder home route and add `/draft`.

Taste dials: DESIGN_VARIANCE 7 / MOTION_INTENSITY 4 / VISUAL_DENSITY 4.
The marketing-specific rules apply to the landing page; the draft shell carries the same
tokens into a task-focused layout. No admin framework or feature architecture is introduced.

## Token contract

`tailwind.config.ts` owns the complete primitive palette and utility scales. `app/globals.css`
owns semantic RGB variables so alpha utilities work in both themes. System preference is the
default; the Appearance menu provides a temporary, non-persisted preview override.

- **Primary:** forest-tinted ink, 50-950. **Accent:** field green, 50-950.
- **Neutrals:** one cool green-grey family, 50-950. No pure white/black or gradient decoration.
- **Semantic surfaces:** canvas, surface, subtle; ink/muted text, line borders.
- **Actions:** action/on-action/action-hover. Success, warning, error, info are reserved
  for meaning, always accompanied by text. Sport decoration uses `sport`, never the action token.
- **Future sports:** `data-sport="nfl"` selects field green; `data-sport="cfb"` reserves an
  olive tone. It changes only the local sport accent, preserving typography, layout, and actions.
  There is no CFB page, engine import, or selector behavior in this checkpoint.
- **Type:** self-hosted Barlow Condensed 600/700 for display; Manrope Variable for controls/body.
  Mono and tabular figures for season/sample roster numbers. Display 72-120px; heading 40-60px;
  lead 18px, body 16px, small 14px, caption 12px, micro 11px.
- **Space:** explicit 4px rhythm with 2px optical corrections; 20-64px fluid gutters;
  56-112px section spacing. Containers cap at 1400px.
- **Shape:** 2px for badges/images, 4px for controls/reveal cards, 8px for panels.
  Full radius is available only for genuinely circular elements, not general containers.
- **Elevation:** raised for object hierarchy, floating for portals, card for the physical reveal.
  Most page sections use whitespace and functional separators instead.
- **Responsive:** 640/768/1024/1280/1536px. Landing stacks below 768px; draft splits at 1024px.
  Mobile keeps the reveal before the sample roster and never compresses the two into columns.
- **Layers:** base 0, header 10, dropdown 20, overlay 30, modal 40, toast 50.
- **Dark theme:** near-black green canvas (`11 15 13`) with two lifted surface steps, muted
  green-grey secondary text, and hairline edges (`.edged`, driven by `--edge`) in place of the
  drop shadows that vanish on dark. Shadows use `--shadow`/`--shadow-strength`; photography dims
  via `--photo-brightness`. Marks swap to their dark variants through `[data-theme-only]`.

## League and team marks

`lib/teams` holds static reference data: all 32 NFL franchises (`nfl.ts`, grouped by division)
and all 136 FBS programs (`cfb.ts`, 2025 membership, grouped by conference), typed as `Team`.
League marks (NFL, NCAA) are bundled under `public/logos`; team marks are hotlinked from ESPN's
public CDN in light and dark variants and rendered `unoptimized` to stay off the Vercel image quota.
`TeamLogo` / `LeagueMark` (`components/ui/team-logo.tsx`) render both variants and let the theme
CSS show one. `.logo-well` gives every mark a neutral square so brand colors never fight the surface.
All marks are trademarks of their owners; this is presentation-only reference use pending licensing review.
No team data feeds ratings, eligibility, or draft logic.

## Components and behavior

Custom Tailwind styling with official Radix Dialog, Dropdown Menu, and Toast behavior.
**No shadcn/ui code or default shadcn theme is used.** Buttons and links share `buttonStyles`.
Usage comments live beside every primitive.

```tsx
<Button variant="primary">Continue</Button>
<Button variant="secondary" disabled>Unavailable</Button>
<Button variant="ghost" loading>Loading preview</Button>
<Card elevation="raised">Distinct content object</Card>
<Badge tone="warning">Awaiting review</Badge>
<Modal trigger={<Button>Details</Button>} title="Details" description="Context">
  Content
</Modal>
<Dropdown label="Appearance" value={value} options={options} onValueChange={setValue} />
// Inside the root ToastProvider:
const notify = useToast();
notify({ title: 'Preview ready', tone: 'success' });
```

Buttons support hover, focus-visible, press, disabled, and busy states. Modal and dropdown
use Radix keyboard navigation, Escape, portal positioning, and focus restoration.
Toast supports dismissal, swipe, duration, focus/hover pause, and live announcements.
Card and Badge are informational: they are intentionally not focusable or clickable.
Put an actual Button or Link inside a Card when an action is needed.

## Motion

Framer Motion is installed explicitly as requested. The primary Taste skill prefers the
new `motion/react` package but explicitly permits the `framer-motion` import.
`lib/motion.ts` centralizes the reference parameters:

- Entry: 450ms, `[0.16, 1, 0.3, 1]`, 10px settling movement to establish hierarchy.
- Controls: 160/280ms, same settle curve, 0.98 press scale.
- Flip: spring stiffness 105, damping 21, mass 1.1; 1200px perspective. Approximately
  one second of rotation settles without a theatrical bounce. Faces share a grid cell so
  the larger face reserves space; backface visibility prevents mirrored content.
- `CardFlipReveal` is controlled by `revealed` and accepts arbitrary front/back nodes.
  Its hidden face is inert and aria-hidden. There are no roster, wheel, random, or engine dependencies.
- Reduced motion: instant face substitution, no entrance movement or CSS transitions.

## Checkpoint boundaries

`/` and `/draft` are the only experiences. Reveal/reset, appearance, explanatory dialog,
and notification are UI demonstrations. All roster selections and counts are static samples.
Lock pick is disabled. No API, persistence, random draw, ratings, eligibility, draft progression,
or simulation logic is implemented.

The two local WebP assets were generated for this checkpoint (anonymous athlete/equipment). Their intrinsic dimensions are reserved through aspect-ratio containers
and optimized by Next Image; the hero is prioritized. Fonts are locally bundled.

Validate both routes at 1440px and 375px, light/dark, reduced motion, keyboard interaction,
and console output. The four required screenshots are delivered in the PR description.
Stop for screenshot approval before implementing features.
