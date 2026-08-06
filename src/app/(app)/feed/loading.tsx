import { Skeleton } from "@/components/ui/skeleton";
import { ReportCardSkeleton } from "@/components/reports/report-card";

export default function FeedLoading() {
  return (
    <div className="container max-w-6xl">
      <Skeleton className="h-9 w-72 rounded-lg" />
      <Skeleton className="mt-3 h-5 w-96 rounded-lg" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ReportCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
