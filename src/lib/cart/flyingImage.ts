/**
 * DOM helper for the "product drop" effect: a small copy of a product image is
 * placed in the viewport at the add button's position, and animated towards
 * the cart icon by the caller. Theme-agnostic: classic and vivid pass their
 * own size, shape and styling. Only the element is created here, so the
 * caller owns the animation and the cleanup.
 */
export interface FlyingImageOptions {
  imageUrl: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Extra inline styles (shape, outline, shadow). Applied last. */
  style?: Partial<Record<'borderRadius' | 'backgroundColor' | 'outline' | 'boxShadow' | 'border', string>>;
}

export function spawnFlyingImage(opts: FlyingImageOptions): HTMLDivElement {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = `${opts.left}px`;
  el.style.top = `${opts.top}px`;
  el.style.width = `${opts.width}px`;
  el.style.height = `${opts.height}px`;
  el.style.backgroundImage = `url("${opts.imageUrl.replace(/"/g, '%22')}")`;
  el.style.backgroundSize = 'cover';
  el.style.backgroundPosition = 'center';
  el.style.zIndex = '2147483647';
  el.style.transform = 'translate3d(0,0,0)';
  el.style.pointerEvents = 'none'; // clicks pass through
  el.setAttribute('aria-hidden', 'true');
  if (opts.style) Object.assign(el.style, opts.style);
  document.body.appendChild(el);
  return el;
}

/** True when the user asked for reduced motion. Safe on the server (returns false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
