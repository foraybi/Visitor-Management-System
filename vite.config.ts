/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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

export default defineConfig(() => {
  const target = process.env.VITE_APP_TARGET ?? 'staff';

  return {
    plugins: [react()],
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
