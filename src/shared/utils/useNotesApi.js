import { useState, useCallback } from 'react';
import { apiRequest } from './api';

export function useNotesApi(workspaceId) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotes = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest(`/api/v1/workspaces/${workspaceId}/notes`);
      setNotes(result.notes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const createNote = useCallback(async (data = {}) => {
    const result = await apiRequest(`/api/v1/workspaces/${workspaceId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setNotes((prev) => [result.note, ...prev]);
    return result.note;
  }, [workspaceId]);

  const updateNote = useCallback(async (noteId, data) => {
    const result = await apiRequest(
      `/api/v1/workspaces/${workspaceId}/notes/${noteId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    );
    setNotes((prev) => prev.map((n) => (n.id === noteId ? result.note : n)));
    return result.note;
  }, [workspaceId]);

  const deleteNote = useCallback(async (noteId) => {
    await apiRequest(`/api/v1/workspaces/${workspaceId}/notes/${noteId}`, {
      method: 'DELETE',
    });
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, [workspaceId]);

  return { notes, loading, error, fetchNotes, createNote, updateNote, deleteNote };
}
