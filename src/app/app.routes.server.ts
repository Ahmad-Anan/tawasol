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
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
