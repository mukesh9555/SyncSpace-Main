import { useState, useEffect } from 'react';
import { apiRequest } from '../../../shared/utils/api';
import styles from './AdminStats.module.css';

export default function AdminStats({ workspaceId }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await apiRequest(
          `/api/v1/workspaces/${workspaceId}/admin/stats`,
        );
        if (!cancelled) setStats(result.stats);
      } catch {
        // silently fail
      }
    }
    load();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const cards = [
    { label: 'Members', value: stats?.members ?? 0, icon: '👥' },
    { label: 'Notes', value: stats?.notes ?? 0, icon: '📝' },
    { label: 'Code Files', value: stats?.codeFiles ?? 0, icon: '💻' },
    { label: 'Whiteboards', value: stats?.whiteboards ?? 0, icon: '🎨' },
  ];

  return (
    <div className={styles.grid}>
      {cards.map((card) => (
        <div key={card.label} className={styles.card}>
          <div className={styles.iconWrap}>{card.icon}</div>
          <div>
            <p className={styles.label}>{card.label}</p>
            <span className={styles.value}>{card.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
