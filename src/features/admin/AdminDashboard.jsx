import { useState, useEffect } from 'react';
import { apiRequest } from '../../shared/utils/api';
import AdminStats from './components/AdminStats';
import MemberList from './components/MemberList';
import ActivityFeed from './components/ActivityFeed';
import styles from './AdminDashboard.module.css';

export default function AdminDashboard() {
  const [workspace, setWorkspace] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const wsResult = await apiRequest('/api/v1/workspaces');
        const workspaces = wsResult.workspaces;
        if (!workspaces.length || cancelled) return;

        const ws = workspaces[0];
        setWorkspace(ws);
        setUserRole(ws.role);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className={styles.noAccess}>Loading...</div>;
  }

  if (!workspace || (userRole !== 'owner' && userRole !== 'admin')) {
    return (
      <div className={styles.noAccess}>
        You do not have admin access to this workspace.
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Dashboard</h1>
          <p className={styles.subtitle}>Manage {workspace.name}</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <AdminStats workspaceId={workspace.id} />
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.col}>
          <MemberList workspaceId={workspace.id} currentUserRole={userRole} />
        </div>
        <div className={styles.col}>
          <ActivityFeed workspaceId={workspace.id} />
        </div>
      </div>
    </div>
  );
}
