/**
 * Centralized LocalStorage adapter.
 *
 * WHY THIS FILE EXISTS:
 * Every feature (auth, notes) must persist data. Instead of scattering
 * `localStorage.getItem(...)` calls across components, we funnel ALL
 * reads/writes through this one module.
 *
 * This is the adapter/repository pattern: components depend on a stable
 * API (getItem/setItem/removeItem), not on *how* data is stored.
 * When a real backend arrives later, only the internals of these three
 * functions change (fetch/axios instead of window.localStorage) —
 * every component that calls them stays untouched.
 */

// Centralized key registry — avoids typo bugs like "syncspace_user" vs "syncSpace_User"
export const STORAGE_KEYS = {
  USER: 'syncspace_user',
  NOTES: 'syncspace_notes',
  THEME: 'syncspace_theme',
};

/**
 * Reads and JSON-parses a value from LocalStorage.
 * @param {string} key
 * @param {*} fallback - value to return if key doesn't exist or parsing fails
 */
export function getItem(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[localStorage] Failed to read key "${key}":`, error);
    return fallback;
  }
}

/**
 * JSON-stringifies and writes a value to LocalStorage.
 * @param {string} key
 * @param {*} value
 */
export function setItem(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[localStorage] Failed to write key "${key}":`, error);
    return false;
  }
}

/**
 * Removes a key from LocalStorage.
 * @param {string} key
 */
export function removeItem(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`[localStorage] Failed to remove key "${key}":`, error);
    return false;
  }
}
