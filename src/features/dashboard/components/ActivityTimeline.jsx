import styles from './ActivityTimeline.module.css';

const MOCK_ACTIVITY = [
  { id: 1, text: 'Created note "API Design Notes"', time: '2h ago', icon: '📝' },
  { id: 2, text: 'Drew a diagram on Whiteboard', time: '5h ago', icon: '🎨' },
  { id: 3, text: 'Logged in from a new session', time: '1d ago', icon: '🔐' },
  { id: 4, text: 'Edited note "Sprint Retro"', time: '2d ago', icon: '✏️' },
];

export default function ActivityTimeline() {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Recent Activity</h3>
      <ul className={styles.list}>
        {MOCK_ACTIVITY.map((item) => (
          <li key={item.id} className={styles.item}>
            <span className={styles.icon}>{item.icon}</span>
            <div>
              <p className={styles.text}>{item.text}</p>
              <span className={styles.time}>{item.time}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
