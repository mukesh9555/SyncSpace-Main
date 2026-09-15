import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/notes', label: 'Notes', icon: '📝' },
  { to: '/editor', label: 'Code Editor', icon: '💻' },
  { to: '/whiteboard', label: 'Whiteboard', icon: '🎨' },
  { to: '/admin', label: 'Admin', icon: '⚙️' },
];

/**
 * Sidebar
 * `isOpen`/`onClose` control the mobile off-canvas drawer state,
 * lifted up to DashboardLayout so the Navbar's hamburger button
 * (a sibling, not a parent/child of Sidebar) can toggle it.
 */
export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.logo}>SyncSpace</div>
        <nav>
          <ul className={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `${styles.navLink} ${isActive ? styles.active : ''}`
                  }
                >
                  <span className={styles.icon}>{item.icon}</span>
                  <span className={styles.label}>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
