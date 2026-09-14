You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection

## Visual Identity (finalized)

- **Design concept:** "Harbor & connection" — professional trust with a subtle nod to Islamic geometric precision (an 8-point star used as the signature status/active indicator instead of a plain dot). NOT the KingMart "quiet luxury/royal" identity — no gold, no Cinzel, no royal-950 tokens from that project.
- **Colors:**
  - `--color-harbor-950: #10302C` — deep teal-ink, used for nav/header backgrounds and primary text
  - `--color-harbor-600: #146B63` — primary interactive color (links, buttons, active states, avatar placeholder fill)
  - `--color-ember-600: #C1592E` — accent color, used SPARINGLY (max 3-4 places: notification badge, one primary CTA) — never as a general-purpose color
  - `--color-bone-100: #F5F3EC` — warm off-white, page background
  - `--color-surface: #FFFFFF` — card/surface background
- **Typography:**
  - Display/headings: `Cairo` (weight 700-800) — used with restraint, for brand name, page titles, section headings only. Cairo is a dual-script (Arabic/Latin) typeface, so it stays constant across languages.
  - Body/UI text — the workhorse for nearly everything — is direction-aware: `IBM Plex Sans Arabic` (weight 400-500) for Arabic, `IBM Plex Sans` (weight 400-500) for English. See ## Internationalization (i18n) below for how and why these swap.
  - Data/utility (timestamps, counters, numeric metadata): `IBM Plex Mono` (weight 400-500)
- **Signature element:** An 8-point star shape (SVG) used as the "online/active" status indicator on avatars, replacing a generic colored dot. Reserve this shape for that one purpose — don't scatter it decoratively elsewhere.
- **Usage discipline:** Ember Clay accent is rare and intentional — if you're about to use it for a third or fourth time on the same screen, stop and use Harbor Teal or a neutral instead.

## Internationalization (i18n)

- **Library: `@ngx-translate/core` (v18) + `@ngx-translate/http-loader` (v18).** Evaluated against Transloco; chose ngx-translate v18 because it's a ground-up rebuild on Angular signals — `currentLang`/`fallbackLang` are signals, the `TranslateService.translate()` method and the standalone `translate()` function both return `Signal<Translation>`, and the maintainers' own v18 changelog states it is "built and tested against Angular 18/19/20/21/22" with a standalone-first setup (`TranslateModule` is gone; use `provideTranslateService()`). Transloco is still actively maintained but its signal support is a single added utility (`translateSignal`) bolted onto an otherwise Observable-first API, not a rebuilt reactive core — a weaker match for this app's zoneless/signals-first architecture. Don't take this as a permanently settled choice if re-evaluating later — re-check both libraries' current docs/changelogs the way this decision did, rather than assuming either has stayed the same.
- **Default language is English/LTR.** A first-time visitor (no `tawasol-lang` in `localStorage`) always gets English — there is no `navigator.language`/`Accept-Language` auto-detection, unlike `ThemeService`'s `prefers-color-scheme` fallback. This is a deliberate difference, not an oversight.
- **Translation files are organized per-feature, one JSON per language, under `public/i18n/<feature>/<lang>.json`** (e.g. `public/i18n/navbar/en.json`, `public/i18n/auth/ar.json`) — `public/` (not `src/assets/`) is this project's actual static-assets root per `angular.json`, and it's served at the app's origin root (e.g. `/i18n/auth/en.json`), not under `/assets/`. Each feature is wired into `provideTranslateHttpLoader({ resources: [...] })` in `app.config.ts` as its own `{ prefix, suffix }` entry; the loader deep-merges every resource, so keys are namespaced under a per-feature top-level key (`navbar.*`, `auth.*`) to avoid collisions. **When adding a new feature that needs translations:** create `public/i18n/<feature>/{en,ar}.json`, add one `{ prefix: '/i18n/<feature>/', suffix: '.json' }` entry to the `resources` array in `app.config.ts`, and namespace its keys under `<feature>.*`.
- **`LanguageService`** lives in `core/services/language.ts`, next to `ThemeService` (`core/services/theme.ts`), and mirrors its pattern closely:
  - A `@Service()`-decorated singleton exposing reactive state (`lang`, `dir` — both `computed()`, derived from `TranslateService.currentLang`) plus a `toggle()`/`setLanguage()` API.
  - Persists the choice to `localStorage` under its own key, `tawasol-lang` — deliberately separate from `tawasol-theme` (ThemeService) and `tawasol-token` (AuthService), guarded by the same `isPlatformBrowser` check ThemeService uses.
  - Applies its state to the document synchronously via an `effect()` (setting `<html lang>` and `<html dir>` together, never just one) instead of ThemeService's `startViewTransition`-based apply — a directional RTL/LTR layout mirror doesn't suit a view-transition animation the way a color-scheme crossfade does.
  - A standalone `resolveInitialLanguage()` function (not a class member) reads the same `tawasol-lang` key and is reused in two other places that run before/outside the `LanguageService` instance: the anti-flicker script in `index.html`, and `provideTranslateService({ lang: resolveInitialLanguage(), ... })` in `app.config.ts`. All three must keep reading the same key so they never disagree about the initial language.
