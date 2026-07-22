import { useAuth } from '../../auth/context/AuthContext';
import styles from './ProfileWidget.module.css';

export default function ProfileWidget() {
  const { user } = useAuth();

  return (
    <div className={styles.card}>
      <div className={styles.avatar}>{user?.name?.[0]?.toUpperCase() ?? 'U'}</div>
      <h3 className={styles.name}>{user?.name ?? 'User'}</h3>
      <p className={styles.email}>{user?.email ?? '—'}</p>
      <div className={styles.divider} />
      <div className={styles.metaRow}>
        <span className={styles.metaLabel}>Member since</span>
        <span className={styles.metaValue}>
          {user?.loggedInAt ? new Date(user.loggedInAt).toLocaleDateString() : '—'}
        </span>
      </div>
    </div>
  );
}
