import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// The app shell chunk (src/boot.tsx, loaded by src/main.tsx) starts downloading
// as soon as the HTML is parsed, not after main.js has run. Its CSS (and the CSS
// of the chunks it imports statically) is linked as a render-blocking stylesheet
// in <head>: injected by JS instead, the server-rendered page painted unstyled
// first (a flash of bare HTML and a full-page layout shift).
function bootModulePreload(): Plugin {
  return {
    name: 'boot-modulepreload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const boot = Object.values(ctx.bundle ?? {}).find(
          (c) => c.type === 'chunk' && c.name === 'boot',
        );
        if (!boot || boot.type !== 'chunk') return;
        const css = new Set<string>();
        const seen = new Set<string>();
        const visit = (fileName: string) => {
          if (seen.has(fileName)) return;
          seen.add(fileName);
          const chunk = ctx.bundle?.[fileName];
          if (!chunk || chunk.type !== 'chunk') return;
          chunk.viteMetadata?.importedCss.forEach((f) => css.add(f));
          chunk.imports.forEach(visit);
        };
        visit(boot.fileName);
        return [
          ...[...css].map((href) => ({ tag: 'link', attrs: { rel: 'stylesheet', href: `/${href}` }, injectTo: 'head' as const })),
          { tag: 'link', attrs: { rel: 'modulepreload', href: `/${boot.fileName}` }, injectTo: 'head' as const },
        ];
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    bootModulePreload(),
    VitePWA({
      // 'prompt': the app decides when to apply a new worker (see UpdateSW in
      // src/main.tsx). autoUpdate would reload mid-login.
      registerType: 'prompt',
      devOptions: {
        enabled: false // Disable in dev to avoid caching issues
      },
      includeAssets: [
        'icons/favicon.ico',
        'icons/apple-touch-icon.png',
        'icons/android-chrome-192x192.png',
        'icons/android-chrome-512x512.png'
      ],
      manifest: false, // Use manifest.json from public folder
      // Custom service worker (src/sw.js). Navigations are network-first and
      // cached per URL, and no precached index.html shell exists (it has no
      // edge-injected window.__ORG__, so it can name the wrong store).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        // Static assets plus the offline page only. index.html is not precached.
        globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}', 'offline.html'],
        // Don't cache images in precache (too large)
        globIgnores: ['**/assets/images/**'],
      },
    })
  ],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Radix dialog/dropdown are no longer forced into an eager chunk: they
        // ship with the (lazy) surfaces that use them.
        manualChunks: {
          vendor: ['react', 'react-dom'],
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true,
  },
});
