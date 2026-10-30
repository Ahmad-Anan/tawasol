import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/** The build's content-hashed output, e.g. main-5JZI24JY.js, chunk-Ds05UiY1.js, styles-UJ7R3HY6.css. */
const HASHED_ASSET = /[\\/](?:main|chunk|styles)-[A-Za-z0-9_-]{8}\.(?:js|css)$/;

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
    setHeaders: (res, path) => {
      // On Vercel every request goes through this function (vercel.json), and when a function sends
      // only Cache-Control, Vercel's CDN consumes it and the browser gets "max-age=0,
      // must-revalidate". Adding Vercel-CDN-Cache-Control makes Vercel forward Cache-Control
      // unchanged (https://vercel.com/docs/caching/cache-control-headers#behavior). Only for the
      // content-hashed build output: a new build gives those new names, so they never go stale.
      if (HASHED_ASSET.test(path)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Vercel-CDN-Cache-Control', 'max-age=31536000');
      }
    },
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
