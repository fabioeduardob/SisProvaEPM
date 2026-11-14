import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type UserRole = 'teacher' | 'coordinator';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchRole: (newRole: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = async (firebaseUser: User) => {
    try {
      const docRef = doc(db, 'users', firebaseUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        const defaultRole: UserRole =
          firebaseUser.email === 'coordenador@escola.com' ||
          firebaseUser.email === 'fabioeduardob@gmail.com'
            ? 'coordinator'
            : 'teacher';
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          role: defaultRole,
          name: firebaseUser.displayName || (defaultRole === 'coordinator' ? 'Coordenador' : 'Professor'),
        };
        await setDoc(docRef, newProfile);
        setProfile(newProfile);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário:', error);
      setProfile({
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        role: firebaseUser.email === 'coordenador@escola.com' ? 'coordinator' : 'teacher',
        name: firebaseUser.displayName || 'Usuário',
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadUserProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshProfile = async () => {
    if (auth.currentUser) {
      await loadUserProfile(auth.currentUser);
    }
  };

  const switchRole = async (newRole: UserRole) => {
    if (!user || !profile) return;
    const updated: UserProfile = { ...profile, role: newRole };
    setProfile(updated);
    try {
      await setDoc(doc(db, 'users', user.uid), updated, { merge: true });
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, refreshProfile, switchRole }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
