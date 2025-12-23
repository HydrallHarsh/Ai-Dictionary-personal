"use client";

import { getCurrentUser, handleSignup, loginUser, logoutUser } from "@/lib/api";

import { useState, createContext, useContext, useEffect } from "react";

interface User {
  id: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginAction: (email: string, password: string) => Promise<void>;
  logoutAction: () => Promise<void>;
  registerAction: (email: string, password: string) => Promise<void>;
}
// Creating Auth Context
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        setLoading(true);
        const currUser = await getCurrentUser();
        setUser(currUser);
      } catch {

        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  async function loginAction(email: string, password: string) {
    setLoading(true);
    try {
      console.log("loginAction called in AuthProvider");
      await loginUser({
        username: email,
        password: password,
      });
      const currUser = await getCurrentUser();
      setUser(currUser);
    } finally {
      setLoading(false);
    }
  }

  async function logoutAction() {
    try {
      await logoutUser();
      setUser(null); 
    } catch (error) {
      console.error("Logout failed in AuthProvider", error);
      // TODO: Replace with toast notification system
      throw error; 
    }
  }

  async function registerAction(email: string, password: string) {
    try {
      console.log("registerAction called in AuthProvider");
      await handleSignup({ email, password });
      await loginAction(email, password); // Auto-login after successful registration
    } catch (error) {
      console.log("Registration failed in AuthProvider", error);
      throw error;
    }
  }
  return (
    <AuthContext.Provider
      value={{ user, loading, loginAction, logoutAction, registerAction }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
