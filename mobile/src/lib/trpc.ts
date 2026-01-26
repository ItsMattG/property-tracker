import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { getToken } from "./auth";
import type { AppRouter } from "../../../src/server/routers/_app";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.20.4:3000";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      async headers() {
        const token = await getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
