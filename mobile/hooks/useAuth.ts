import { useState, useEffect, useCallback } from 'react';
import { storage } from '../utils/storage';
import { authApi } from '../services/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'CLIENT' | 'RIDER' | 'ADMIN';
  riderProfile?: {
    id: string;
    status: string;
    subscriptionStatus: string;
    subscriptionExpiresAt?: string;
    isAvailable: boolean;
  };
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = await storage.get('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await authApi.me();
      setUser(data.data.user as AuthUser);
    } catch {
      await storage.clear();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (accessToken: string, refreshToken: string, userData: AuthUser) => {
    await storage.set('accessToken', accessToken);
    await storage.set('refreshToken', refreshToken);
    setUser(userData);
  };

  const logout = async () => {
    await storage.clear();
    setUser(null);
  };

  return { user, loading, login, logout, reload: loadUser };
}
