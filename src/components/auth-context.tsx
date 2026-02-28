
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, setDoc, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

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
      const auth = getAuth();
      
      // Perform manual credentials check first
      let userData: User | null = null;

      // Platform Admin Check
      if (email === 'officialadmin@ventureebiz.com' && password === 'officialadmin.venturee.300609') {
        const authResult = await signInAnonymously(auth);
        const uid = authResult.user.uid;

        userData = {
          id: uid,
          name: 'Platform Owner',
          email: 'officialadmin@ventureebiz.com',
          role: 'PlatformAdmin'
        };

        // Sync to Firestore Platform Admins if needed
        const adminRef = doc(firestore, 'platform_admins', uid);
        const adminDoc = await getDoc(adminRef);
        if (!adminDoc.exists()) {
          await setDoc(adminRef, userData);
        }
        
        // Sync to global users collection
        await setDoc(doc(firestore, 'users', uid), userData);
      } else {
        // Query manual lookup table
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

        // Authenticate session in Firebase Auth
        const authResult = await signInAnonymously(auth);
        const uid = authResult.user.uid;

        userData = { ...foundUser, id: uid };
        
        // Sync the temporary Auth session to the users collection for rules mapping
        await setDoc(doc(firestore, 'users', uid), userData);
      }

      setUser(userData);
      localStorage.setItem('venturee_user', JSON.stringify(userData));

      if (userData.role === 'PlatformAdmin') router.push('/admin');
      else if (userData.role === 'CompanyOwner') router.push('/company');
      else if (userData.role === 'CompanyViewer') router.push('/viewer');

      return { success: true };
    } catch (e: any) {
      console.error("Login error:", e);
      return { success: false, error: e.message || 'Authentication failed' };
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
