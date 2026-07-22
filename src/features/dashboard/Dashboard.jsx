import { useAuth } from '../auth/context/AuthContext';
import StatCard from './components/StatCard';
import ActivityTimeline from './components/ActivityTimeline';
import ProfileWidget from './components/ProfileWidget';
import RecentNotes from './components/RecentNotes';
import RecentRooms from './components/RecentRooms';
import { getItem, STORAGE_KEYS } from '../../shared/utils/localStorage';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { user } = useAuth();
  const notesCount = getItem(STORAGE_KEYS.NOTES, []).length;

  return (
    <div className={styles.page}>
      <h1 className={styles.welcome}>Welcome back, {user?.name ?? 'there'} 👋</h1>
      <p className={styles.subtitle}>Here's what's happening in your workspace.</p>

      <div className={styles.statsGrid}>
        <StatCard label="Total Notes" value={notesCount} icon="📝" trend="+2 today" />
        <StatCard label="Active Rooms" value="3" icon="🧩" />
        <StatCard label="Whiteboards" value="5" icon="🎨" />
        <StatCard label="Hours Active" value="18h" icon="⏱️" trend="+4h" />
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.leftCol}>
          <RecentNotes />
          <RecentRooms />
        </div>
        <div className={styles.rightCol}>
          <ProfileWidget />
          <ActivityTimeline />
        </div>
      </div>
    </div>
  );
}
