import styles from './StatCard.module.css';

export default function StatCard({ label, value, icon, trend }) {
  return (
    <div className={styles.card}>
      <div className={styles.iconWrap}>{icon}</div>
      <div>
        <p className={styles.label}>{label}</p>
        <div className={styles.valueRow}>
          <span className={styles.value}>{value}</span>
          {trend && <span className={styles.trend}>{trend}</span>}
        </div>
      </div>
    </div>
  );
}
