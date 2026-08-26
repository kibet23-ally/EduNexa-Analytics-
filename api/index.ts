/**
 * Vercel Serverless Function entrypoint.
 *
 * Vercel looks for files inside /api at the project root.
 * This single catch-all file handles every /api/* request by
 * delegating to the shared Express app defined in src/apiApp.ts.
 */
import { createApiApp } from '../src/apiApp';

const app = createApiApp();

// Vercel invokes serverless functions as plain (req, res) handlers. An
// Express app already IS such a handler, so app(req, res) normally does
// everything needed - but it's wrapped here in its own try/catch as a
// last-resort outer boundary. createApiApp() already guarantees every
// /api/* route returns valid JSON on error; this catches the rarer case
// of a crash happening at the point of invoking Express itself (e.g. a
// bundling/runtime mismatch), which would otherwise surface as a raw,
// non-JSON platform error page instead of a usable error message.
export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err) {
    console.error('[Vercel Function Crash]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unexpected server crash.' });
    }
  }
}
