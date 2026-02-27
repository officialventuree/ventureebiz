
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useFirestore, useAuth as useFirebaseAuth } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';

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
  const auth = useFirebaseAuth();

  useEffect(() => {
    if (!auth || !firestore) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Hardcoded admin check first
        if (firebaseUser.email === 'admin@ventureebiz.com') {
          setUser({
            id: firebaseUser.uid,
            name: 'Platform Owner',
            email: firebaseUser.email,
            role: 'admin'
          });
        } else {
          // Fetch additional user data from Firestore
          try {
            const userDoc = await getDoc(doc(firestore, 'company_users', firebaseUser.uid));
            if (userDoc.exists()) {
              setUser(userDoc.data() as User);
            }
          } catch (e) {
            console.error("Error fetching user data:", e);
          }
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  const login = async (email: string, password?: string) => {
    if (!auth || !password) return false;

    try {
      // Actually sign into Firebase Auth
      await signInWithEmailAndPassword(auth, email, password);
      
      // The onAuthStateChanged listener will handle redirecting and setting state
      // but we help it along with immediate navigation
      const userDoc = await getDocs(query(collection(firestore, 'company_users'), where('email', '==', email)));
      
      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data() as User;
        if (userData.role === 'company') router.push('/company');
        else if (userData.role === 'viewer') router.push('/viewer');
      } else if (email === 'admin@ventureebiz.com') {
        router.push('/admin');
      }
      
      return true;
    } catch (e) {
      console.error("Firebase Auth login error:", e);
      return false;
    }
  };

  const logout = () => {
    if (auth) {
      signOut(auth);
      setUser(null);
      router.push('/');
    }
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
