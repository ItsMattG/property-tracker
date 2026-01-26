import { BugReportList } from "@/components/feedback/BugReportList";

export const metadata = {
  title: "Bug Reports | Settings",
};

export default function BugReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bug Reports</h1>
        <p className="text-muted-foreground">
          Review and manage bug reports submitted by users.
        </p>
      </div>

      <BugReportList />
    </div>
  );
}
