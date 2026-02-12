"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";

export function useReferralTracking() {
  const recorded = useRef(false);
  const recordReferral = trpc.referral.recordReferral.useMutation();

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;

    // Read the httpOnly referral cookie via API route
    fetch("/api/referral/cookie")
      .then((res) => res.json())
      .then((data: { code: string | null }) => {
        if (!data.code) return;

        recordReferral.mutate(
          { code: data.code },
          {
            onSuccess: () => {
              // Clear the httpOnly cookie via API route
              fetch("/api/referral/cookie", { method: "DELETE" }).catch(() => {});
            },
          }
        );
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
