export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="w-full bg-muted animate-pulse rounded-lg"
      style={{ height }}
    />
  );
}
