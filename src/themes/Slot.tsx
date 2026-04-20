import { useTheme } from './ThemeContext';
import { getTheme, DEFAULT_THEME_ID } from './registry';
import type { ThemeSlotName } from './types';

interface SlotProps {
  name: ThemeSlotName;
  [prop: string]: unknown;
}

export function Slot({ name, ...rest }: SlotProps) {
  const { theme } = useTheme();
  const Component =
    theme.slots[name] || getTheme(DEFAULT_THEME_ID)?.slots[name];

  if (!Component) {
    if (import.meta.env.DEV) {
      console.warn(`[themes] No component registered for slot "${name}" in theme "${theme.id}"`);
    }
    return null;
  }

  return <Component {...rest} />;
}
