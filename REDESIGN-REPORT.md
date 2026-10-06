# Frontend redesign — what changed and why

Written for you, on the branch `redesign/frontend`. Nothing is committed. Nothing was deleted from git history; the files listed as deleted are staged-as-deleted in the working tree and `git restore` brings any of them back.

## First: your code was not bad

You asked "why was my code so bad". It wasn't. It rendered, it typechecked, it was organised by a real idea (one component per content block type), and the naming was consistent. If a teammate handed me that codebase I'd have called it fine.

What it had was a **design problem misdiagnosed as a code problem**. You said it felt "stale and slow and monotone". Those three symptoms had three causes, and only one of them lived in a component file:

- **Monotone** was a CSS token problem. The palette had one accent and used it for everything, so nothing could be visually ranked against anything else.
- **Slow** was a real, findable bug: the 500ms `transition` on `background-color, border-color, color` was applied to `<body>`, so it fired during every layout paint, not just on theme switch. Every navigation had a half-second colour smear over it. That is why it *felt* slow while the network was fast.
- **Stale** was a layout problem — everything was a card in a grid, which is the default shape and reads as a template.

So most of the change is CSS and layout. The component churn follows from the layout decision, not from your code being wrong.

## Where the 51 files came from

The number is less dramatic than it looks. Roughly:

| Bucket | Count | What it actually is |
|---|---|---|
| Formatter-only | ~6 | Biome reordered imports (`{ clsx, type ClassValue }` → `{ type ClassValue, clsx }`). Zero behaviour change. `ui/badge.tsx` and `lib/utils.ts` are pure examples. |
| Block components removed | 11 | The 10 files in `components/blocks/` plus `types/content.ts`. |
| New files | 3 | `components/blog/domain.ts`, `post-list.tsx`, `rail.tsx`. |
| Real edits | ~15 | The pages, `globals.css`, `Navbar`, `Footer`, the home sections. |
| Incidental | rest | Loading skeletons and `global-not-found.js` following the new page shapes; auth files touched only where they imported something that moved. |

Two files carry most of the weight: `globals.css` (~390 lines changed) and `app/blog/page.tsx` (~301).

## What was actually wrong, item by item

**1. The theme transition was on `<body>`.** Described above. Fixed by moving it to an opt-in `.theme-transition` class that the toggle applies, so the cross-fade you liked still happens on theme switch and nowhere else. `globals.css:290`.

**2. One accent colour doing every job.** In a UI, colour is a channel — it can encode category, or magnitude, or interactivity, but if one hue does all three it encodes nothing. The redesign splits it: two "pen" colours with fixed jobs (`ink`/blue = navigation, `plot`/magenta = measured values), and a separate per-domain hue set for category. The rule written into `components/blog/rail.tsx:6` is *"neutrals for labels, plot for measured quantities, ink for navigation"* — and it holds everywhere, which is what makes the page readable at a glance rather than merely colourful.

**3. `Record<string, React.FC<any>>`.** Your one `any`, at `blocks/block-renderer.tsx:14`. It's the standard place a registry pattern leaks types: the map erases the connection between a block's `type` string and the props its component needs, so nothing stops you passing an image block's data to the code renderer. TypeScript would have caught that; the `any` asked it not to. The frontend now has zero `any`.

**4. Difficulty rendered as a coloured pill.** `difficulty` is *ordinal* — beginner < intermediate < advanced — and a pill throws the ordering away, leaving hue to carry the rank. That fails for anyone who can't distinguish the hues, and it fails for everyone at a glance because there's no visual "more than". It's now a 3-step gauge where filled bars encode the rank directly, with the word still present as text (`rail.tsx:29`).

**5. Colour was the only carrier of meaning in a few places.** Same class of problem. The fix throughout is redundancy: the domain hue always sits next to the written domain label, never instead of it (`domain.ts:6`).

**6. Similarity scores were hidden behind "Related reading".** Not a bug, a lost opportunity. Your pipeline deduplicates and cross-links by 768-dimension embeddings, and `0.87` is a truer statement about why two entries sit together than a generic heading is. Now shown as the number plus a proportional bar (`rail.tsx:70`), clamped to `[0, 1]` so a stray value can't overflow its track.

