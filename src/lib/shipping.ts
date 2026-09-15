// Shipping methods: admin-edited config (siteSettings.shippingConfig in
// Convex) merged over these defaults. Pure — no Convex imports, safe for
// themes, checkout, and admin alike. Money in RUPEES (as in catalog).

export interface ShippingMethod {
  id: 'standard' | 'express' | 'priority';
  enabled: boolean;
  priceRupees: number;
  label: string;
  eta: string;
}

export const DEFAULT_SHIPPING_METHODS: ShippingMethod[] = [
  { id: 'standard', enabled: true, priceRupees: 0, label: 'Standard Delivery', eta: '5-7 days' },
  { id: 'express', enabled: true, priceRupees: 99, label: 'Express Delivery', eta: '2-3 days' },
  { id: 'priority', enabled: true, priceRupees: 199, label: 'Priority Delivery', eta: '1 day' },
];

// shippingConfig shape: { standard?: {enabled, priceRupees, label, eta}, ... }
export function mergeShippingMethods(config: any): ShippingMethod[] {
  if (!config || typeof config !== 'object') return DEFAULT_SHIPPING_METHODS;
  return DEFAULT_SHIPPING_METHODS.map((d) => {
    const o = (config as any)[d.id];
    if (!o || typeof o !== 'object') return d;
    return {
      id: d.id,
      enabled: o.enabled ?? d.enabled,
      priceRupees: Number.isFinite(Number(o.priceRupees)) ? Number(o.priceRupees) : d.priceRupees,
      label: typeof o.label === 'string' && o.label.trim() ? o.label.trim() : d.label,
      eta: typeof o.eta === 'string' && o.eta.trim() ? o.eta.trim() : d.eta,
    };
  });
}

export function toShippingConfig(methods: ShippingMethod[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const m of methods) {
    out[m.id] = { enabled: m.enabled, priceRupees: m.priceRupees, label: m.label, eta: m.eta };
  }
  return out;
}
