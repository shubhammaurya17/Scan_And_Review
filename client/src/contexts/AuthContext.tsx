import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../services/authApi';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface BusinessInfo {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  businesses: BusinessInfo[];
  currentBusiness: BusinessInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { email: string; password: string; name: string; businessName: string; categoryId?: string }) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentBusiness: (business: BusinessInfo) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [businesses, setBusinesses] = useState<BusinessInfo[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<BusinessInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authApi.getMe()
      .then(data => {
        setUser(data.user);
        setBusinesses(data.businesses);
        if (data.businesses.length > 0) {
          setCurrentBusiness(data.businesses[0]);
        }
      })
      .catch(() => {
        // Not authenticated
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setUser(data.user);
    setBusinesses(data.businesses);
    if (data.businesses.length > 0) {
      setCurrentBusiness(data.businesses[0]);
    }
  }, []);

  const signup = useCallback(async (payload: { email: string; password: string; name: string; businessName: string; categoryId?: string }) => {
    const data = await authApi.signup(payload);
    setUser(data.user);
    setBusinesses([{ ...data.business, role: 'OWNER' }]);
    setCurrentBusiness({ ...data.business, role: 'OWNER' });
  }, []);

  const logoutFn = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setBusinesses([]);
    setCurrentBusiness(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      businesses,
      currentBusiness,
      isAuthenticated: !!user,
      isLoading,
      login,
      signup,
      logout: logoutFn,
      setCurrentBusiness,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
