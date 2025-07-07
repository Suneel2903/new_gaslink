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
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      if (user && !profileLoaded) {
        // Get and store the user's ID token
        user.getIdToken().then((token) => {
          localStorage.setItem('authToken', token);
        });
        // Fetch user profile from backend to get role and distributor_id
        try {
          const res = await api.users.getProfile();
          console.log("Profile fetch response:", res.data);
          setRole(res.data.role || null);
          setDistributorId(res.data.distributor_id || null);
          setProfileLoaded(true);
        } catch (err) {
          console.error('Failed to fetch user profile:', err);
          setRole(null);
          setDistributorId(null);
          setProfileLoaded(false);
        }
      } else if (!user) {
        localStorage.removeItem('authToken');
        setRole(null);
        setDistributorId(null);
        setProfileLoaded(false);
      }
    });
    return () => unsubscribe();
  }, [profileLoaded]);

  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    localStorage.setItem('authToken', token);
    // Fetch user profile after login
    try {
      const res = await api.users.getProfile();
      setRole(res.data.role || null);
      setDistributorId(res.data.distributor_id || null);
    } catch {
      setRole(null);
      setDistributorId(null);
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

  const isSuperAdmin = role === 'super_admin';

  const value = {
    user,
    loading,
    role,
    distributor_id: distributorId,
    isSuperAdmin,
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