import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../../shared/utils/api';
import styles from './MemberList.module.css';

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member' };
const ROLE_COLORS = { owner: 'var(--color-primary)', admin: 'var(--color-accent)', member: 'var(--color-text-muted)' };

export default function MemberList({ workspaceId, currentUserRole }) {
  const [members, setMembers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchMembers = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const result = await apiRequest(
        `/api/v1/workspaces/${workspaceId}/admin/members?${params}`,
      );
      setMembers(result.members);
      setPagination(result.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, search]);

  useEffect(() => {
    fetchMembers(1);
  }, [fetchMembers]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchMembers(1);
  };

  const handleChangeRole = async (memberId, newRole) => {
    setActionLoading(memberId);
    try {
      await apiRequest(
        `/api/v1/workspaces/${workspaceId}/admin/members/${memberId}/role`,
        { method: 'PATCH', body: JSON.stringify({ role: newRole }) },
      );
      await fetchMembers(pagination.page);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (memberId) => {
    if (!window.confirm('Remove this member from the workspace?')) return;
    setActionLoading(memberId);
    try {
      await apiRequest(
        `/api/v1/workspaces/${workspaceId}/admin/members/${memberId}`,
        { method: 'DELETE' },
      );
      await fetchMembers(pagination.page);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const canChangeRole = currentUserRole === 'owner';
  const canRemove = currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Members</h3>
        <span className={styles.count}>{pagination.total} total</span>
      </div>

      <form onSubmit={handleSearch} className={styles.searchRow}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        <button type="submit" className={styles.searchBtn}>Search</button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.loading}>Loading members...</p>
      ) : members.length === 0 ? (
        <p className={styles.empty}>No members found.</p>
      ) : (
        <ul className={styles.list}>
          {members.map((m) => (
            <li key={m.id} className={styles.member}>
              <div className={styles.avatar}>
                {m.user.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className={styles.info}>
                <span className={styles.name}>{m.user.name}</span>
                <span className={styles.email}>{m.user.email}</span>
              </div>
              <span
                className={styles.roleBadge}
                style={{ color: ROLE_COLORS[m.role] }}
              >
                {ROLE_LABELS[m.role]}
              </span>
              <div className={styles.actions}>
                {canChangeRole && m.role !== 'owner' && (
                  <select
                    value={m.role}
                    onChange={(e) => handleChangeRole(m.id, e.target.value)}
                    disabled={actionLoading === m.id}
                    className={styles.roleSelect}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                )}
                {canRemove && m.role !== 'owner' && (
                  <button
                    onClick={() => handleRemove(m.id)}
                    disabled={actionLoading === m.id}
                    className={styles.removeBtn}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => fetchMembers(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className={styles.pageBtn}
          >
            Previous
          </button>
          <span className={styles.pageInfo}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchMembers(pagination.page + 1)}
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
