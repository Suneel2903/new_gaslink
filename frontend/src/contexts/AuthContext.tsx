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
  distributor_id: string | null;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  clearUser: () => void;
  setSelectedDistributorId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [distributorId, setDistributorId] = useState<string | null>(null);
  const [selectedDistributorId, setSelectedDistributorId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        try {
          // Use cached token for faster load
          const token = await user.getIdToken();
          localStorage.setItem('authToken', token);
          
          // Fetch user profile
          const res = await api.users.getProfile();
          // Use the correct structure: { user: { ... } }
          const profile = res.data?.user || res.data?.data?.user || res.data;
          if (!profile || !profile.role) {
            throw new Error('User profile or role missing from API response');
          }
          setRole(profile.role || null);
          setDistributorId(profile.distributor_id || null);
          
          // Load saved selection for super admins
          if (profile.role === 'super_admin') {
            const saved = sessionStorage.getItem('selectedDistributorId');
            if (saved) {
              setSelectedDistributorId(saved);
            }
          }
        } catch (err) {
          console.error('Auth error:', err);
          setRole(null);
          setDistributorId(null);
        }
      } else {
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('selectedDistributorId');
        setRole(null);
        setDistributorId(null);
        setSelectedDistributorId(null);
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    localStorage.setItem('authToken', token);
    return userCredential;
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('selectedDistributorId');
  };

  const clearUser = () => {
    setUser(null);
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('selectedDistributorId');
  };

  const handleSetSelectedDistributorId = (id: string | null) => {
    setSelectedDistributorId(id);
    if (id) {
      sessionStorage.setItem('selectedDistributorId', id);
    } else {
      sessionStorage.removeItem('selectedDistributorId');
    }
  };

  const isSuperAdmin = role === 'super_admin';

  const value = {
    user,
    loading,
    role,
    distributor_id: isSuperAdmin ? selectedDistributorId : distributorId,
    isSuperAdmin,
    login,
    logout,
    clearUser,
    setSelectedDistributorId: handleSetSelectedDistributorId,
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