- **Anti-flicker script in `index.html`** was extended (not duplicated) — the existing dark-mode IIFE now also reads `tawasol-lang` and sets `document.documentElement.lang`/`dir` before any stylesheet loads, so there's no flash of the wrong language or direction on load. The static fallback `<html lang="en" dir="ltr">` covers the no-JS case, consistent with "default is English/LTR."
- **Known SSR/localStorage tradeoff:** `resolveInitialLanguage()` can only read `localStorage` in the browser — on the server it always resolves to `'en'` (same asymmetry `AuthService`'s token check already has). A returning visitor with Arabic saved will get an English SSR payload that the client then corrects to Arabic on hydration, which Angular handles by re-rendering the mismatched content rather than erroring, but it does mean that one navigation isn't fully hydration-optimized. Fixing this properly would mean reading the language from a cookie the server can see too — out of scope for this pass; flag it if SSR performance for returning Arabic users becomes a real concern.
- **Fonts swap by direction, not by a JS class.** `material-theme.scss` sets Material's `plain-family` theme option to `IBM Plex Sans` (English is the default), and an `html[dir='rtl']` rule overrides the individual `--mat-sys-*-font` custom properties (body/label/title-medium/title-small) to `IBM Plex Sans Arabic` — Angular Material's own component styles read those split `-font` tokens (confirmed by inspecting the compiled component CSS), not the compile-time shorthand tokens like `--mat-sys-body-medium`, so this override reaches Material's buttons/inputs/tabs too, not just hand-written templates. The app's own `--font-body` CSS variable follows the same `html[dir='rtl']` pattern for non-Material text. `Cairo` (the brand/display font) is *not* direction-scoped — it's a dual-script Arabic/Latin typeface by design, so it's used unchanged in both languages. `IBM Plex Sans` was chosen for the English body font specifically because it's the Latin sibling of `IBM Plex Sans Arabic` in the same IBM Plex superfamily (same designer, matching x-height/weights/proportions), so the two swap without a jarring change in weight or character.
- **API error messages are not translated.** `Login`/`Register`'s `extractErrorMessage()` shows `err.error.message` from the live API verbatim — the API has no locale negotiation and only ever replies in English (e.g. "incorrect email or password"). Only the app's own fallback string (used when the API gives no message at all) is localized. This is called out with a comment at each `extractErrorMessage()` site so it isn't mistaken for an oversight later.
- **Signal Forms validator messages are functions, not strings**, e.g. `required(p.login, { message: () => this.translate.translate('auth.login.errors.loginRequired')() as string })`. A plain string would be captured once at form-construction time and never update when the language changes; a function is re-evaluated inside the field's reactive graph, and calling the signal-returning `translate()` inside it registers the dependency, so error messages already on screen re-translate live when the user toggles language. `TranslateService` is injected once in the component constructor and reused inside these closures — calling the *standalone* `translate()` function (as opposed to the injected `TranslateService.translate()` instance method) from inside a validator throws `NG0203`, because validators run later, outside any Angular injection context.
