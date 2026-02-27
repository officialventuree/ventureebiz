'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children, initialUsers }: { children: React.ReactNode, initialUsers: User[] }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('venturee_user');
    if (saved) {
      setUser(JSON.parse(saved));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password?: string) => {
    // In a real app, this would be a server action or API call
    // We'll simulate by checking against our mock users
    const found = initialUsers.find(u => u.email === email && (!password || u.password === password));
    if (found) {
      setUser(found);
      localStorage.setItem('venturee_user', JSON.stringify(found));
      
      if (found.role === 'admin') router.push('/admin');
      else if (found.role === 'company') router.push('/company');
      else if (found.role === 'viewer') router.push('/viewer');
      
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('venturee_user');
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
