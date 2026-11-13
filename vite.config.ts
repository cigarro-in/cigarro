import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// The app shell chunk (src/boot.tsx, loaded by src/main.tsx) starts downloading
// as soon as the HTML is parsed, not after main.js has run.
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
        if (!boot) return;
        return [{ tag: 'link', attrs: { rel: 'modulepreload', href: `/${boot.fileName}` }, injectTo: 'head' }];
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
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true,
  },
});
