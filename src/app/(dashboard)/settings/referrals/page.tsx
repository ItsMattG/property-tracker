"use client";

import { ReferralDashboard } from "@/components/referral/ReferralDashboard";

export default function ReferralsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Referrals</h2>
        <p className="text-muted-foreground">
          Invite friends and earn free months of BrickTrack Pro
        </p>
      </div>

      <ReferralDashboard />
    </div>
  );
}
