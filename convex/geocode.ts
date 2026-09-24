import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireIdentity } from "./lib/auth";

// Server-side reverse geocoding (Phase 5). Browsers calling Nominatim
// directly hit CORS/rate-limit/identification issues, so the client sends
// coords here and this action identifies properly (User-Agent + Referer
// per Nominatim policy) and returns only the address fields the form needs.
// Authenticated users only — verified via an internal query because actions
// can't use requireIdentity directly.

export const checkAuth = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    return { ok: true as const };
  },
});

// Nominatim usage policy (https://operations.osmfoundation.org/policies/nominatim/):
// absolute max 1 req/sec per application, identifying UA/Referer,
// attribution, results cached. This action is user-tap-only (never
// polled, bulk, or autocomplete) and switches service-side without a client
// update.
//
// App-wide reservation: before any upstream call the action runs
// reserveNominatimSlot, an internal mutation that reads the singleton
// geocodeUpstreamSlots row (key "nominatim") and rewrites lastReservedAt in
// the SAME transaction. Convex runs each mutation as an optimistic-
// concurrency (OCC) transaction: concurrent reservations all read the same
// row version, exactly one commits, the losers fail OCC validation and are
// transparently retried — on retry they read the winner's fresh timestamp,
// see the 1100ms window is still covered, and throw GEOCODE_RATE_LIMITED.
// So at most one upstream call per window wins across ALL isolates/tabs.
// A busy loser fails fast with GEOCODE_RATE_LIMITED, which the existing
// useCurrentLocation catch-all already maps to its manual-entry message —
// never a silent queue, never a per-isolate sleep claimed as compliance.
const NOMINATIM_MIN_GAP_MS = 1100;
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const GEOCODE_CACHE_MAX = 500;
// Per-isolate read-through cache only (coord-rounded). It reduces upstream
// calls but is NOT the rate limiter — the durable reservation above is.
const geocodeCache = new Map<string, { at: number; value: unknown }>();

function geocodeCacheKey(lat: number, lon: number): string {
  // ~11m cells: repeat taps from the same spot hit cache, distinct
  // addresses still resolve. Exact coords go upstream on a miss.
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

export const reserveNominatimSlot = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("geocodeUpstreamSlots")
      .withIndex("by_key", (q) => q.eq("key", "nominatim"))
      .unique();
    if (existing && now - existing.lastReservedAt < NOMINATIM_MIN_GAP_MS) {
      throw new ConvexError({ code: "GEOCODE_RATE_LIMITED" });
    }
    if (existing) {
      await ctx.db.patch(existing._id, { lastReservedAt: now });
    } else {
      await ctx.db.insert("geocodeUpstreamSlots", {
        key: "nominatim",
        lastReservedAt: now,
      });
    }
    return { ok: true as const };
  },
});

export const reverse = action({
  args: { lat: v.number(), lon: v.number() },
  handler: async (ctx, { lat, lon }): Promise<any> => {
    await ctx.runQuery(internal.geocode.checkAuth, {});
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      throw new ConvexError({ code: "BAD_COORDS" });
    }
    const key = geocodeCacheKey(lat, lon);
    const cached = geocodeCache.get(key);
    if (cached && Date.now() - cached.at < GEOCODE_CACHE_TTL_MS) return cached.value;
    // Atomic app-wide reservation. Throws GEOCODE_RATE_LIMITED when a
    // concurrent caller already holds this second's slot.
    await ctx.runMutation(internal.geocode.reserveNominatimSlot, {});
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=json` +
      `&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=en`;
    let data: any = null;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "CigarroStore/1.0 (https://cigarro.in)",
          Referer: "https://cigarro.in/",
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error(`nominatim ${res.status}`);
      data = await res.json().catch(() => null);
    } catch {
      throw new ConvexError({ code: "GEOCODE_FAILED" });
    }
    const addr = data?.address ?? null;
    if (!addr) throw new ConvexError({ code: "GEOCODE_EMPTY" });
    const parts = [
      addr.house_number,
      addr.building,
      addr.road,
      addr.suburb,
      addr.neighbourhood,
    ].filter(Boolean);
    const value = {
      address: parts.join(", "),
      pincode: typeof addr.postcode === "string" ? addr.postcode : "",
      city: addr.city ?? addr.town ?? addr.village ?? addr.county ?? "",
      state: addr.state ?? "",
      country: "India",
      attribution: "© OpenStreetMap contributors",
    };
    if (geocodeCache.size >= GEOCODE_CACHE_MAX) {
      const oldest = geocodeCache.keys().next();
      if (!oldest.done) geocodeCache.delete(oldest.value);
    }
    geocodeCache.set(key, { at: Date.now(), value });
    return value;
  },
});
