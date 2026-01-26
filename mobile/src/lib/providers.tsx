import React from "react";

// With vanilla tRPC client, no provider is needed
// This is kept for backward compatibility with App.tsx
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
