"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoanPacksRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/reports/brokers");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-muted-foreground">Redirecting to Broker Portal...</p>
    </div>
  );
}
