import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import styles from './DashboardLayout.module.css';

/**
 * DashboardLayout
 * Nested route wrapper for /dashboard, /notes, /whiteboard.
 * Sidebar + Navbar render exactly once; only <Outlet /> content swaps
 * between the three pages. Sidebar's mobile-drawer open state lives
 * here (not inside Sidebar) because Navbar's hamburger button needs
 * to control it too — lifted to their common parent.
 */
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={styles.main}>
        <Navbar onMenuClick={() => setSidebarOpen((prev) => !prev)} />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
