# Motion parts (stageshow copies)

`Roll` and `Collapse` are third-party code copied from the stageshow kit. They are MIT licensed; the full notice is in [`LICENSE`](./LICENSE) next to this file and must stay with every copy.

## Source

| Item | Value |
| --- | --- |
| Project | stageshow (Copyright (c) 2026 Benji Taylor) |
| License | MIT, copied verbatim from the kit's `LICENSE` |
| Kit version | `package.json` `0.1.0` (skill metadata `1.1.1`) |
| Copied on | 2026-11-12 |
| Kit path | `~/.omp/agent/skills/stageshow/kit/` |

| Copy | Original | Original SHA-256 |
| --- | --- | --- |
| `Roll.tsx` | `kit/motion/Roll.tsx` | `8c265a336111a939c946c8dc8e43d3b70474d26abc1ed8baca7e6c13808ac10e` |
| `Roll.css` | `kit/motion/Roll.css` | `0e55390fa9984a1dbad543dff66405abc39acae04b78e4366deea34f286bb29a` |
| `Collapse.tsx` | `kit/motion/Collapse.tsx` | `fea3a7dc6ac5da0b3d1a4709dc1a1aa97da65c1e7da35895c59fa7c143a6bb5e` |
| `Collapse.css` | `kit/motion/Collapse.css` | `2a2c985bb71a8518390c65fd3392827871625d6dd72e67649fee20b2175ff703` |
| `reduced-motion.ts` | `kit/reduced-motion.ts` | `9f8926f18ce0489f2c4073d7041c82ee3b6cfb6c16ecd75aea3ef76c43581113` |
| `LICENSE` | `LICENSE` (skill root) | `f9420246652580af24aa2bc48531c17f0f377b064bc7ea218afeb983923ef643` |

## Changes from the original

| File | Change | Why |
| --- | --- | --- |
| `Roll.tsx` | `'../reduced-motion'` → `'./reduced-motion'`. Removed `import './Roll.css'` | Flat folder. CSS is imported only from `src/index.css` so the `stageshow` layer order is fixed there |
| `Roll.css` | None | — |
| `Collapse.tsx` | Removed `import './Collapse.css'`. Added `useReducedMotion()`: when it is true, the layout effect skips the `moving` mark and the 900 ms closing hold and releases at once | Without a transition there is no `transitionend`, so closed content stayed on screen for 900 ms (jsdom and OS reduced motion) |
| `Collapse.css` | Appended, inside `@layer stageshow`, `@media (prefers-reduced-motion: reduce)` setting `transition: none !important` on `.ss-collapse`, `.ss-collapse__inner`, `.ss-collapse__glide` | The original transitions ignore reduced motion; the existing rules are more specific, so the override needs `!important` |
| `reduced-motion.ts` | None | — |
| `index.ts` | New file. Re-exports `Roll` and `Collapse` | — |

The source files keep the original formatting so they can be compared with the kit line by line.

## How the app uses them

- CSS: `src/index.css` declares `@layer theme, base, stageshow, components, utilities;` first and then imports `Roll.css` and `Collapse.css`. Kit rules beat Tailwind preflight and lose to utilities.
- `src/queue/QueueStatus.tsx`: a `role="status"` region holds one `sr-only` plain-text copy and one `aria-hidden` `<Roll>`; the visible line opens with `<Collapse>`.
- Every `<Collapse>` receives `null` children when closed, so closed regions hold no text.
- The mask colour `#000` in `Roll.css` is an alpha value for `mask-image`, not a colour token (`DESIGN.md` 4.13).
