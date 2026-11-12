// Server-rendered route table. Only the paths listed here are SSR'd (flag
// SSR_ROUTES on the edge; route table in src/entry-server.tsx). Components are
// imported EAGERLY: React.lazy inside a server render is not something the
// Worker build can rely on, and the SSR bundle is built with inlined dynamic
// imports anyway.
//
// Anything not listed renders nothing here; the edge keeps serving those paths
// through the SPA shell / bot renderer until they are ported (P5-SSR slice 8).
import type { ComponentType } from 'react';
import { Route, Routes, useParams } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { HomePage } from '../pages/home/HomePage';
import { VividHome } from '../themes/vivid/VividHome';
import ProductPage from '../pages/products/ProductPage';
import VividProduct from '../themes/vivid/VividProduct';
import NotFoundPage from '../pages/NotFoundPage';
import { useCatalogProduct } from '../hooks/data/useCatalog';
import { useSetRenderStatus } from '../lib/ssr/renderStatus';
import { useTheme } from '../themes';

// Eager home component per theme. Theme ids outside this map fall back to classic.
const EAGER_HOME: Record<string, ComponentType> = {
  classic: HomePage,
  vivid: VividHome,
};

// Eager product component per theme. A theme without an entry is not served
// from SSR (the route throws, and the edge falls back to the bot renderer / SPA).
const EAGER_PRODUCT: Record<string, ComponentType> = {
  classic: ProductPage,
  vivid: VividProduct,
};

function SsrHome() {
  const { themeId } = useTheme();
  const Home = EAGER_HOME[themeId] ?? HomePage;
  return <Home />;
}

function SsrProduct() {
  const { themeId } = useTheme();
  const { slug } = useParams<{ slug: string }>();
  const setStatus = useSetRenderStatus();
  const { product, loading } = useCatalogProduct(slug);
  // The preload is missing (query failed or timed out): we cannot tell whether
  // the product exists. Throw so the edge serves the bot/SPA path instead of
  // a "Loading" page or a wrong 404.
  if (loading) throw new Error(`SSR product preload missing: ${slug ?? ''}`);
  // Missing or inactive: the NotFound page with HTTP 404 (same as the bot renderer).
  if (!product || (product as { is_active?: boolean }).is_active === false) {
    setStatus(404);
    return <NotFoundPage />;
  }
  const Product = EAGER_PRODUCT[themeId];
  if (!Product) throw new Error(`No SSR product page for theme "${themeId}"`);
  return <Product />;
}

interface SsrRoutesProps {
  location?: unknown;
}

export function SsrRoutes({ location }: SsrRoutesProps) {
  return (
    <Routes location={location as never}>
      <Route path={ROUTES.HOME} element={<SsrHome />} />
      <Route path={ROUTES.PRODUCT_DETAIL} element={<SsrProduct />} />
      <Route path="*" element={null} />
    </Routes>
  );
}
