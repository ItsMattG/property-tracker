import React, { createContext, useContext, useEffect, useState } from "react";
import { getToken, getUser, setToken, setUser, clearAuth, AuthUser } from "./auth";
import { trpc } from "./trpc";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loginMutation = trpc.mobileAuth.login.useMutation();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const [token, savedUser] = await Promise.all([getToken(), getUser()]);
      if (token && savedUser) {
        setUserState(savedUser);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const result = await loginMutation.mutateAsync({ email, password });
    await setToken(result.token);
    await setUser(result.user);
    setUserState(result.user);
  }

  async function logout() {
    await clearAuth();
    setUserState(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
