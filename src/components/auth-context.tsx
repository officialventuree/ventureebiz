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
      const lowerEmail = email.toLowerCase();

      // 1. Platform Admin Check (Hardcoded Official Admin)
      if (lowerEmail === 'officialadmin@ventureebiz.com' && password === 'officialadmin.venturee.300609') {
        const userData: User = {
          id: 'platform-owner-id',
          name: 'Platform Owner',
          email: 'officialadmin@ventureebiz.com',
          role: 'PlatformAdmin'
        };
        
        setUser(userData);
        localStorage.setItem('venturee_user', JSON.stringify(userData));
        router.push('/admin');
        return { success: true };
      }

      // 2. Company Registry Check (Synced from Admin Registration)
      const usersRef = collection(firestore, 'company_users');
      const q = query(usersRef, where('email', '==', lowerEmail), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, error: 'No account registered with this email.' };
      }

      const foundUser = querySnapshot.docs[0].data() as User;
      
      // Strict password verification against synced admin record
      if (foundUser.password !== password) {
        return { success: false, error: 'Incorrect password.' };
      }

      setUser(foundUser);
      localStorage.setItem('venturee_user', JSON.stringify(foundUser));

      // Direct dynamic routing based on provisioned role
      if (foundUser.role === 'CompanyOwner') {
        router.push('/company');
      } else if (foundUser.role === 'CompanyViewer') {
        router.push('/viewer');
      } else {
        router.push('/');
      }

      return { success: true };
    } catch (e: any) {
      console.error("Auth Failure:", e);
      return { success: false, error: 'Authentication protocol failure. Check connection.' };
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
