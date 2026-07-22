import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from '../shared/layouts/DashboardLayout';

import Landing from '../features/landing/Landing';
import Login from '../features/auth/Login';
import Dashboard from '../features/dashboard/Dashboard';
import Notes from '../features/notes/Notes';
import Whiteboard from '../features/whiteboard/Whiteboard';

/**
 * AppRoutes — the single source of truth for the app's URL structure.
 *
 * Protected pages are now double-nested:
 *   ProtectedRoute   -> auth guard (redirects to /login if not authenticated)
 *     DashboardLayout -> renders Sidebar + Navbar ONCE
 *       Dashboard / Notes / Whiteboard -> swapped via <Outlet />
 */
export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      {/* Protected routes, sharing one persistent layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/whiteboard" element={<Whiteboard />} />
        </Route>
      </Route>
    </Routes>
  );
}
