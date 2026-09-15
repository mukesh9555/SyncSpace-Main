import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../../shared/utils/api';
import styles from './ActivityFeed.module.css';

const ACTION_ICONS = {
  'workspace.created': '🏠',
  'workspace.updated': '✏️',
  'workspace.deleted': '🗑️',
  'member.invited': '📨',
  'member.joined': '👋',
  'member.removed': '🚪',
  'member.role_changed': '🔄',
  'invite.revoked': '❌',
  'note.created': '📝',
  'note.updated': '✏️',
  'note.deleted': '🗑️',
  'codefile.created': '📄',
  'codefile.updated': '💻',
  'codefile.deleted': '🗑️',
  'whiteboard.created': '🎨',
  'whiteboard.updated': '🎨',
  'whiteboard.deleted': '🗑️',
};

function formatAction(log) {
  const user = log.user?.name ?? 'Unknown';
  const meta = log.metadata ?? {};

  switch (log.action) {
    case 'workspace.created':
      return `${user} created workspace "${meta.name}"`;
    case 'workspace.updated':
      return `${user} updated workspace "${meta.name}"`;
    case 'workspace.deleted':
      return `${user} deleted workspace "${meta.name ?? meta.slug}"`;
    case 'member.invited':
      return `${user} invited ${meta.email} as ${meta.role}`;
    case 'member.joined':
      return `${user} joined as ${meta.role}`;
    case 'member.removed':
      return `${user} removed a member (${meta.role})`;
    case 'member.role_changed':
      return `${user} changed ${meta.targetUserId ? 'a member\'s' : 'a'} role from ${meta.oldRole} to ${meta.newRole}`;
    case 'invite.revoked':
      return `${user} revoked invite for ${meta.email}`;
    case 'note.created':
      return `${user} created note "${meta.title ?? 'Untitled'}"`;
    case 'note.updated':
      return `${user} updated note "${meta.title ?? 'Untitled'}"`;
    case 'note.deleted':
      return `${user} deleted a note`;
    case 'codefile.created':
      return `${user} created a code file`;
    case 'codefile.updated':
      return `${user} updated a code file`;
    case 'codefile.deleted':
      return `${user} deleted a code file`;
    case 'whiteboard.created':
      return `${user} created a whiteboard`;
    case 'whiteboard.updated':
      return `${user} updated a whiteboard`;
    case 'whiteboard.deleted':
      return `${user} deleted a whiteboard`;
    default:
      return `${user} performed ${log.action}`;
  }
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityFeed({ workspaceId }) {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      const result = await apiRequest(
        `/api/v1/workspaces/${workspaceId}/admin/activity?${params}`,
      );
      setLogs(result.logs);
      setPagination(result.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Recent Activity</h3>
        <span className={styles.count}>{pagination.total} events</span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.loading}>Loading activity...</p>
      ) : logs.length === 0 ? (
        <p className={styles.empty}>No activity recorded yet.</p>
      ) : (
        <ul className={styles.list}>
          {logs.map((log) => (
            <li key={log.id} className={styles.item}>
              <span className={styles.icon}>
                {ACTION_ICONS[log.action] ?? '📌'}
              </span>
              <div className={styles.content}>
                <p className={styles.text}>{formatAction(log)}</p>
                <span className={styles.time}>{timeAgo(log.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => fetchLogs(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className={styles.pageBtn}
          >
            Previous
          </button>
          <span className={styles.pageInfo}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchLogs(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className={styles.pageBtn}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
