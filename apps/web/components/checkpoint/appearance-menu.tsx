'use client';

import { useEffect, useState } from 'react';
import { Dropdown } from '../ui/dropdown';

const options = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function AppearanceMenu() {
  const [theme, setTheme] = useState('system');
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);
  return <Dropdown label="Appearance" value={theme} options={options} onValueChange={setTheme} />;
}
