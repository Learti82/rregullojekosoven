import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BellOff } from "lucide-react";
import { getCurrentUser } from "@/lib/permissions";
import { getNotifications } from "@/server/queries/users";
import { getUnreadCount } from "@/lib/notifications";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = {
  title: "Njoftimet",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/notifications");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [result, unread] = await Promise.all([
    getNotifications(user.id, page),
    getUnreadCount(user.id),
  ]);

  return (
    <div className="container max-w-3xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Njoftimet</h1>
        <p className="mt-1.5 text-muted-foreground">
          {unread > 0 ? `${unread} njoftime të palexuara.` : "Të gjitha njoftimet janë lexuar."}
        </p>
      </header>

      {result.items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Asnjë njoftim"
          description="Do të njoftoheni kur ndryshon statusi i raporteve tuaja ose kur dikush komenton."
        />
      ) : (
        <>
          <NotificationList notifications={result.items} hasUnread={unread > 0} />
          <Pagination page={result.page} totalPages={result.totalPages} className="mt-8" />
        </>
      )}
    </div>
  );
}
