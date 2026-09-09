/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * One config, two build targets.
 *
 * VITE_APP_TARGET is substituted as a string literal at build time, so
 * `import.meta.env.VITE_APP_TARGET === 'kiosk'` collapses to a constant and
 * Rollup eliminates the dead branch. That is what keeps staff code out of the
 * tablet bundle: it is removed by the bundler, not merely lazy-loaded.
 */
/**
 * Vendor chunks for the staff build only.
 *
 * Vite 8 bundles with Rolldown, where `manualChunks` takes a function rather
 * than a name-to-packages map. Matching on the module path keeps the mapping
 * readable without depending on the resolved package graph.
 *
 * The kiosk build is deliberately left unsplit. It is small enough that extra
 * requests cost more than they save, and its service worker precaches the whole
 * shell anyway.
 */
const STAFF_CHUNKS: ReadonlyArray<readonly [chunk: string, match: RegExp]> = [
  ['vendor-charts', /node_modules\/(@ant-design\/(charts|plots|graphs)|@antv)\//],
  ['vendor-antd', /node_modules\/(antd|@ant-design|rc-[a-z-]+)\//],
  ['vendor-supabase', /node_modules\/@supabase\//],
  ['vendor-react', /node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//],
];

function staffManualChunks(id: string): string | undefined {
  for (const [chunk, match] of STAFF_CHUNKS) {
    if (match.test(id)) return chunk;
  }
  return undefined;
}

/**
 * The kiosk's service worker.
 *
 * Only the kiosk gets one. The staff app is used on managed machines with a
 * network, and a service worker there would only add a stale-cache failure
 * mode. It also matters that the two are separate origins: a service worker's
 * scope is its origin, so one shared origin would cache staff code onto a
 * tablet sitting unattended in a lobby.
 *
 * registerType is 'prompt', not 'autoUpdate'. An automatic update reloads the
 * page as soon as a new build lands, which on a kiosk means reloading in the
 * middle of somebody's check-in. The app applies the update only while it is
 * sitting on the idle screen.
 */
function kioskPwa() {
  return VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
    manifest: {
      name: 'زوار — نظام إدارة الزوار',
      short_name: 'زوار',
      description: 'Visitor check-in kiosk',
      lang: 'ar',
      dir: 'rtl',
      start_url: '/',
      scope: '/',
      display: 'fullscreen',
      orientation: 'landscape',
      background_color: '#f0f4f8',
      theme_color: '#007297',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // The shell, so a reload with no network still renders rather than
      // showing a blank screen.
      globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
      navigateFallback: '/index.html',
      // Never let the service worker answer for the API. A cached check-in
      // response would be a lie: the offline depth agreed for this deployment
      // is a cached shell with writes that require the network and fail loudly.
      navigateFallbackDenylist: [/^\/api\//],
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      runtimeCaching: [
        {
          // The company picker, so it is never blank on a slow start. Revalidated
          // in the background, and explicitly not used for writes.
          urlPattern: /\/api\/kiosk\/directory$/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'kiosk-directory',
            expiration: { maxEntries: 1, maxAgeSeconds: 24 * 60 * 60 },
          },
        },
      ],
    },
  });
}

export default defineConfig(() => {
  const target = process.env.VITE_APP_TARGET ?? 'staff';

  return {
    plugins: [react(), ...(target === 'kiosk' ? [kioskPwa()] : [])],
    server: { host: true },
    build: {
      // Never ship source maps to production; the staff app talks to Supabase
      // directly and readable sources make that surface easier to probe.
      sourcemap: false,
      ...(target === 'kiosk'
        ? {}
        : { rollupOptions: { output: { manualChunks: staffManualChunks } } }),
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  };
});