**7. Two dead icon "links" in the footer.** `<Twitter href="#">` renders a bare SVG — lucide icons don't take `href`, so it produced no link and no accessible name, pointed nowhere. Removed rather than shipped.

## Why the block components went away

This is the biggest single change, so it deserves the most honest explanation.

Your architecture was: a post is an array of typed blocks; a registry maps each `type` to a React component; `block-renderer` walks the array. That is a genuinely good pattern — it's roughly how Notion, Sanity, and Contentful model content, and it's the right answer **when the block set is open-ended and authors compose freely.**

It's the wrong answer for what you actually have. Your pipeline emits one fixed shape for every entry — summary, explanation, example, difficulty, related — in the same order, every time, because a prompt generates it. So the registry's flexibility was never exercised. What it cost instead:

- Ten files to open to understand one page's layout.
- The `any` above, which is where a registry's type safety usually goes to die.
- No way to lay out the page *as a whole*. Each block only knew about itself, so nothing could set up a relationship between the summary and the difficulty gauge — and the "everything is a card" look you disliked is exactly what you get when every section renders itself independently.

The replacement collapses the fixed shape into the page that renders it (`app/blog/[slug]/page.tsx`) and factors out the parts that genuinely repeat across pages into three small modules:

- `components/blog/domain.ts` — the tag → hue mapping, pure data plus two functions.
- `components/blog/rail.tsx` — the three measured-value primitives (`DifficultyGauge`, `SimilarityMeter`, `RailLabel`).
- `components/blog/post-list.tsx` — the entry row, used by both the archive and the home page.

That's the actual principle: **abstract on what repeats, inline what doesn't.** Ten components for one fixed layout is abstraction without repetition. Three components used across four pages is repetition earning an abstraction.

If your content ever does become author-composed, bring the registry back — and type it properly with a discriminated union so the `any` isn't needed:

```ts
type Block =
  | { type: "code"; language: string; source: string }
  | { type: "image"; url: string; alt: string };
```

Switch on `block.type` and TypeScript narrows the props for you. That's the version of your pattern I'd defend.

## Concepts introduced, and why they're standard

**Semantic design tokens over literal ones.** Tokens are named for their job (`--ink`, `--plot`, `--paper`, `--rule`), not their value (`--blue-600`). Dark mode then redefines the same names, and no component knows a theme exists. This is why the dark theme is a ~35-line block in `globals.css:107` rather than `dark:` variants sprinkled across every file.

**Channel triples for alpha.** Colours are stored as `--ink-rgb: 20 73 184` — space-separated channels, no `rgb()` wrapper — so any consumer can do `rgb(var(--ink-rgb) / 0.12)` and get a translucent version off one definition. The alternative, `color-mix()`, is cleaner-looking and **broken here**: Lightning CSS (Tailwind v4's compiler) emits an `@supports` fallback for it that drops the alpha channel, so a 12% wash renders as a fully opaque blob in the fallback path. This cost real debugging time; it's the single most important gotcha in this codebase.

**CSS custom properties as a runtime channel.** Per-domain colour can't be a Tailwind class, because the hue is data — it comes from the post's tags. So the page sets `--d-light`/`--d-dark` inline, one `@utility domain` resolves which is live for the current theme, and every child reads `rgb(var(--d) / α)`. One inline style spread colours a heading, a rule, a spine, and a wash. The alternative is a lookup table of class strings per domain per element, which Tailwind would also tree-shake away since the strings are built at runtime.

**Structure from the data, not imposed on it.** The archive groups by domain and orders groups by entry count (`app/blog/page.tsx:41`). Nothing is hand-curated, so the page shape is always an honest picture of what the pipeline has produced.

**Accessibility as a default, not a pass.** Every decorative layer carries `aria-hidden="true"`; every icon-only control has a name; colour is always redundant with text; the `prefers-reduced-motion` block neutralises animation globally (`globals.css:297`). Full WCAG conformance needs manual testing with real assistive tech and expert review — this is the floor, not a certification.

**Comments that record decisions, not mechanics.** The comments in these files say *why* — why `border-t` became a fading rule, why the icon links were deleted, why `color-mix` isn't used. That's the kind that survives a refactor.

## The resend.com pass

Two techniques, extracted from their shipped CSS rather than guessed at.

**Never a flat fill.** In dark mode a panel is an angled gradient plus a light-from-above highlight at its top edge plus a translucent white inset ring for its border — not a lighter grey rectangle. A `#0d1115` card on `#0a0d10` paper is separated by ~4% lightness, and that is the main cause of "monotone". Same class name, same markup; the depth appears only in dark, where the ground needs it (`@utility surface`, `globals.css:374`).

**Never a flat full-strength rule.** A dark page has no natural edges — there's no paper to run out of — so a hard border across the layout reads as a scar. Their dividers are strongest where content sits and dissolve into the ground at the ends. That became a family of utilities: `hairline` (fades both ends), `rule-fade` (strong under a heading, gone by the far margin), `beam` (a thread of both pen colours, used as a section seam), `rule-d` (the same in a section's own domain hue), and `guides` (vertical rails at the container edges, faded top and bottom).

