import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

interface DataSkeletonProps {
  variant?: "card" | "list" | "table";
  count?: number;
  className?: string;
}

function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-8 w-1/2" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

export function DataSkeleton({
  variant = "card",
  count = 1,
  className,
}: DataSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  const SkeletonComponent = {
    card: CardSkeleton,
    list: ListSkeleton,
    table: TableRowSkeleton,
  }[variant];

  return (
    <>
      {items.map((i) => (
        <div key={i} className={cn(className)}>
          <SkeletonComponent />
        </div>
      ))}
    </>
  );
}
