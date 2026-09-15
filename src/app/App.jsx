import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth/context/AuthContext';
import { ThemeProvider } from '../features/theme/ThemeContext';
import { PresenceProvider } from '../features/presence/PresenceContext';
import AppRoutes from './AppRoutes';

/**
 * App — the composition root.
 *
 * This file's ONLY job is to wire together global providers.
 * It contains no feature-specific logic or markup — that belongs
 * inside features/*. Keeping this file "boring" is intentional:
 * it should almost never need to change as the app grows.
 */
export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PresenceProvider>
            <AppRoutes />
          </PresenceProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
