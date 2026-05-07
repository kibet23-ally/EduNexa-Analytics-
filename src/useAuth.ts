import { createContext, useContext } from 'react';
import { User } from './types';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  theme: 'light' | 'dark';
  sessionReady: boolean;   // true once Supabase session is confirmed
  login: (token: string, user: User) => void;
  logout: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
