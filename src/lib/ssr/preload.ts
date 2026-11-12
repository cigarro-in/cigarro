import { useQuery } from 'convex/react';
import { getFunctionName, type FunctionArgs, type FunctionReference, type FunctionReturnType } from 'convex/server';
import { useContext } from 'react';
import { PreloadContext } from './PreloadContext';

// Preloaded query results for server-rendered storefront pages.
//
// Registry shape: `${fnName}:${stableJSON(args)}` -> decoded JSON value (the
// `value` field of Convex's HTTP `/api/query` response). Plain JSON, not
// Convex's `Preloaded` payload: `usePreloadedQuery` needs a ConvexProvider
// mounted (the server has none) and double-encodes values as strings.
//
// Client: `window.__PRELOAD__` (written by serializePreload in the SSR shell).
// Server: a request-scoped map passed to <PreloadProvider>.

export type PreloadMap = Record<string, unknown>;

declare global {
  interface Window {
    __PRELOAD__?: PreloadMap;
  }
}

export const IS_SERVER = typeof window === 'undefined';

// Deterministic JSON: sorted object keys, undefined/function/symbol object
// members dropped, array holes and undefined elements become null (matches
// JSON.stringify), toJSON honoured (Dates).
export function stableJSON(value: unknown): string {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return 'null';
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  const withToJSON = value as { toJSON?: () => unknown };
  if (typeof withToJSON.toJSON === 'function') {
    return stableJSON(withToJSON.toJSON());
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJSON(v)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => {
      const v = record[k];
      return v !== undefined && typeof v !== 'function' && typeof v !== 'symbol';
    })
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJSON(record[k])}`).join(',')}}`;
}

export function preloadKey(fnName: string, args: unknown): string {
  return `${fnName}:${stableJSON(args ?? {})}`;
}

function lookup(
  map: PreloadMap | null | undefined,
  fnRef: FunctionReference<'query'>,
  args: unknown,
): { found: true; value: unknown } | { found: false } {
  if (!map) return { found: false };
  const key = preloadKey(getFunctionName(fnRef), args);
  if (!Object.prototype.hasOwnProperty.call(map, key)) return { found: false };
  return { found: true, value: map[key] };
}

function clientPreloadMap(contextMap: PreloadMap | null): PreloadMap | null {
  if (contextMap) return contextMap;
  try {
    return typeof window !== 'undefined' ? (window.__PRELOAD__ ?? null) : null;
  } catch {
    return null;
  }
}

// Client branch. Calls useQuery unconditionally. While the live result is
// undefined, serves the preloaded value (null is a real preloaded value).
// Once live arrives, live wins. 'skip' never serves preloaded data.
function usePreloadedClient<Query extends FunctionReference<'query'>>(
  fnRef: Query,
  args: FunctionArgs<Query> | 'skip',
): FunctionReturnType<Query> | undefined {
  const ctx = useContext(PreloadContext);
  const live = useQuery(fnRef, args as FunctionArgs<Query>);
  if (live !== undefined) return live;
  if (args === 'skip') return undefined;
  const hit = lookup(clientPreloadMap(ctx.map), fnRef, args);
  return hit.found ? (hit.value as FunctionReturnType<Query>) : undefined;
}

// Server branch. No ConvexProvider exists on the server, so useQuery is never
// called; the request-scoped map is the only source.
function usePreloadedServer<Query extends FunctionReference<'query'>>(
  fnRef: Query,
  args: FunctionArgs<Query> | 'skip',
): FunctionReturnType<Query> | undefined {
  const ctx = useContext(PreloadContext);
  if (args === 'skip') return undefined;
  const hit = lookup(ctx.map, fnRef, args);
  return hit.found ? (hit.value as FunctionReturnType<Query>) : undefined;
}

// Selected once per environment, so the hook calls a component makes are the
// same in every render (both branches call useContext exactly once).
export const usePreloadedOrLive: typeof usePreloadedClient = IS_SERVER
  ? usePreloadedServer
  : usePreloadedClient;
