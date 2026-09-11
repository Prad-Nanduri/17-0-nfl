'use client';

import { Dropdown } from '../ui/dropdown';
import { useAppearance } from '../ui/provider';

const options = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function AppearanceMenu() {
  const { theme, setTheme } = useAppearance();
  return <Dropdown label="Appearance" value={theme} options={options} onValueChange={setTheme} />;
}