Plus `aurora` — two very low-alpha out-of-focus blobs in the two pen colours behind the masthead, so the ground picks up a slow hue shift across the viewport instead of being one flat value. And `headline`, which sets display type as a vertical gradient via `background-clip: text`. Note: an element using `headline` must **not** also carry a `text-*` colour class, or the class overrides the clip and the gradient vanishes.

## Verification status — read this part

Honest accounting of what is and isn't confirmed.

**Confirmed green earlier in the session:** `tsc --noEmit` clean; `biome check --write .` clean across 50 files; `next build` completing all 26 routes; the served CSS containing every utility (97,085 bytes); HTTP 200 on `/`, `/blog`, and `/blog/attention-mechanism`.

**Not yet verified:** the final edges pass — the new utilities in `globals.css`, and the edits to `Newsletter.tsx`, `Footer.tsx`, and `post-list.tsx`. My shell has been unavailable for every attempt (a classifier outage, not a code problem), so I could not re-run the chain. Please run:

```
cd frontend
npx biome check --write .
npx tsc --noEmit
npx next build
```

I expect it clean — the edits are class-name and markup changes with no new imports or types — but I haven't proven it and I'm not going to claim I did.

**No screenshots.** There's no headless browser installed here (no Playwright, no Puppeteer), so I verified visually by reading the compiled CSS and the served HTML. Worth naming plainly, since both earlier rejections were based on how it looked and reading CSS is a weaker check than seeing the page.

## Two things needing your decision

**The remote database is still on the pre-redesign schema.** Post queries return `42703` (undefined column) and the `related_posts` RPC returns `PGRST202`, so `USE_FALLBACK = true` and every page serves `lib/dummy-posts.ts`. That's fine for judging the design — you said to use dummy data — but the migration `20260618121728_redesign_schema.sql` is unapplied and applying it to a live database is your call, not mine.

**A secret is behind a public environment variable name.** `frontend/.env` sets `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to a value starting `sb_secret_`. Next.js inlines anything prefixed `NEXT_PUBLIC_` into the client bundle, so that key is one import away from shipping to every browser. It hasn't leaked yet — 0 hits in `.next/static` — only because `lib/supabase/client.ts` is currently imported nowhere. I'd rotate the key and rename the variable without the `NEXT_PUBLIC_` prefix before anything touches the browser client. Reported, not acted on.

## If you want to reverse any of it

Everything is uncommitted working-tree state on `redesign/frontend`.

- One file back to `HEAD`: `git restore --source=HEAD -- frontend/path/to/file.tsx`
- The deleted block components back: `git restore --source=HEAD -- frontend/components/blocks frontend/types/content.ts`
- See a file as it was: `git show HEAD:frontend/components/blocks/block-renderer.tsx`

The changes I'd defend hardest are the token split, the body-transition fix, and the difficulty gauge. The one most reasonable to disagree with is collapsing the block registry — it's a real architectural opinion, and it's reversible with one command.

