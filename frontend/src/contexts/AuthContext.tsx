import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { User, UserCredential } from 'firebase/auth';
import { auth } from '../services/firebase';
import { api } from '../services/apiClient';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: string | null;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  clearUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      
      if (user) {
        // Get and store the user's ID token
        user.getIdToken().then((token) => {
          localStorage.setItem('authToken', token);
        });
        // Fetch user profile from backend to get role
        try {
          const res = await api.users.getProfile();
          setRole(res.data.role || null);
        } catch {
          setRole(null);
        }
      } else {
        localStorage.removeItem('authToken');
        setRole(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    localStorage.setItem('authToken', token);
    // Fetch user profile after login
    try {
      const res = await api.users.getProfile();
      setRole(res.data.role || null);
    } catch {
      setRole(null);
    }
    return userCredential;
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('authToken');
  };

  const clearUser = () => {
    setUser(null);
    localStorage.removeItem('authToken');
  };

  const value = {
    user,
    loading,
    role,
    login,
    logout,
    clearUser,
  };

  return (
    <AuthContext.Provider value={value}>
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

// Full-screen loader component
export const FullScreenLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
          Loading GasLink...
        </p>
      </div>
    </div>
  );
}; 