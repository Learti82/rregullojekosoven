import { Skeleton } from "@/components/ui/skeleton";

export default function MapLoading() {
  return (
    <div className="container max-w-7xl">
      <Skeleton className="h-9 w-72 rounded-lg" />
      <Skeleton className="mt-3 h-5 w-96 rounded-lg" />
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-[60vh] rounded-xl lg:h-[72vh]" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    </div>
  );
}
