// Server-only stand-in for 'convex/react', aliased in vite.ssr.config.ts.
//
// The server render has no Convex client: data comes only from the
// request-scoped preload map (usePreloadedOrLive). Every live hook here
// reports "not loaded" (undefined) and every mutation is inert, so components
// render their loading state for anything the preload did not cover. Nothing
// here opens a socket or touches the network.
import type { ReactNode } from 'react';

export class ConvexReactClient {
  constructor(_address?: string, _options?: unknown) {}
  setAuth(): void {}
  clearAuth(): void {}
  close(): Promise<void> { return Promise.resolve(); }
}

export function useQuery(_fn: unknown, _args?: unknown): undefined {
  return undefined;
}

export function usePaginatedQuery(_fn: unknown, _args?: unknown, _opts?: unknown) {
  return { results: [], status: 'LoadingFirstPage' as const, isLoading: true, loadMore: () => false, loadMoreStatus: undefined };
}

export function useMutation(_fn: unknown): (...args: unknown[]) => Promise<never> {
  return () => Promise.reject(new Error('Convex mutations are unavailable during server render'));
}

export function useAction(_fn: unknown): (...args: unknown[]) => Promise<never> {
  return () => Promise.reject(new Error('Convex actions are unavailable during server render'));
}

const inertClient = {
  query: () => Promise.reject(new Error('Convex is unavailable during server render')),
  mutation: () => Promise.reject(new Error('Convex is unavailable during server render')),
  action: () => Promise.reject(new Error('Convex is unavailable during server render')),
  setAuth: () => {},
  clearAuth: () => {},
};

export function useConvex(): typeof inertClient {
  return inertClient;
}

export function useConvexAuth(): { isLoading: boolean; isAuthenticated: boolean } {
  return { isLoading: false, isAuthenticated: false };
}

export function ConvexProvider({ children }: { client?: unknown; children?: ReactNode }) {
  return <>{children}</>;
}

export function ConvexProviderWithAuth({ children }: { client?: unknown; useAuth?: unknown; children?: ReactNode }) {
  return <>{children}</>;
}

export function Authenticated({ children }: { children?: ReactNode }) {
  return null;
}

export function Unauthenticated({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function AuthLoading(_props: { children?: ReactNode }) {
  return null;
}
