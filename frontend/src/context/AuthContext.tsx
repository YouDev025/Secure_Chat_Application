import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
  publicKey: string;
  phoneNumber?: string;
  description?: string;
  status?: string; // 'online' | 'away' | 'dnd' | 'offline'
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (userData: User, token: string, rememberMe: boolean) => void;
  logout: () => void;
  updateUser: (updatedFields: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authStorage, setAuthStorage] = useState<Storage>(() => localStorage);

  useEffect(() => {
    const localUser = localStorage.getItem('user');
    const localToken = localStorage.getItem('token');
    const sessionUser = sessionStorage.getItem('user');
    const sessionToken = sessionStorage.getItem('token');
    const storedUser = localUser && localToken ? localUser : sessionUser;
    const storedToken = localUser && localToken ? localToken : sessionToken;

    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
        setAuthStorage(localUser && localToken ? localStorage : sessionStorage);
      } catch (err) {
        console.error('Failed to parse stored user session:', err);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
      }
    }
  }, []);

  const login = (userData: User, newToken: string, rememberMe: boolean) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    const staleStorage = rememberMe ? sessionStorage : localStorage;

    setUser(userData);
    setToken(newToken);
    setAuthStorage(storage);

    staleStorage.removeItem('user');
    staleStorage.removeItem('token');
    storage.setItem('user', JSON.stringify(userData));
    storage.setItem('token', newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAuthStorage(localStorage);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    localStorage.removeItem('privateKey');
  };

  const updateUser = (updatedFields: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updatedFields };
      setUser(updatedUser);
      authStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
