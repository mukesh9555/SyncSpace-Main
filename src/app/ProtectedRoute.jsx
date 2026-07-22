import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/context/AuthContext';

/**
 * ProtectedRoute
 *
 * Used as a parent/wrapper route in AppRoutes.jsx:
 *
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *   </Route>
 *
 * If the user is not authenticated, we redirect to /login.
 * `replace` avoids polluting browser history with the redirect step
 * (so the back button doesn't bounce the user between the protected
 * page and /login).
 *
 * We intentionally do NOT sprinkle this check inside every page
 * component — keeping it here means the routing table itself
 * documents which routes are protected.
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  // Avoid a flash-redirect to /login while we're still reading
  // LocalStorage on first mount.
  if (isLoading) {
    return null; // Could be replaced with a spinner later
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
