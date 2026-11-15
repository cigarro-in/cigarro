import { useCallback } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

// Single shared location path (Phase 5). Every address surface uses this —
// no direct Nominatim fetches from components. Runs only on explicit user
// tap (never loops permission prompts); manual entry always stays available.
export interface LocatedAddress {
  address: string;
  pincode: string;
  city: string;
  state: string;
  country: string;
}

export interface LocatedCoords {
  lat: number;
  lon: number;
}

export type LocateResult =
  | { ok: true; value: LocatedAddress; coords: LocatedCoords }
  | { ok: false; message: string };

const ERRORS = {
  unsupported: 'Location services aren’t supported on this device — type your address manually.',
  denied:
    'Location permission denied — allow access in your browser’s site settings and try again, or type your address manually.',
  unavailable: 'Location unavailable right now — type your address manually.',
  timeout: 'Location request timed out — try again, or type your address manually.',
  geocode: 'Found your position but couldn’t look up the address — type it manually.',
};

export function useCurrentLocation() {
  const reverse = useAction(api.geocode.reverse);

  // ponytail: single promise chain, no state machine in the hook; callers
  // own their spinner + inline error region.
  const locate = useCallback(async (): Promise<LocateResult> => {
    if (!('geolocation' in navigator)) return { ok: false, message: ERRORS.unsupported };
    let pos: GeolocationPosition;
    try {
      pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000,
        });
      });
    } catch (e: any) {
      const code = (e as GeolocationPositionError | undefined)?.code;
      if (code === 1) return { ok: false, message: ERRORS.denied };
      if (code === 2) return { ok: false, message: ERRORS.unavailable };
      if (code === 3) return { ok: false, message: ERRORS.timeout };
      return { ok: false, message: ERRORS.unavailable };
    }
    try {
      const value = (await reverse({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      })) as LocatedAddress;
      // Device fix travels with the address so callers persist real coords
      // (never 0,0) — geolocation fixes are always finite here, but guard
      // anyway so a bad fix can never poison a saved address.
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lon))
        return { ok: false, message: ERRORS.unavailable };
      return { ok: true, value, coords: { lat, lon } };
    } catch {
      return { ok: false, message: ERRORS.geocode };
    }
  }, [reverse]);

  return { locate };
}
