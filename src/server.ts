import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { brotliCompressSync, constants as zlib, gzipSync } from 'node:zlib';

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
 * Compression for the self-hosted server (`npm run serve:ssr:tawasol`, and the e2e and Lighthouse
 * CI jobs). Express has none built in, and without it every JS/CSS file goes out at full size
 * (~770 kB instead of ~210 kB of JS for the login page). On Vercel this is skipped: its edge
 * already compresses every response.
 */
const COMPRESS = !process.env['VERCEL'];
/** Text responses worth compressing; images and fonts are compressed formats already. */
const COMPRESSIBLE_FILE = /\.(?:js|css|json|html|svg|txt|webmanifest)$/;

type Encoding = 'br' | 'gzip';

function preferredEncoding(acceptEncoding: string | undefined): Encoding | null {
  if (/\bbr\b/.test(acceptEncoding ?? '')) return 'br';
  if (/\bgzip\b/.test(acceptEncoding ?? '')) return 'gzip';
  return null;
}

function compress(body: Buffer, encoding: Encoding): Buffer {
  return encoding === 'br'
    ? brotliCompressSync(body, { params: { [zlib.BROTLI_PARAM_QUALITY]: 11 } })
    : gzipSync(body, { level: 9 });
}

/** The build output never changes while the server runs, so each file is compressed only once. */
const compressedFiles = new Map<string, Buffer>();

if (COMPRESS) {
  app.use(async (req, res, next) => {
    const encoding = preferredEncoding(req.headers['accept-encoding']);
    if (
      (req.method !== 'GET' && req.method !== 'HEAD') ||
      !encoding ||
      !COMPRESSIBLE_FILE.test(req.path)
    ) {
      next();
      return;
    }
    const file = resolve(browserDistFolder, '.' + decodeURIComponent(req.path));
    if (!file.startsWith(browserDistFolder + sep)) {
      next();
      return;
    }
    const key = `${encoding}:${file}`;
    let body = compressedFiles.get(key);
    if (!body) {
      try {
        body = compress(await readFile(file), encoding);
      } catch {
        next(); // Not a file in the build output: let the routes below handle it.
        return;
      }
      compressedFiles.set(key, body);
    }
    res.type(extname(file));
    res.set({
      'Cache-Control': 'public, max-age=31536000',
      'Content-Encoding': encoding,
      Vary: 'Accept-Encoding',
    });
    res.send(body);
  });
}

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
    .then(async (response) => {
      if (!response) {
        next();
        return;
      }
      const encoding = COMPRESS ? preferredEncoding(req.headers['accept-encoding']) : null;
      if (
        encoding &&
        response.body &&
        response.headers.get('content-type')?.startsWith('text/html')
      ) {
        // Every route is client-rendered, so this is the small CSR shell: compress it whole.
        const headers = new Headers(response.headers);
        headers.set('Content-Encoding', encoding);
        headers.append('Vary', 'Accept-Encoding');
        headers.delete('Content-Length');
        const body = compress(Buffer.from(await response.arrayBuffer()), encoding);
        response = new Response(new Uint8Array(body), { status: response.status, headers });
      }
      await writeResponseToNodeResponse(response, res);
    })
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
