
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<boolean>;
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
    const saved = localStorage.getItem('venturee_user');
    if (saved) {
      setUser(JSON.parse(saved));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password?: string) => {
    if (!firestore) return false;

    // First check hardcoded admin
    if (email === 'admin@ventureebiz.com' && password === 'admin') {
      const adminUser: User = { id: 'admin-1', name: 'Platform Owner', email, role: 'admin' };
      setUser(adminUser);
      localStorage.setItem('venturee_user', JSON.stringify(adminUser));
      router.push('/admin');
      return true;
    }

    // Then check Firestore for company users
    try {
      const usersRef = collection(firestore, 'company_users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data() as User;
        if (!password || userData.password === password) {
          setUser(userData);
          localStorage.setItem('venturee_user', JSON.stringify(userData));
          
          if (userData.role === 'company') router.push('/company');
          else if (userData.role === 'viewer') router.push('/viewer');
          
          return true;
        }
      }
    } catch (e) {
      console.error("Auth error:", e);
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
