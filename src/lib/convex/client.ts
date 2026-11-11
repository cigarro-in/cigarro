import { ConvexReactClient } from 'convex/react';
import { reportCrash } from '../crashReporting';

export const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    'Missing VITE_CONVEX_URL. Run `npx convex dev` to provision a deployment and copy its URL into .env.'
  );
}

export const convex = new ConvexReactClient(convexUrl, {
  logger: {
    logVerbose: () => {},
    log: (...args: unknown[]) => console.log(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => {
      console.error(...args);
      // The SDK includes the function name and server stack in this string.
      const message = args.filter(arg => typeof arg === 'string').join(' ');
      reportCrash(message || 'Convex client error', { source: 'convex', operation: 'convex-client' });
    },
  },
});
