import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // We register manually via the `virtual:pwa-register/react` hook in
        // App.tsx so we can show our own "update available" prompt instead
        // of the plugin's default injected script.
        injectRegister: null,
        registerType: 'prompt',

        // -- Manifest --------------------------------------------------------
        manifest: {
          name: 'EduNexa Analytics',
          short_name: 'EduNexa',
          description: 'School management, analytics, and academic reporting for CBC schools.',
          theme_color: '#1e3a5f',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          icons: [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/pwa-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },

        // Extra public/ files referenced by index.html (favicon, apple touch
        // icon) that aren't in the manifest icons list above but should still
        // be treated as static assets.
        includeAssets: ['favicon.ico', 'favicon-32.png', 'favicon-64.png', 'apple-touch-icon.png'],

        // -- Service worker: static assets ONLY, never app/API data ----------
        workbox: {
          // Precache only the built static bundle + icons/fonts. This is an
          // SPA with a single index.html shell - no API responses, ever.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2,ttf,eot}'],

          // Belt-and-suspenders: explicitly force NetworkOnly for anything
          // that could ever look like app data, so it's never precached or
          // opportunistically runtime-cached even if globPatterns/scope ever
          // changes later. NetworkOnly = always hits the network; if there's
          // no network the request fails normally - no offline data, no
          // stale data, exactly as required.
          runtimeCaching: [
            {
              // Supabase REST / Auth / Storage / Realtime / RPC - all API traffic.
              urlPattern: ({url}) => url.hostname.endsWith('.supabase.co'),
              handler: 'NetworkOnly',
            },
            {
              // This app's own Express API (auth, subscription checks, etc.)
              urlPattern: ({url}) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
          ],
          navigateFallbackDenylist: [/^\/api\//],
        },

        devOptions: {
          // Keep the service worker OFF during local dev so it never
          // interferes with HMR or masks fresh-data bugs while developing.
          enabled: false,
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify: file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
