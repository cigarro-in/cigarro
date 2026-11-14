// What each store theme's home page renders, in the order it renders it.
// Classic: src/pages/home/HomePage.tsx. Vivid: src/themes/vivid/VividHome.tsx.
// The editor shows only the controls the active theme actually uses.

export type HomepageSectionKey =
  | 'hero_section'
  | 'categories_section'
  | 'featured_products'
  | 'product_showcase'
  | 'brands_section'
  | 'blog_section';

export interface HomepageSectionDef {
  key: HomepageSectionKey;
  label: string;
  /** One plain sentence: what the shopper sees in this block. */
  description: string;
  /** The theme shows this section's heading from the admin. */
  hasHeading: boolean;
  /** The section can be driven by a Collection (title and products follow it). */
  collectionLink: boolean;
}

const CLASSIC: HomepageSectionDef[] = [
  {
    key: 'hero_section',
    label: 'Hero slides',
    description: 'Large banners at the top of the page. Shown in the order you set.',
    hasHeading: false,
    collectionLink: false,
  },
  {
    key: 'categories_section',
    label: 'Categories',
    description: 'A category strip, a showcase for each category, and a category grid.',
    hasHeading: true,
    collectionLink: false,
  },
  {
    key: 'featured_products',
    label: 'Featured products',
    description: 'A row of products. Shows the latest products or one of your collections.',
    hasHeading: true,
    collectionLink: true,
  },
  {
    key: 'brands_section',
    label: 'Brands',
    description: 'A strip of brand logos.',
    hasHeading: true,
    collectionLink: false,
  },
  {
    key: 'product_showcase',
    label: 'Product showcase',
    description: 'A highlighted block of products from a collection.',
    hasHeading: true,
    collectionLink: true,
  },
  {
    key: 'blog_section',
    label: 'Blog',
    description: 'The latest blog posts.',
    hasHeading: true,
    collectionLink: false,
  },
];

const VIVID: HomepageSectionDef[] = [
  {
    key: 'hero_section',
    label: 'Hero slides',
    description: 'Banners at the top of the page. Shown in the order you set.',
    hasHeading: false,
    collectionLink: false,
  },
  {
    key: 'featured_products',
    label: 'Featured products',
    description: 'A product row. Shows the latest products or one of your collections.',
    hasHeading: true,
    collectionLink: true,
  },
  {
    key: 'product_showcase',
    label: 'Product showcase',
    description: 'A highlighted block of products from a collection.',
    hasHeading: true,
    collectionLink: true,
  },
  {
    key: 'categories_section',
    label: 'Categories',
    description: 'One product row per category, plus the category sidebar. Each row takes its name from the category.',
    hasHeading: false,
    collectionLink: false,
  },
  {
    key: 'brands_section',
    label: 'Brands',
    description: 'A strip of brand logos.',
    hasHeading: true,
    collectionLink: false,
  },
  {
    key: 'blog_section',
    label: 'Blog',
    description: 'The latest blog posts.',
    hasHeading: true,
    collectionLink: false,
  },
];

export function homepageSectionsFor(themeId: string): HomepageSectionDef[] {
  return themeId === 'vivid' ? VIVID : CLASSIC;
}

export function sectionDef(themeId: string, key: string): HomepageSectionDef | undefined {
  return homepageSectionsFor(themeId).find((s) => s.key === key);
}
