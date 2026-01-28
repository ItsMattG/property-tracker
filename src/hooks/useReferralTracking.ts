"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";

export function useReferralTracking() {
  const recorded = useRef(false);
  const recordReferral = trpc.referral.recordReferral.useMutation();

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;

    // Check for referral cookie
    const cookies = document.cookie.split(";").map((c) => c.trim());
    const referralCookie = cookies.find((c) => c.startsWith("referral_code="));
    if (!referralCookie) return;

    const code = referralCookie.split("=")[1];
    if (!code) return;

    // Record the referral
    recordReferral.mutate(
      { code },
      {
        onSuccess: () => {
          // Clear the cookie
          document.cookie =
            "referral_code=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        },
      }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
