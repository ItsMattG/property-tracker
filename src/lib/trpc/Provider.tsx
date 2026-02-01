"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { trpc } from "./client";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // Data fresh for 30 seconds
            gcTime: 5 * 60 * 1000, // Keep in cache 5 minutes
            refetchOnWindowFocus: false, // Don't refetch on tab switch
            retry: 1, // Only retry once on failure
          },
        },
      })
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          // Limit batch size to prevent function timeouts
          // With 1.6s database latency per query, large batches exceed 60s timeout
          // maxURLLength of 100 forces ~1-2 procedures per batch
          maxURLLength: 100,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
