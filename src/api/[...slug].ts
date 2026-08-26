import { createApiApp } from "../src/apiApp";

// Vercel convention: any file under /api becomes a serverless function.
// The [...slug] bracket syntax makes this a catch-all for every path under
// /api/* (e.g. /api/admin/create-teacher, /api/proxy/write, etc.) — Express
// itself still does the actual route matching internally via req.url,
// exactly as it does in the traditional server (see server.ts). Exporting
// the Express app directly as the default export is Vercel's documented
// pattern for using Express as a serverless function: Vercel invokes it as
// a plain (req, res) handler, which an Express app already is.
const app = createApiApp();
export default app;
