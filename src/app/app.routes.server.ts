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
  // Same reasoning as '/feed' above — authGuard would otherwise see no token at prerender
  // time (this route would silently fall through to the '**' catch-all below, which
  // prerenders) and bake a server-side redirect to /auth/login into the static output.
  {
    path: 'change-password',
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
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
