'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  impersonateCompany: (companyUser: User) => void;
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
      // Platform Admin Check (Manual Credentials)
      if (email === 'officialadmin@ventureebiz.com' && password === 'officialadmin.venturee.300609') {
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

      // Company User / Viewer Check
      const usersRef = collection(firestore, 'company_users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, error: 'Account not found' };
      }

      const foundUser = querySnapshot.docs[0].data() as User;
      if (foundUser.password !== password) {
        return { success: false, error: 'Invalid password' };
      }

      setUser(foundUser);
      localStorage.setItem('venturee_user', JSON.stringify(foundUser));

      if (foundUser.role === 'CompanyOwner') router.push('/company');
      else if (foundUser.role === 'CompanyViewer') router.push('/viewer');

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Authentication failed' };
    }
  };

  const impersonateCompany = (companyUser: User) => {
    // Allows admin to jump into a company dashboard
    const impersonatedUser = { ...companyUser, role: 'CompanyOwner' as const };
    setUser(impersonatedUser);
    localStorage.setItem('venturee_user', JSON.stringify(impersonatedUser));
    router.push('/company');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('venturee_user');
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, impersonateCompany, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
