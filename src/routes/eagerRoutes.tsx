// Route elements for the SSR'd storefront paths. Used by BOTH the server route
// table (src/routes/ssrRoutes.tsx) and the client route table (AppRoutes), so
// the server render and the client's hydrating render are the same tree. The
// components are imported EAGERLY here: a lazy chunk suspends during hydration
// and React throws #421 (see d42299f0).
import type { ComponentType } from 'react';
import { useParams } from 'react-router-dom';
import NotFoundPage from '../pages/NotFoundPage';
import { CategoryPage, type CategoryPageProps } from '../pages/products/CategoryPage';
import { VividProductList } from '../themes/vivid/VividProductList';
import { useCategoryListing } from '../hooks/data/useCatalog';
import { IS_SERVER } from '../lib/ssr/preload';
import { useSetRenderStatus } from '../lib/ssr/renderStatus';
import { useTheme } from '../themes';

// Category listing component per theme. Theme ids outside this map fall back to classic.
const EAGER_CATEGORY: Record<string, ComponentType<CategoryPageProps>> = {
  classic: CategoryPage,
  vivid: (props: CategoryPageProps) => (
    <VividProductList mode="category" categorySlug={props.categorySlug} brandSlug={props.brandSlug} />
  ),
};

// /category/:slug and /category/:category/:brand. Unknown category, unknown or
// inactive brand, or an empty combo: NotFound with HTTP 404 (the bot renderer's
// rule). While the catalog is still loading on the server (no preload), throw so
// the edge serves the SPA shell instead of a "Loading" page.
export function CategoryRoute() {
  const { themeId } = useTheme();
  const params = useParams<{ slug?: string; category?: string; brand?: string }>();
  const setStatus = useSetRenderStatus();
  const brandSlug = params.brand;
  const categorySlug = brandSlug ? params.category : params.slug;
  const listing = useCategoryListing(categorySlug, brandSlug);

  if (listing.status === 'loading' && IS_SERVER) {
    throw new Error(`SSR category preload missing: ${categorySlug ?? ''}`);
  }
  if (listing.status === 'missing') {
    setStatus(404);
    return <NotFoundPage />;
  }
  const View = EAGER_CATEGORY[themeId] ?? CategoryPage;
  return <View categorySlug={categorySlug} brandSlug={brandSlug} />;
}
