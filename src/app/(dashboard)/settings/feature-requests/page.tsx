import { AdminFeatureList } from "@/components/feedback/AdminFeatureList";

export const metadata = {
  title: "Feature Requests | Settings",
};

export default function FeatureRequestsAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feature Requests</h1>
        <p className="text-muted-foreground">
          Manage feature requests and update their status.
        </p>
      </div>

      <AdminFeatureList />
    </div>
  );
}
