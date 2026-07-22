import styles from './RecentRooms.module.css';

// Mock only — real collaborative "Rooms" require a backend/socket layer,
// which is explicitly out of scope for this phase. This widget proves
// out the UI slot it will occupy later.
const MOCK_ROOMS = [
  { id: 1, name: 'Design Sync', members: 4, active: true },
  { id: 2, name: 'Backend Planning', members: 3, active: false },
  { id: 3, name: 'Q3 Retro', members: 6, active: false },
];

export default function RecentRooms() {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Recent Rooms</h3>
      <ul className={styles.list}>
        {MOCK_ROOMS.map((room) => (
          <li key={room.id} className={styles.item}>
            <span className={`${styles.status} ${room.active ? styles.activeDot : ''}`} />
            <div className={styles.info}>
              <p className={styles.name}>{room.name}</p>
              <span className={styles.members}>{room.members} members</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
