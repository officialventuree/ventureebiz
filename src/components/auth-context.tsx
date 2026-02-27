'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useFirestore, useAuth as useFirebaseAuth } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';

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
            } else {
              // Fallback if doc doesn't exist yet but user is authenticated
              setUser({
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'User',
                email: firebaseUser.email || '',
                role: 'company' // Default to company for auto-provisioned users
              });
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
    if (!auth || !password) return { success: false, error: 'Missing credentials' };

    try {
      // Actually sign into Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Navigate based on role
      if (email === 'admin@ventureebiz.com') {
        router.push('/admin');
      } else {
        // We query to find the role for navigation redirection
        const userDoc = await getDoc(doc(firestore, 'company_users', userCredential.user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          if (userData.role === 'company') router.push('/company');
          else if (userData.role === 'viewer') router.push('/viewer');
        } else {
          // If doc not found, it might be a newly created company
          router.push('/company');
        }
      }
      
      return { success: true };
    } catch (e: any) {
      let errorMessage = "Invalid credentials. Please try again.";
      
      if (e instanceof FirebaseError) {
        // 'auth/invalid-credential' is the standard error for wrong email/password or disabled provider
        if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
          errorMessage = "Login failed. Ensure the 'Email/Password' provider is enabled in Firebase Console and the user exists.";
        }
      }
      
      return { success: false, error: errorMessage };
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
