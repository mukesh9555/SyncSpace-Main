import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '../../shared/utils/api';
import { useCodeFiles } from '../../shared/utils/useCodeFilesApi';
import { useWebSocket } from '../../shared/utils/useWebSocket';
import { useCodeFilesCollaboration } from '../../shared/utils/useCodeFilesCollaboration';
import FileTree from './components/FileTree';
import CodeEditorPane from './components/CodeEditorPane';
import styles from './CodeEditor.module.css';

const LANG_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp',
  go: 'go', rs: 'rust', rb: 'ruby', php: 'php', swift: 'swift',
  kt: 'kotlin', sql: 'sql', html: 'html', css: 'css', scss: 'scss',
  json: 'json', yaml: 'yaml', yml: 'yaml', md: 'markdown',
  sh: 'bash', bash: 'bash', txt: 'plaintext',
};

function detectLanguage(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  return LANG_MAP[ext] || 'plaintext';
}

export default function CodeEditor() {
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [activeFileId, setActiveFileId] = useState(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [renamingId, setRenamingId] = useState(null);

  const { files, loading, error, fetchFiles, createFile, updateFile, deleteFile, patchFile } =
    useCodeFiles(workspaceId);

  // WebSocket for collaboration
  const { connected, send, on } = useWebSocket();

  const {
    broadcastFileUpdate,
    onFileUpdated,
    onRevisionConflict,
    initRevision,
  } = useCodeFilesCollaboration({ workspaceId, send, on, connected });

  // Track revision per file from fetched data — start at 0 (backend's initial state)
  useEffect(() => {
    for (const file of files) {
      initRevision(file.id, 0);
    }
  }, [files, initRevision]);

  // Track remote content updates for the active file
  const [remoteFileVersion, setRemoteFileVersion] = useState(0);
  const [remoteFileContent, setRemoteFileContent] = useState(null);

  // Handle remote file updates — update local file state if the updated file is active
  const remoteUpdateRef = useRef(null);
  useEffect(() => {
    onFileUpdated((msg) => {
      remoteUpdateRef.current?.(msg);
    });
  }, [onFileUpdated]);

  useEffect(() => {
    remoteUpdateRef.current = (msg) => {
      if (activeFileId === msg.fileId) {
        setRemoteFileContent(msg.content ?? null);
        setRemoteFileVersion((v) => v + 1);
      }
      // Patch the file in the list so the file tree and any re-renders reflect the change
      patchFile(msg.fileId, {
        content: msg.content,
        language: msg.language,
      });
    };
  }, [activeFileId, patchFile]);

  // Handle revision conflicts — re-fetch to sync with server state
  useEffect(() => {
    onRevisionConflict((msg) => {
      if (msg.entityType === 'codefile' && workspaceId) {
        fetchFiles();
      }
    });
  }, [onRevisionConflict, workspaceId, fetchFiles]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await apiRequest('/api/v1/workspaces');
        if (!cancelled) {
          setWorkspaces(result.workspaces);
          if (result.workspaces.length > 0) setWorkspaceId(result.workspaces[0].id);
          setInitialLoadDone(true);
        }
      } catch {
        if (!cancelled) setInitialLoadDone(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (workspaceId) fetchFiles();
  }, [workspaceId, fetchFiles]);

  useEffect(() => {
    if (activeFileId && !files.find((f) => f.id === activeFileId)) {
      setActiveFileId(null);
    }
  }, [files, activeFileId]);

  const activeFile = files.find((f) => f.id === activeFileId) ?? null;

  const handleCreateFile = useCallback(async () => {
    const name = prompt('File name (e.g. index.js):');
    if (!name?.trim()) return;
    const path = `/${name.trim()}`;
    try {
      const file = await createFile({
        name: name.trim(),
        path,
        content: '',
        language: detectLanguage(name.trim()),
      });
      setActiveFileId(file.id);
    } catch {
      // error handled by hook
    }
  }, [createFile]);

  const handleRename = useCallback(async (fileId, newName) => {
    if (!newName?.trim()) return;
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    const dir = file.path.substring(0, file.path.lastIndexOf('/') + 1);
    const newPath = `${dir}${newName.trim()}`;
    try {
      await updateFile(fileId, {
        name: newName.trim(),
        path: newPath,
        language: detectLanguage(newName.trim()),
      });
      setRenamingId(null);
    } catch {
      // error handled by hook
    }
  }, [files, updateFile]);

  const handleDelete = useCallback(async (fileId) => {
    try {
      await deleteFile(fileId);
      setActiveFileId((current) => (current === fileId ? null : current));
    } catch {
      // error handled by hook
    }
  }, [deleteFile]);

  const handleSave = useCallback(async (fileId, data) => {
    try {
      await updateFile(fileId, data);
      // Broadcast to other workspace members via WebSocket
      broadcastFileUpdate(fileId, {
        content: data.content,
        language: data.language,
      });
    } catch {
      // error handled by hook
    }
  }, [updateFile, broadcastFileUpdate]);

  if (!initialLoadDone) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>Loading...</div>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <p>Create a workspace first to start editing code.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        {workspaces.length > 1 && (
          <select
            className={styles.workspaceSelect}
            value={workspaceId ?? ''}
            onChange={(e) => { setWorkspaceId(e.target.value); setActiveFileId(null); }}
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
        )}
        <button className={styles.newBtn} onClick={handleCreateFile} disabled={!workspaceId}>
          + New File
        </button>
        {loading ? (
          <p className={styles.statusMsg}>Loading files...</p>
        ) : error ? (
          <p className={styles.errorMsg}>{error}</p>
        ) : (
          <FileTree
            files={files}
            activeFileId={activeFileId}
            renamingId={renamingId}
            onSelect={setActiveFileId}
            onRename={handleRename}
            onStartRename={setRenamingId}
            onDelete={handleDelete}
          />
        )}
        {connected && (
          <div className={styles.collabStatus}>
            <span className={styles.collabDot} /> Real-time sync active
          </div>
        )}
      </aside>

      <main className={styles.editorPane}>
        {activeFile ? (
          <CodeEditorPane
            file={activeFile}
            onSave={handleSave}
            remoteContent={remoteFileContent}
            remoteVersion={remoteFileVersion}
          />
        ) : (
          <div className={styles.emptyState}>
            <p>Select a file or create a new one to start coding.</p>
          </div>
        )}
      </main>
    </div>
  );
}
