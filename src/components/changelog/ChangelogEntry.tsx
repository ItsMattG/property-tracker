import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import Link from "next/link";

interface ChangelogEntryProps {
  entry: {
    id: string;
    title: string;
    summary: string;
    category: "feature" | "improvement" | "fix";
    publishedAt: string;
  };
  showLink?: boolean;
}

const categoryStyles = {
  feature: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  improvement: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fix: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const categoryLabels = {
  feature: "New Feature",
  improvement: "Improvement",
  fix: "Fix",
};

export function ChangelogEntry({ entry, showLink = true }: ChangelogEntryProps) {
  const content = (
    <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary" className={categoryStyles[entry.category]}>
          {categoryLabels[entry.category]}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {format(new Date(entry.publishedAt), "MMM d, yyyy")}
        </span>
      </div>
      <h3 className="font-semibold mb-1">{entry.title}</h3>
      <p className="text-sm text-muted-foreground">{entry.summary}</p>
    </div>
  );

  if (showLink) {
    return (
      <Link href={`/changelog/${entry.id}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
