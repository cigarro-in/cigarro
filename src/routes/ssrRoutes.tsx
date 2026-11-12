// Server-rendered route table. Only the paths listed here are SSR'd (flag
// SSR_ROUTES on the edge). Components are imported EAGERLY: React.lazy inside
// a server render is not something the Worker build can rely on, and the SSR
// bundle is built with inlined dynamic imports anyway.
//
// Anything not listed renders nothing here; the edge keeps serving those paths
// through the SPA shell / bot renderer until they are ported (P5-SSR slice 8).
import type { ComponentType } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { HomePage } from '../pages/home/HomePage';
import { VividHome } from '../themes/vivid/VividHome';
import { useTheme } from '../themes';

// Eager home component per theme. Theme ids outside this map fall back to classic.
const EAGER_HOME: Record<string, ComponentType> = {
  classic: HomePage,
  vivid: VividHome,
};

function SsrHome() {
  const { themeId } = useTheme();
  const Home = EAGER_HOME[themeId] ?? HomePage;
  return <Home />;
}

interface SsrRoutesProps {
  location?: unknown;
}

export function SsrRoutes({ location }: SsrRoutesProps) {
  return (
    <Routes location={location as never}>
      <Route path={ROUTES.HOME} element={<SsrHome />} />
      <Route path="*" element={null} />
    </Routes>
  );
}
