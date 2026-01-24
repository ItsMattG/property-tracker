import { Suspense } from "react";
import { AcceptInviteContent } from "./AcceptInviteContent";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <AcceptInviteContent />
    </Suspense>
  );
}
