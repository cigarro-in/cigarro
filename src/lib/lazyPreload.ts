// React.lazy with a preload() that lets a component render without suspending.
//
// Why: a lazy component that suspends while the server markup hydrates leaves
// its Suspense boundary dehydrated; any update that reaches it before the chunk
// arrives makes React throw away the server HTML and client-render (React #421,
// a visible flash and a large layout shift). The client entry (src/boot.tsx)
// awaits preload() for the components the current route renders, then hydrates.
// Once loaded, the component renders the module directly, with no suspension.
//
// Not loaded yet (client navigation, SPA mount, the server render): it behaves
// exactly like React.lazy, so a Suspense boundary above it is still required.
import { createElement, lazy, useRef, type ComponentType } from 'react';

export type PreloadableComponent<P extends object> = ComponentType<P> & {
  preload: () => Promise<ComponentType<P>>;
};

export function lazyPreload<P extends object>(
  factory: () => Promise<ComponentType<P>>,
): PreloadableComponent<P> {
  let loaded: ComponentType<P> | undefined;
  let pending: Promise<ComponentType<P>> | undefined;

  const preload = () => {
    pending ??= factory().then(
      (component) => {
        loaded = component;
        return component;
      },
      (error: unknown) => {
        // Allow a later retry (network blip) instead of caching the failure.
        pending = undefined;
        throw error;
      },
    );
    return pending;
  };

  const Lazy = lazy(() => preload().then((component) => ({ default: component })));

  function Preloadable(props: P) {
    // Decided once per instance: switching element types later would remount.
    const direct = useRef(loaded).current;
    return createElement((direct ?? Lazy) as ComponentType<P>, props);
  }

  return Object.assign(Preloadable, { preload });
}

/** Calls preload() when the value is a preloadable component; no-op otherwise. */
export function preloadComponent(component: unknown): Promise<unknown> | undefined {
  const fn = (component as { preload?: () => Promise<unknown> } | null | undefined)?.preload;
  return typeof fn === 'function' ? fn() : undefined;
}
