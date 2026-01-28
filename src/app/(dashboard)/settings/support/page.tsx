import { SupportTicketList } from "@/components/support/SupportTicketList";

export const dynamic = "force-dynamic";

export default function SupportPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Support</h2>
        <p className="text-muted-foreground">
          View and manage your support tickets
        </p>
      </div>
      <SupportTicketList />
    </div>
  );
}
