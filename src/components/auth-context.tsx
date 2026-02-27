'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const firestore = useFirestore();

  useEffect(() => {
    // Check local storage for existing session on mount
    const savedUser = localStorage.getItem('venturee_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('venturee_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password?: string) => {
    if (!firestore) return { success: false, error: 'Database not initialized' };
    if (!email || !password) return { success: false, error: 'Missing credentials' };

    try {
      // Hardcoded platform admin check
      if (email === 'admin@ventureebiz.com' && password === 'admin') {
        const adminUser: User = {
          id: 'platform-admin',
          name: 'Platform Owner',
          email: 'admin@ventureebiz.com',
          role: 'admin'
        };
        setUser(adminUser);
        localStorage.setItem('venturee_user', JSON.stringify(adminUser));
        router.push('/admin');
        return { success: true };
      }

      // Query Firestore for company users
      const usersRef = collection(firestore, 'company_users');
      const q = query(usersRef, where('email', '==', email), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, error: 'Account not found' };
      }

      const userData = querySnapshot.docs[0].data() as User;

      // Verify password (Manual check for prototype)
      if (userData.password !== password) {
        return { success: false, error: 'Invalid password' };
      }

      setUser(userData);
      localStorage.setItem('venturee_user', JSON.stringify(userData));

      // Redirect based on role
      if (userData.role === 'company') {
        router.push('/company');
      } else if (userData.role === 'viewer') {
        router.push('/viewer');
      }

      return { success: true };
    } catch (e: any) {
      console.error("Login error:", e);
      return { success: false, error: 'Database connection failed' };
    }
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
