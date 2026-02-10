import { FeatureList } from "@/components/feedback/FeatureList";

export const metadata = {
  title: "Feature Requests | BrickTrack",
  description: "Vote on features and suggest improvements for BrickTrack",
};

export default function FeedbackPage() {
  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Feature Requests</h1>
        <p className="text-muted-foreground">
          Vote on features you&apos;d like to see, or suggest your own ideas.
          We use your feedback to prioritise our roadmap.
        </p>
      </div>

      <FeatureList />
    </div>
  );
}
