import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // The feed always depends on the signed-in user's token, which only ever lives in
  // localStorage (see AuthService) — there's no token to read at prerender/build time, nor
  // on the server for a live SSR request, so rendering it there always 401s. Render it
  // client-side only instead of prerendering or SSR-ing it.
  {
    path: 'feed',
    renderMode: RenderMode.Client,
  },
  // Same reasoning as '/feed' above, plus ':id' has no fixed set of values to prerender.
  {
    path: 'profile/:id',
    renderMode: RenderMode.Client,
  },
  // Same reasoning as '/feed' above.
  {
    path: 'bookmarks',
    renderMode: RenderMode.Client,
  },
  // Same reasoning as '/feed' above.
  {
    path: 'notifications',
    renderMode: RenderMode.Client,
  },
  // Same reasoning as '/feed' above. Every real route needs its own entry here: anything left
  // out silently falls through to the '**' catch-all below, which answers with a 404 status.
  // (Back when that catch-all prerendered, this route falling through to it baked authGuard's
  // no-token redirect to /auth/login into the static output.)
  {
    path: 'change-password',
    renderMode: RenderMode.Client,
  },
  // Same reasoning as '/change-password' above, plus ':id' has no fixed set of values to
  // prerender (same as '/profile/:id').
  {
    path: 'posts/:id',
    renderMode: RenderMode.Client,
  },
  // Navbar is rendered on every route (see app.html), and its bookmarks/profile/notifications
  // buttons are each conditional on AuthService.isAuthenticated()/user() — real, token-derived
  // state that's always false at prerender time (no token exists at build time) but can be
  // true on a real visitor's first paint if they already have a stored token. On a genuinely
  // static page that's just a value/text mismatch Angular quietly corrects post-hydration (see
  // LanguageService's own documented lang/dir tradeoff) — but these are whole elements
  // appearing/disappearing via @if, which is a structural mismatch: verified live, it throws a
  // hard `NG0500` during hydration on /auth/login for an already-signed-in visitor, and that
  // failure was severe enough to also break the login form's own submit handling on the same
  // page load (it fell back to a native, unintercepted form GET). Auth routes are exactly where
  // a signed-in user could land (stale bookmark, back button, the '' redirect below), so they
  // need the same treatment as every other auth-dependent route above, not just the ones that
  // 401 without a token.
  {
    path: 'auth/login',
    renderMode: RenderMode.Client,
  },
  {
    path: 'auth/register',
    renderMode: RenderMode.Client,
  },
  {
    path: '',
    renderMode: RenderMode.Client,
  },
  // '/auth' itself is just a redirect to '/auth/login' (auth.routes.ts). It needs its own entry
  // so it doesn't inherit the '**' route's 404 below — a redirect route may only carry a 3xx
  // status, and the build rejects it otherwise.
  {
    path: 'auth',
    renderMode: RenderMode.Client,
  },
  // Everything no route above matches is the app's own '**' NotFound page. Client-rendered for
  // the same navbar-hydration reason as the auth routes above (a signed-in visitor can land on
  // a bad URL too), and `status: 404` makes the server send a real 404 with the CSR shell
  // instead of a 200 — or, before this route existed, Express's bare "Cannot GET" page.
  {
    path: '**',
    renderMode: RenderMode.Client,
    status: 404,
  },
];
