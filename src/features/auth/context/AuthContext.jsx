import { createContext, useContext, useState, useEffect } from 'react';
import { getItem, setItem, removeItem, STORAGE_KEYS } from '../../../shared/utils/localStorage';
import { apiRequest } from '../../../shared/utils/api';

/**
 * AuthContext
 *
 * This is intentionally the ONLY Context in Phase 1.
 * Rationale: user identity is needed by unrelated parts of the tree
 * simultaneously (Navbar, Sidebar, ProfileCard, ProtectedRoute, Login).
 * That "3+ unrelated consumers" rule is exactly when Context earns its cost.
 *
 * Notes/Whiteboard state do NOT live here — they stay local to their
 * own features (see project architecture notes).
 */
const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // On first mount, check LocalStorage for a previously "remembered" user.
  // This is what makes a refresh (F5) keep the user logged in.
  useEffect(() => {
    const savedUser = getItem(STORAGE_KEYS.USER, null);
    if (savedUser) {
      setUser(savedUser);
    }
    setIsLoading(false);
  }, []);

  /**
   * Simulated login (no backend yet).
   * In Phase 1, "authentication" just means: validate the form locally,
   * then persist a fake user object. There is no password verification
   * against a real database — that arrives with the backend phase.
   */
  async function login(credentials, register = false) {
    const result = await apiRequest(register ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    const userData = { ...result.user, loggedInAt: new Date().toISOString() };
    setItem(STORAGE_KEYS.USER, userData);
    setUser(userData);
    return userData;
  }

  async function logout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // A local logout must still succeed if the network is unavailable.
    }
    removeItem(STORAGE_KEYS.USER);
    setUser(null);
  }

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth — the idiomatic consumption hook.
 * Components should NEVER call useContext(AuthContext) directly;
 * they call useAuth() instead. This lets us throw a clear error if
 * someone forgets to wrap the app in <AuthProvider>, and keeps the
 * import surface clean (one hook, not context + useContext everywhere).
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}
