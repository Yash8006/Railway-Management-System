/* eslint-disable react/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser, getProfile } from '../api/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore user from localStorage token
  useEffect(() => {
    const token = localStorage.getItem('rms_token');
    if (token) {
      getProfile()
        .then((res) => setUser(res.data.data))
        .catch(() => localStorage.removeItem('rms_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await loginUser({ email, password });
    const { token, ...userData } = res.data.data;
    localStorage.setItem('rms_token', token);
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const res = await registerUser({ name, email, password });
    const { token, ...userData } = res.data.data;
    localStorage.setItem('rms_token', token);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('rms_token');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await getProfile();
    setUser(res.data.data);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
