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
  - Display/headings: `Cairo` (weight 700-800) — used with restraint, for brand name, page titles, section headings only
  - Body/UI text (bilingual AR/EN): `IBM Plex Sans Arabic` (weight 400-500) — this is the workhorse font for nearly everything
  - Data/utility (timestamps, counters, numeric metadata): `IBM Plex Mono` (weight 400-500)
- **Signature element:** An 8-point star shape (SVG) used as the "online/active" status indicator on avatars, replacing a generic colored dot. Reserve this shape for that one purpose — don't scatter it decoratively elsewhere.
- **Usage discipline:** Ember Clay accent is rare and intentional — if you're about to use it for a third or fourth time on the same screen, stop and use Harbor Teal or a neutral instead.
