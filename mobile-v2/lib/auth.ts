import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "bricktrack_token";
const USER_KEY = "bricktrack_user";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getUser(): Promise<AuthUser | null> {
  const json = await SecureStore.getItemAsync(USER_KEY);
  if (!json) return null;
  try {
    return JSON.parse(json) as AuthUser;
  } catch {
    return null;
  }
}

export async function setUser(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function clearAuth(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
