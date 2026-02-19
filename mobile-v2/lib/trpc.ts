import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import { getToken } from "./auth";
import type { AppRouter } from "../../../src/server/routers/_app";

export const trpc = createTRPCReact<AppRouter>();

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/api/trpc`,
        async headers() {
          const token = await getToken();
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
