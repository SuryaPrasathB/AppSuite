import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../api/apiClient';

export type StandardRole = 'Administrator' | 'Store Manager' | 'Store Operator' | 'Purchase Team' | 'Employee';
export type UserRole = StandardRole | string;
export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface User {
  id?: number;
  username: string;
  name?: string;
  role: UserRole;
  token: string;
  email?: string;
  department?: string;
  last_login_at?: string;
  last_seen_at?: string;
  presence_status?: PresenceStatus;
  status_message?: string;
}

interface AuthContextType {
  user: User | null;
  login: (
    username: string, 
    role: UserRole, 
    token: string, 
    name?: string, 
    id?: number, 
    email?: string, 
    department?: string,
    last_login_at?: string,
    presence_status?: PresenceStatus,
    status_message?: string
  ) => void;
  logout: () => void;
  isLoading: boolean;
  hasRole: (roles: UserRole[]) => boolean;
  updateUser: (updatedUser: Partial<User>) => void;
  updatePresenceStatus: (newStatus: PresenceStatus, newMessage?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Track manual override so auto-idle doesn't overwrite explicit 'busy' or 'offline'
  const isManuallySetRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    const storedUser = localStorage.getItem('smart_store_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (!parsed.presence_status) {
          parsed.presence_status = 'online';
        }
        setUser(parsed);
      } catch (e) {
        localStorage.removeItem('smart_store_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (
    username: string, 
    role: UserRole, 
    token: string, 
    name?: string, 
    id?: number, 
    email?: string, 
    department?: string,
    last_login_at?: string,
    presence_status?: PresenceStatus,
    status_message?: string
  ) => {
    const newUser: User = { 
      username, 
      role, 
      token, 
      name, 
      id, 
      email, 
      department,
      last_login_at: last_login_at || new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      presence_status: presence_status || 'online',
      status_message: status_message || ''
    };
    setUser(newUser);
    localStorage.setItem('smart_store_user', JSON.stringify(newUser));
  };

  const updateUser = useCallback((updatedUser: Partial<User>) => {
    setUser(prevUser => {
      if (!prevUser) return null;
      const newUser = { ...prevUser, ...updatedUser };
      localStorage.setItem('smart_store_user', JSON.stringify(newUser));
      return newUser;
    });
  }, []);

  const updatePresenceStatus = async (newStatus: PresenceStatus, newMessage?: string) => {
    if (!user) return;
    isManuallySetRef.current = newStatus === 'busy' || newStatus === 'offline';
    try {
      const msg = newMessage !== undefined ? newMessage : user.status_message;
      await apiClient.auth.updateStatus({
        presence_status: newStatus,
        status_message: msg,
        user_id: user.id
      });
      updateUser({
        presence_status: newStatus,
        status_message: msg,
        last_seen_at: new Date().toISOString()
      });
    } catch (e) {
      console.error('Failed to update presence status', e);
    }
  };

  const logout = async () => {
    if (user?.id) {
      try {
        await apiClient.auth.logout({ user_id: user.id });
      } catch (e) {
        // Ignore logout network failure
      }
    }
    setUser(null);
    localStorage.removeItem('smart_store_user');
  };

  const hasRole = useCallback((roles: UserRole[]) => {
    if (!user) return false;
    if (roles.includes(user.role)) return true;
    if (user.role === 'Administrator') return true;
    if (roles.includes('Employee')) return true;
    return false;
  }, [user]);

  // Heartbeat & Auto-idle detection
  useEffect(() => {
    if (!user?.id) return;

    // Send immediate initial heartbeat on mount so server updates presence immediately
    apiClient.auth.heartbeat({
      user_id: user.id,
      presence_status: user.presence_status || 'online',
      status_message: user.status_message
    }).catch(() => {});

    const onUserAction = () => {
      lastActivityRef.current = Date.now();
      // If user was marked 'away' automatically, bring back to 'online'
      if (user.presence_status === 'away' && !isManuallySetRef.current) {
        updatePresenceStatus('online');
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        lastActivityRef.current = Date.now();
        if (user.presence_status === 'away' && !isManuallySetRef.current) {
          updatePresenceStatus('online');
        } else {
          apiClient.auth.heartbeat({
            user_id: user.id,
            presence_status: user.presence_status || 'online',
            status_message: user.status_message
          }).catch(() => {});
        }
      }
    };

    window.addEventListener('mousemove', onUserAction, { passive: true });
    window.addEventListener('keydown', onUserAction, { passive: true });
    window.addEventListener('click', onUserAction, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Periodic heartbeat every 45 seconds
    const interval = setInterval(async () => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;
      const isIdle = idleTime > 5 * 60 * 1000; // 5 minutes idle
      const isHidden = document.visibilityState === 'hidden';

      let currentPresence = user.presence_status || 'online';
      
      // Auto-switch to away if inactive or minimized and not manually set to busy
      if ((isIdle || isHidden) && currentPresence === 'online' && !isManuallySetRef.current) {
        currentPresence = 'away';
        updateUser({ presence_status: 'away' });
      }

      try {
        await apiClient.auth.heartbeat({
          user_id: user.id,
          presence_status: currentPresence,
          status_message: user.status_message
        });
      } catch (e) {
        // Heartbeat failure ignored silently
      }
    }, 45000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', onUserAction);
      window.removeEventListener('keydown', onUserAction);
      window.removeEventListener('click', onUserAction);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user?.id, user?.presence_status, user?.status_message, updateUser]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, hasRole, updateUser, updatePresenceStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
