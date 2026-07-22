import { useAuth } from '../../features/auth/context/AuthContext';
import { useTheme } from '../../features/theme/ThemeContext';
import { useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className={styles.navbar}>
      <button
        className={styles.menuBtn}
        onClick={onMenuClick}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      <div className={styles.spacer} />

      <button
        className={styles.themeBtn}
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      <div className={styles.userMenu}>
        <span className={styles.avatar}>{user?.name?.[0]?.toUpperCase() ?? 'U'}</span>
        <span className={styles.userName}>{user?.name ?? 'User'}</span>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
