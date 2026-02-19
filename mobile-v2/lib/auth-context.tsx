import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getToken, getUser, setToken, setUser, clearAuth, type AuthUser } from "./auth";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, trpcClient }: { children: ReactNode; trpcClient: any }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      const result = await trpcClient.mobileAuth.verify.query({ token });
      if (result?.user) {
        setUserState(result.user);
        await setUser(result.user);
      } else {
        await clearAuth();
      }
    } catch {
      await clearAuth();
    } finally {
      setIsLoading(false);
    }
  }, [trpcClient]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await trpcClient.mobileAuth.login.mutate({ email, password });
    await setToken(result.token);
    await setUser(result.user);
    setUserState(result.user);
  }, [trpcClient]);

  const logout = useCallback(async () => {
    await clearAuth();
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout, restoreSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
