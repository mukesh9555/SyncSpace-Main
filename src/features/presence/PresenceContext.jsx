import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../../shared/utils/useWebSocket';

const PresenceContext = createContext(null);

export function PresenceProvider({ children }) {
  const { connected, send, on } = useWebSocket();
  const [workspaceUsers, setWorkspaceUsers] = useState({});
  const currentWorkspaceRef = useRef(null);

  // Listen for presence events
  useEffect(() => {
    const unsubs = [
      on('presence', (msg) => {
        setWorkspaceUsers((prev) => ({ ...prev, [msg.workspaceId]: msg.users }));
      }),
      on('user_joined', (msg) => {
        setWorkspaceUsers((prev) => {
          const users = prev[msg.workspaceId] || [];
          if (users.find((u) => u.userId === msg.user.userId)) return prev;
          return { ...prev, [msg.workspaceId]: [...users, msg.user] };
        });
      }),
      on('user_left', (msg) => {
        setWorkspaceUsers((prev) => {
          const users = prev[msg.workspaceId] || [];
          return {
            ...prev,
            [msg.workspaceId]: users.filter((u) => u.userId !== msg.userId),
          };
        });
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [on]);

  const joinWorkspace = useCallback(
    (workspaceId) => {
      if (!connected) return;
      currentWorkspaceRef.current = workspaceId;
      send({ type: 'join', workspaceId });
    },
    [connected, send],
  );

  const leaveWorkspace = useCallback(
    (workspaceId) => {
      if (!connected) return;
      if (currentWorkspaceRef.current === workspaceId) {
        currentWorkspaceRef.current = null;
      }
      send({ type: 'leave', workspaceId });
      setWorkspaceUsers((prev) => {
        const copy = { ...prev };
        delete copy[workspaceId];
        return copy;
      });
    },
    [connected, send],
  );

  const getUsersForWorkspace = useCallback(
    (workspaceId) => {
      return workspaceUsers[workspaceId] || [];
    },
    [workspaceUsers],
  );

  const value = {
    connected,
    joinWorkspace,
    leaveWorkspace,
    getUsersForWorkspace,
    workspaceUsers,
  };

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider');
  return ctx;
}
