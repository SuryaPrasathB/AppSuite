import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'Administrator' | 'Store Manager' | 'Store Operator' | 'Purchase Team' | 'Employee';

interface User {
  id?: number;
  username: string;
  name?: string;
  role: UserRole;
  token: string;
  email?: string;
  department?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, role: UserRole, token: string, name?: string, id?: number, email?: string, department?: string) => void;
  logout: () => void;
  isLoading: boolean;
  hasRole: (roles: UserRole[]) => boolean;
  updateUser: (updatedUser: Partial<User>) => void;
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

  const login = (username: string, role: UserRole, token: string, name?: string, id?: number, email?: string, department?: string) => {
    const newUser = { username, role, token, name, id, email, department };
    setUser(newUser);
    localStorage.setItem('smart_store_user', JSON.stringify(newUser));
  };

  const updateUser = (updatedUser: Partial<User>) => {
    setUser(prevUser => {
      if (!prevUser) return null;
      const newUser = { ...prevUser, ...updatedUser };
      localStorage.setItem('smart_store_user', JSON.stringify(newUser));
      return newUser;
    });
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
    <AuthContext.Provider value={{ user, login, logout, isLoading, hasRole, updateUser }}>
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
