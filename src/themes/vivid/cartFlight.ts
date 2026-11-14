import { useRef, useSyncExternalStore } from 'react';
import { prefersReducedMotion, spawnFlyingImage } from '../../lib/cart/flyingImage';

/**
 * Vivid's add-to-cart feedback: a copy of the product image flies from the add
 * button to the cart icon, and the badge only counts it up when the copy lands.
 * Desktop targets the header cart; the phone targets the centre bottom-bar cart.
 * Reduced motion skips the flight, and the count updates straight away.
 */

const FLIGHT_MS = 650;
const THUMB_PX = 56;

let inFlight = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function getInFlight() {
  return inFlight;
}

/** The cart icon that is actually on screen (the other breakpoint's copy is display:none). */
function findVisibleCartTarget(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>('[data-cart-target]');
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * Starts the flight from the add button's rect. Call it in the click handler,
 * alongside the cart update, so the count is held until the copy lands.
 */
export function flyProductToCart(imageUrl: string, from: DOMRect): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;
  const target = findVisibleCartTarget();
  if (!target) return;

  const startX = from.left + from.width / 2 - THUMB_PX / 2;
  const startY = from.top + from.height / 2 - THUMB_PX / 2;
  const tr = target.getBoundingClientRect();
  const dx = tr.left + tr.width / 2 - (startX + THUMB_PX / 2);
  const dy = tr.top + tr.height / 2 - (startY + THUMB_PX / 2);

  const el = spawnFlyingImage({
    imageUrl,
    left: startX,
    top: startY,
    width: THUMB_PX,
    height: THUMB_PX,
    style: {
      borderRadius: '12px',
      border: '2px solid #ffffff',
      boxShadow: '0 8px 24px rgba(15,15,18,0.22)',
    },
  });

  inFlight += 1;
  emit();
  const anim = el.animate(
    [
      { transform: 'translate3d(0,0,0) scale(1)', opacity: 1, offset: 0 },
      // Arc: rises first, then drops into the cart.
      { transform: `translate3d(${dx * 0.45}px, ${dy * 0.45 - 56}px, 0) scale(0.85)`, opacity: 1, offset: 0.45 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.25)`, opacity: 0.4, offset: 1 },
    ],
    { duration: FLIGHT_MS, easing: 'cubic-bezier(0.3, 0.6, 0.2, 1)', fill: 'forwards' },
  );

  let settled = false;
  const land = () => {
    if (settled) return;
    settled = true;
    el.remove();
    inFlight = Math.max(0, inFlight - 1);
    emit();
  };
  anim.onfinish = land;
  anim.oncancel = land;
}

/**
 * The count to show on a cart badge. While a flight is in progress it keeps the
 * previous value, so the number changes (and bumps) when the product lands.
 */
export function useLandedCartCount(total: number): number {
  const flying = useSyncExternalStore(subscribe, getInFlight, getInFlight) > 0;
  const held = useRef(total);
  if (!flying) held.current = total;
  return flying ? held.current : total;
}
