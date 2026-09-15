import { usePresence } from '../PresenceContext';
import styles from './PresenceIndicator.module.css';

export default function PresenceIndicator({ workspaceId }) {
  const { connected, getUsersForWorkspace } = usePresence();
  const users = getUsersForWorkspace(workspaceId);

  if (!workspaceId) return null;

  return (
    <div className={styles.wrap}>
      <div className={`${styles.dot} ${connected ? styles.online : styles.offline}`} />
      <span className={styles.label}>
        {connected ? `${users.length} online` : 'Connecting...'}
      </span>
      {users.length > 0 && (
        <div className={styles.avatars}>
          {users.slice(0, 5).map((u) => (
            <span
              key={u.userId}
              className={styles.avatar}
              title={`${u.name} (${u.status})`}
            >
              {u.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          ))}
          {users.length > 5 && (
            <span className={styles.more}>+{users.length - 5}</span>
          )}
        </div>
      )}
    </div>
  );
}
