import { useState, useCallback } from 'react';
import { apiRequest } from './api';

export function useWhiteboards(workspaceId) {
  const [whiteboards, setWhiteboards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWhiteboards = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest(`/api/v1/workspaces/${workspaceId}/whiteboards`);
      setWhiteboards(result.whiteboards);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const createWhiteboard = useCallback(async (data = {}) => {
    const result = await apiRequest(`/api/v1/workspaces/${workspaceId}/whiteboards`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setWhiteboards((prev) => [result.whiteboard, ...prev]);
    return result.whiteboard;
  }, [workspaceId]);

  const fetchWhiteboard = useCallback(async (whiteboardId) => {
    const result = await apiRequest(
      `/api/v1/workspaces/${workspaceId}/whiteboards/${whiteboardId}`,
    );
    return result.whiteboard;
  }, [workspaceId]);

  const updateWhiteboard = useCallback(async (whiteboardId, data) => {
    const result = await apiRequest(
      `/api/v1/workspaces/${workspaceId}/whiteboards/${whiteboardId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    );
    setWhiteboards((prev) =>
      prev.map((w) => (w.id === whiteboardId ? result.whiteboard : w)),
    );
    return result.whiteboard;
  }, [workspaceId]);

  const deleteWhiteboard = useCallback(async (whiteboardId) => {
    await apiRequest(
      `/api/v1/workspaces/${workspaceId}/whiteboards/${whiteboardId}`,
      { method: 'DELETE' },
    );
    setWhiteboards((prev) => prev.filter((w) => w.id !== whiteboardId));
  }, [workspaceId]);

  return {
    whiteboards,
    loading,
    error,
    fetchWhiteboards,
    createWhiteboard,
    fetchWhiteboard,
    updateWhiteboard,
    deleteWhiteboard,
  };
}
