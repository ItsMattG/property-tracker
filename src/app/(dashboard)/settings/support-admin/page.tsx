import { AdminTicketList } from "@/components/support/AdminTicketList";

export const dynamic = "force-dynamic";

export default function SupportAdminPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Support Tickets (Admin)</h2>
        <p className="text-muted-foreground">
          Manage all support tickets
        </p>
      </div>
      <AdminTicketList />
    </div>
  );
}
