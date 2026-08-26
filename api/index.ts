/**
 * Vercel Serverless Function entrypoint.
 *
 * Vercel looks for files inside /api at the project root.
 * This single catch-all file handles every /api/* request by
 * delegating to the shared Express app defined in src/apiApp.ts.
 *
 * The previous location (src/api/[...slug].ts) was inside src/
 * which Vercel does NOT scan for serverless functions — only the
 * top-level /api/ directory is scanned.
 */
import { createApiApp } from '../src/apiApp';

const app = createApiApp();

// Vercel invokes serverless functions as plain (req, res) handlers.
// An Express app already IS a (req, res) handler, so we export it directly.
export default app;
