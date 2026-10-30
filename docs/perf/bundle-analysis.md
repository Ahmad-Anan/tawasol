# Bundle and critical-path analysis (2026-10-30)

Measured on `main` at `34fa24b`. No app code was changed for this report.

**How it was measured**
- Bundle contents: `ng build --source-map` into a scratch folder (the real `dist/` was untouched), then
  `npx source-map-explorer` on every browser chunk. The chunk graph comes from each chunk's static
  `import … from "./chunk-…"` and dynamic ``import(`./chunk-…`)`` statements.
- Gzip figures are `zlib` level 9 on the built files. "Transfer" figures are what Vercel production
  (`tawasol-two.vercel.app`, deployed from the same commit) actually sent with Brotli.
- Critical path: Chromium through Playwright with the CDP network log, cache disabled, and the Route
  Posts API aborted.
- Lighthouse: `@lhci/cli@0.15.1` (Lighthouse 12.6.1), mobile preset, 5 runs, median.

## 1. What is in the biggest chunks

The build output labels `chunk-CGTlZ_lA.js` "lazy", but **it is not**. `main` imports it
statically, and the SSR server adds a `modulepreload` for it to every page. The real initial
JavaScript is therefore `main` + `chunk-CGTlZ_lA`: **533.5 kB raw / 155.1 kB gzip**, not the
94 kB / 22 kB the build summary suggests. (The current `initial` budget doesn't see it either.)

| Chunk | Raw | Gzip | Loaded by | Contents (raw, from source maps) |
|---|---|---|---|---|
| `chunk-CGTlZ_lA` (framework) | 438.2 kB | 129.2 kB | every page (static import from `main`) | `@angular/core` 173.4, `@angular/router` 76.5, rxjs 20.9, `@angular/common` 16.7 (+ http), `@ngx-translate/core` 15.0, `@angular/platform-browser` 11.6, CDK a11y + focus monitor + list key manager 20.5, Material ripple/icon/icon registry/icon-button 24.4 |
| `chunk-BDxOFD_X` (forms + inputs) | 108.7 kB | 24.8 kB | auth, feed, profile, bookmarks, change password, post | `@angular/forms` (incl. `signals`) ~36, Material form field 20.4, Material input 7.2, CDK text-field/observers 2.9 |
| `main` | 95.3 kB | 25.9 kB | every page | **CDK overlay 33.2, Material menu 17.7**, CDK portal 5.5, CDK scrolling 5.1, **Material badge 4.3**; app shell (navbar, services, a11y, i18n, RouteScroll) ~16 |
| `chunk-CLd6UbSG` (post/comment UI) | 84.6 kB | 20.7 kB | feed, profile, bookmarks, post | post card, comments, posts/comments services ~51, **Material dialog 12.4 + CDK dialog 10.4**, lightbox, status indicator |
| `chunk-DznJ9Htx` (auth route) | 83.2 kB | 18.5 kB | `/auth/*` | **Material tabs 30.8**, auth feature 15.7, **Material radio 10.1** (register only) |
| `chunk-Csfb6oQ8` (classic forms core) | 41.7 kB | 10.5 kB | every route except `/**` | `@angular/forms` model/validators/`NgControl` (pulled in by Signal Forms' NgControl interop and by `MatInput`), Material progress spinner 4.2 |
| `chunk-C4fSzw0F` | 27.3 kB | 5.9 kB | feed, notifications | Material button toggle 11.3 |

Everything else is under 17 kB raw per chunk (the per-route feature code).

### What each route loads

| Route | Adds on top of the initial 155.1 kB gzip | Page total (gzip) |
|---|---|---|
| `/auth/login`, `/auth/register` | 240.1 kB raw / **56.4 kB** | **211.5 kB** |
| `/feed` | 291.7 kB raw / 72.7 kB | 227.8 kB |
| `/profile/:id` | 264.0 kB raw / 65.8 kB | 221.0 kB |
| `/bookmarks` | 242.3 kB raw / 59.4 kB | 214.6 kB |
| `/posts/:id` | 237.5 kB raw / 57.5 kB | 212.7 kB |
| `/change-password` | 160.0 kB raw / 39.4 kB | 194.5 kB |
| `/notifications` | 80.8 kB raw / 21.0 kB | 176.1 kB |
| `**` (404) | 1.4 kB raw / 0.9 kB | 130.1 kB |

## 2. Critical path of `/auth/login` (the first screen for visitors)

Vercel production, steady state (no cold start), in request order:

| Start | Request | Transfer (br) | Decoded | Why |
|---|---|---|---|---|
| 0 ms | `GET /auth/login` (CSR shell, served by the SSR function) | 5.7 kB | 30.9 kB | Includes ~29.6 kB of inlined `<style>`: critical CSS **plus Google Fonts' CSS, inlined at build time** (37 `@font-face` rules: Cairo 700/800, IBM Plex Sans/Arabic/Mono 400/500, Material Icons) |
| +~430 ms (one RTT, all parallel via `modulepreload`) | `main` | 27.3 kB | 95.1 kB | app shell |
| | `chunk-CGTlZ_lA` | 134.6 kB | 438.1 kB | framework |
| | `chunk-Ds05UiY1` (auth route) | 19.9 kB | 83.1 kB | |
| | `chunk-BDxOFD_X` | 26.3 kB | 108.6 kB | |
| | `chunk-Csfb6oQ8` | 11.3 kB | 41.6 kB | |
| | 2 small chunks | 2.9 kB | 6.2 kB | |
| | `styles.css` (non-blocking: `media="print"` + `onload`) | 7.6 kB | 38.7 kB | |
| | `IBM Plex Sans` latin woff2 (fonts.gstatic.com) | 45.2 kB | 44.6 kB | the body text font, referenced by the critical CSS |
| after bootstrap (+~180 ms) | **12** `/i18n/<feature>/en.json` files | 7.8 kB | 11.3 kB | the loader fetches every feature's file before the first translated render |
| after first render | `Cairo 700` latin woff2 | 33.2 kB | 33.0 kB | the brand name |
| after first render | **`Material Icons` woff2** | **125.5 kB** | 125.3 kB | **for exactly one glyph**: the theme toggle's `dark_mode` (the only `mat-icon` on the page) |
| | **Total** | **447.5 kB / 24 requests** | | |

Order of the critical path: HTML → (parallel) JS + body font → bootstrap → i18n JSON → first render
(LCP) → brand and icon fonts.

Lighthouse (mobile, production, median of 5):

| Page | Perf | A11y | Best practices | SEO | FCP | LCP | TBT |
|---|---|---|---|---|---|---|---|
| `/auth/login` | **0.89** | 1 | 1 | **0.9** | 2.0 s | 3.3 s | 180 ms |
| `/auth/register` | **0.73** (0.68–0.90) | 1 | 1 | **0.9** | 2.0 s | 4.3 s | 410 ms |

- **LCP** is a text node: the first form label on login, a hint on register. Its time is all
  "render delay" (2.2–3.6 s) after a ~630 ms TTFB: download and run the JS, fetch the
  translations, render.
- **Failing audits:** `meta-description` (the only SEO loss), `font-display` (the inlined Material Icons `@font-face` has no
  `font-display`, so the browser blocks its text while the font loads), `unused-javascript` (36–49 KiB, all in the framework chunk).
- **Lighthouse against the local Express server** (`node dist/tawasol/server/server.mjs`, the
  server the e2e job uses) scores **0.56–0.63**. `server.ts` has no compression, and Lighthouse
  reports "Enable text compression: est. 623 KiB". Vercel compresses at its edge, so that number
  says nothing about production. This matters for the Lighthouse CI task (see §3, item 7).
- **Repeat visits:** hashed `*.js`/`*.css` come back from Vercel with
  `Cache-Control: public, max-age=0, must-revalidate`. `vercel.json` rewrites every path to the
  `/api` function, so the CDN never applies a long cache to them, despite `express.static`'s
  `maxAge: '1y'`. Every repeat visit revalidates every file.

## 3. Proposed changes, with expected savings

| # | Change | Expected effect | Notes |
|---|---|---|---|
| 1 | Render the theme toggle's `dark_mode` / `light_mode` as inline SVG (the same Material glyph paths) instead of the icon font | **−125.5 kB transfer (−28%) on login/register**; fixes the `font-display` audit there | No visual change. Signed-in pages still use the font for their other icons. |
| 2 | `@defer` the navbar's signed-in-only parts (notifications badge button, account menu) behind `isAuthenticated()` | **~66 kB raw / ~16 kB gzip** off `main` (CDK overlay, Material menu, portal, scrolling, badge) for signed-out visitors | Signed-in pages get them from a shared chunk. Must not cause a layout shift (reserve the space) or break the e2e/axe flows. |
| 3 | Lazy-load the dialogs (likes, suggested friends, lightbox, unfollow confirm) with dynamic `import()` on open | ~23 kB raw / ~6 kB gzip (Material + CDK dialog) off feed/profile/post/bookmarks | Small; only worth it if the dialog code really leaves those chunks. |
| 4 | Add a `<meta name="description">` | SEO 0.9 → 1.0 on both pages | Tiny. |
| 5 | Long, immutable cache for hashed assets in `vercel.json` `headers` | Repeat visits reuse the cached files without asking; today each of the ~10 same-origin files is a conditional request answered `304` | Can only be checked on a Vercel preview. |
| 6 | Fetch fewer translation files before the first render | One fewer RTT on the LCP path, at most | Needs an i18n loader change; unclear benefit. Measure before deciding. |
| 7 | (Lighthouse CI) Serve compressed responses from `server.ts` with Node's built-in `zlib` (no new dependency) | Local Lighthouse ≈ production numbers instead of ~0.6 | On Vercel the edge already compresses. |
| — | Split vendor code further | **Rejected:** the framework chunk is what every route needs (core, router, common, i18n, CDK a11y for RouteFocus); nothing large in it is single-route. | |
| — | Replace the icon font with Material Symbols (`icon_names=` subsetting) | **Rejected:** different glyph design, which is a visual change. | |
| — | Serve the CSR shell statically instead of through the function (TTFB ~630 ms) | Out of scope: changes the deployment architecture (the `**` 404 status needs the server). | |
