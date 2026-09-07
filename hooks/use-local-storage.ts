'use client';

import { useEffect, useState } from 'react';

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setValue(JSON.parse(saved) as T);
    } catch { /* ignore */ }
  }, [key]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* ignore */ }
  }, [key, value]);

  const clear = () => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    setValue(initial);
  };

  return [value, setValue, clear] as const;
}
