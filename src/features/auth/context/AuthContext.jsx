import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../../shared/utils/api';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const result = await apiRequest('/api/v1/auth/me');
        if (!cancelled && result.success) {
          setUser(result.user);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkSession();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (credentials, register = false) => {
    const path = register ? '/api/v1/auth/register' : '/api/v1/auth/login';
    const result = await apiRequest(path, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Logout must succeed locally even if network is unavailable.
    }
    setUser(null);
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}
