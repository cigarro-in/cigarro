import { useLocation } from 'react-router-dom';
import { SettingsManager } from '../features/SettingsManager';
import { settingsSectionFromPath } from '../features/settings/sections';

/** /settings and /settings/<section>. The section is read from the path. */
export function SettingsPage() {
  const { pathname } = useLocation();
  return <SettingsManager section={settingsSectionFromPath(pathname)} />;
}
