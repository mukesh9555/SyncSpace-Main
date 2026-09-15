import { useState, useCallback } from 'react';
import { apiRequest } from './api';

export function useCodeFiles(workspaceId) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFiles = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest(`/api/v1/workspaces/${workspaceId}/codefiles`);
      setFiles(result.files);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const createFile = useCallback(async (data) => {
    const result = await apiRequest(`/api/v1/workspaces/${workspaceId}/codefiles`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setFiles((prev) => [...prev, result.file]);
    return result.file;
  }, [workspaceId]);

  const updateFile = useCallback(async (fileId, data) => {
    const result = await apiRequest(
      `/api/v1/workspaces/${workspaceId}/codefiles/${fileId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    );
    setFiles((prev) => prev.map((f) => (f.id === fileId ? result.file : f)));
    return result.file;
  }, [workspaceId]);

  const deleteFile = useCallback(async (fileId) => {
    await apiRequest(`/api/v1/workspaces/${workspaceId}/codefiles/${fileId}`, {
      method: 'DELETE',
    });
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, [workspaceId]);

  const patchFile = useCallback((fileId, data) => {
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, ...data } : f)));
  }, []);

  return { files, loading, error, fetchFiles, createFile, updateFile, deleteFile, patchFile };
}
