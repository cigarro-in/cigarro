// Hub page head model (/products, /categories, /brands, /blogs). Bot parity:
// functions/ssr-middleware.js staticPageDefs and hubContent (titles, descriptions,
// ItemList names). Pure: no browser or Convex access, so server and client agree.

export type HubPath = '/products' | '/categories' | '/brands' | '/blogs';

export interface HubSeo {
  title: string;
  description: string;
  /** Last breadcrumb label (bot renderer's crumb). */
  crumb: string;
  /** ItemList JSON-LD name (bot renderer's list name). */
  listName: string;
}

export function hubSeo(path: HubPath, siteName: string): HubSeo {
  switch (path) {
    case '/products':
      return {
        title: `All Cigarettes and Tobacco Products | ${siteName}`,
        description: `Browse the current ${siteName} catalogue by product, brand, variant, pack option, price and availability.`,
        crumb: 'Products',
        listName: `All products at ${siteName}`,
      };
    case '/categories':
      return {
        title: `Cigarette and Tobacco Product Categories | ${siteName}`,
        description: `Browse cigarettes, rolling papers, filter tips and other available products by category at ${siteName}.`,
        crumb: 'Categories',
        listName: 'Cigarette and tobacco categories',
      };
    case '/brands':
      return {
        title: `Cigarette and Tobacco Brands | ${siteName}`,
        description: `Browse the cigarette, cigar and rolling accessory brands currently listed in the ${siteName} catalogue.`,
        crumb: 'Brands',
        listName: 'Cigarette and tobacco brands',
      };
    case '/blogs':
      return {
        title: `Cigarette Brand and Product Guides | ${siteName}`,
        description: `Read ${siteName} guides to cigarette brands, variants, pack formats and related tobacco products.`,
        crumb: 'Guides',
        listName: 'Cigarette brand and product guides',
      };
  }
}

export interface HubListItem {
  name: string;
  url: string;
}

/** ItemList JSON-LD for the rows the page shows, in the same order. */
export function hubItemListJsonLd(name: string, items: HubListItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
}
