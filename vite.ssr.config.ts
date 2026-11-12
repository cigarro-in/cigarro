// Server bundle for the home-route SSR (P5-SSR slice 6). Built by `npm run build:ssr`
// into functions/_ssr/entry-server.js and imported by functions/ssr-render.js.
//
// Differences from vite.config.ts (client):
//  - no PWA plugin, no code splitting: one self-contained file for the Worker
//  - convex/react -> server shim (no client, data comes from the preload map)
//  - admin/super-admin apps stubbed out (never rendered by the storefront SSR)
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

const SHIM = path.resolve(__dirname, './src/lib/ssr/convexReactShim.tsx');

// Modules that must never enter the storefront server bundle. Each is replaced
// by a stub with the same named exports; the admin apps are never reached by
// a storefront path (AdminRouter/StorePicker/SaApp are lazy or host-gated).
const STUBS: Record<string, string> = {
  'src/adminnew/AdminRouter': 'export const AdminRouter = () => null;',
  'src/adminnew/StorePicker': 'export const StorePicker = () => null;',
  'src/sa/SaApp': 'export const SaApp = () => null;',
};

function stubExcludedModules(): Plugin {
  return {
    name: 'ssr-stub-excluded-modules',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (source.startsWith('\0')) return null;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (!resolved || resolved.external) return null;
      const file = resolved.id.split(path.sep).join('/');
      for (const key of Object.keys(STUBS)) {
        if (file.endsWith(`/${key}.tsx`) || file.endsWith(`/${key}.ts`)) return `\0stub:${key}`;
      }
      return null;
    },
    load(id) {
      if (!id.startsWith('\0stub:')) return null;
      return STUBS[id.slice('\0stub:'.length)] ?? 'export default {};';
    },
  };
}

export default defineConfig({
  plugins: [react(), stubExcludedModules()],
  // The server bundle is code only: public/ belongs to the static shell.
  publicDir: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: [
      { find: /^convex\/react$/, replacement: SHIM },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  ssr: {
    noExternal: true,
    target: 'webworker',
  },
  build: {
    ssr: 'src/entry-server.tsx',
    outDir: 'functions/_ssr',
    emptyOutDir: true,
    target: 'esnext',
    minify: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        format: 'es',
        inlineDynamicImports: true,
        entryFileNames: 'entry-server.js',
      },
    },
  },
});
