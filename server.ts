import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createApiApp } from "./src/apiApp";

// Traditional persistent Node server — used for local dev (`npm run dev`)
// and any non-Vercel host that supports a long-running process (Railway,
// Render, a VPS, etc). All the actual /api/* route logic lives in
// src/apiApp.ts and is shared with the Vercel serverless entrypoint at
// api/[...slug].ts, so the two hosting paths can never drift apart.
async function startServer() {
  const app = createApiApp();
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        // The service worker file itself must never be cached by the browser
        // or any CDN in front of this server - otherwise browsers keep using
        // an old sw.js and never discover new deployments, breaking the
        // "prompt to refresh on new version" behavior entirely.
        if (filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        // Some Express/mime-type versions don't know the manifest extension -
        // set it explicitly so Chrome/Edge reliably show the install prompt.
        if (filePath.endsWith('.webmanifest')) {
          res.setHeader('Content-Type', 'application/manifest+json');
        }
      },
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Extra safety net specifically for the static/SPA routes registered
  // just above (createApiApp() already installs its own error handler
  // covering every /api/* route).
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Unhandled Server Error]', req.method, req.path, err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unexpected server error.' });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EduNexa Analytics Server running on http://localhost:${PORT}`);
    console.log("Status: API Data Proxy Enabled. Compression Active.");
  });
}

startServer();
