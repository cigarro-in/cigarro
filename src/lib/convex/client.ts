import { ConvexReactClient } from 'convex/react';

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    'Missing VITE_CONVEX_URL. Run `npx convex dev` to provision a deployment and copy its URL into .env.'
  );
}

export const convex = new ConvexReactClient(convexUrl);
