'use client';

import { useEffect, useState } from 'react';

export function useTheme() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('tsm-dark-mode');
    if (stored === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark-theme');
    }
  }, []);

  const toggleDarkMode = (enabled: boolean) => {
    setDarkMode(enabled);
    localStorage.setItem('tsm-dark-mode', String(enabled));
    if (enabled) {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
  };

  return { darkMode, toggleDarkMode };
}
