# Deploying to Vercel

Tawasol is an Angular SSR app (Express server bundled via `ng build`, entry `src/server.ts`).
It deploys to Vercel as a single Node serverless function (`api/index.mjs`) that wraps that
bundled server — see `vercel.json` for the build/routing config.

## One-time setup (do this in the Vercel dashboard)

1. Push this repo to GitHub if it isn't there already.
2. On [vercel.com](https://vercel.com), **Add New… → Project**, then **Import** this GitHub
   repo. Vercel reads `vercel.json` from the repo, so you don't need to change any project
   settings (Framework Preset, Build Command, Output Directory) in the dashboard — leave them
   on their defaults.
3. **Environment variables**: none are required. The app's only external dependency,
   `API_BASE_URL` (`src/app/core/constants/api.ts`), points at the public Route Posts API
   (`https://route-posts.routemisr.com`) and is the same for every environment — dev, preview,
   and production — so it's intentionally left as a plain constant rather than a Vercel env
   var. Only add one later if a genuinely environment-specific value shows up (e.g. a real
   secret key, or a different backend per environment).
4. Click **Deploy**. The first deploy builds with `npm run build` (`ng build`) and publishes
   `dist/tawasol/browser` as static assets plus `dist/tawasol/server/server.mjs` as the SSR
   function.

Every subsequent push to the production branch redeploys automatically, and every pull
request gets its own preview URL, once the GitHub repo is linked.

## Allowed hosts — read this before adding a custom domain

`angular.json`'s `build.options.security.allowedHosts` is set to `["localhost", "*.vercel.app"]`.
This is an Angular SSR security check (see [preventing SSRF](https://angular.dev/best-practices/security#preventing-server-side-request-forgery-ssrf)):
without it, the server rejects every request's `Host` header that isn't explicitly allowed —
verified locally, the previous `allowedHosts: []` value in this file made the built SSR server
reject *every* request with a 400, including on `*.vercel.app`, which would have made the app
completely unreachable once deployed (it silently didn't matter before because `ng serve`'s
dev server doesn't go through this check — only the real built `server.mjs` does).

**If you add a custom domain in the Vercel dashboard**, add that exact domain (or a `*.`
wildcard for it) to this array in `angular.json` and redeploy — otherwise every request to the
custom domain will get a hard 400 from the SSR server while `*.vercel.app` keeps working fine.

## Verifying a deploy

Open the deployed URL and check:
- The page renders (SSR — view source should show real content in `<app-root>`, not an empty
  shell).
- Client-side navigation between routes works (e.g. log in, visit `/feed`).
- Both light and dark mode render correctly (the app follows the OS/browser color scheme).

## Local production-mode testing

`npm run build` then `npm run serve:ssr:tawasol` runs the same SSR server Vercel runs, on
`http://localhost:4000` — useful for reproducing a deploy issue locally without waiting on a
Vercel build.
