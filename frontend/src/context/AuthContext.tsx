import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'Administrator' | 'Store Manager' | 'Store Operator' | 'Purchase Team' | 'Employee';

interface User {
  username: string;
  name?: string;
  role: UserRole;
  token: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, role: UserRole, token: string, name?: string) => void;
  logout: () => void;
  isLoading: boolean;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('smart_store_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('smart_store_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (username: string, role: UserRole, token: string, name?: string) => {
    const newUser = { username, role, token, name };
    setUser(newUser);
    localStorage.setItem('smart_store_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('smart_store_user');
  };

  const hasRole = React.useCallback((roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, hasRole }}>
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
