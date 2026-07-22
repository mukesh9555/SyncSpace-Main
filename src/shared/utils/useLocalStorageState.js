import { useState, useEffect } from 'react';
import { getItem, setItem } from './localStorage';

/**
 * useLocalStorageState
 *
 * Combines useState + our localStorage adapter into one hook.
 * Used by ThemeContext (theme: 'light' | 'dark') and Notes (notes array)
 * so both features persist automatically without duplicating
 * "read on mount, write on change" boilerplate.
 *
 * @param {string} key - STORAGE_KEYS entry
 * @param {*} initialValue - fallback if nothing saved yet
 */
export function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => getItem(key, initialValue));

  useEffect(() => {
    setItem(key, value);
  }, [key, value]);

  return [value, setValue];
}
