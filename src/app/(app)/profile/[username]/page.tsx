import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, CalendarDays, Clock, FileText, MapPin, ThumbsUp } from "lucide-react";
import { getProfileByUsername } from "@/server/queries/users";
import { getOwnPendingReports, getReports } from "@/server/queries/reports";
import { getCurrentUser } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDate, formatNumber, initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { ReportCard } from "@/components/reports/report-card";

/**
 * NOTE: this route must not gain a `loading.tsx` (here or in any ancestor
 * segment). A `loading.tsx` wraps the segment in a Suspense boundary, which
 * commits the HTTP response before rendering finishes — `notFound()` would then
 * render the not-found UI with a 200 status, turning every missing report into
 * a soft 404 that search engines happily index.
 */
type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) return { title: "Profili nuk u gjet" };

  return {
    title: `${profile.name} (@${profile.username})`,
    description: `Raportet dhe kontributi i ${profile.name} në RregulloKosovën.`,
    alternates: { canonical: `/profile/${profile.username}` },
    robots: profile.profile?.isPublic === false ? { index: false, follow: false } : undefined,
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: Props & { searchParams: Promise<{ page?: string }> }) {
  const { username } = await params;
  const { page: pageParam } = await searchParams;

  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === profile.id;

  // Submissions still in (or refused by) the approval queue are invisible in the
  // public list below, so without this the author's own reports simply vanish
  // after they file them.
  const awaitingReview = isOwner ? await getOwnPendingReports(profile.id) : [];

  // A private profile shows only its header to everyone but its owner.
  const isPrivate = profile.profile?.isPublic === false && !isOwner;

  const reports = isPrivate
    ? null
    : await getReports(
        { page: Math.max(1, Number(pageParam) || 1), sort: "recent" },
        { createdById: profile.id, pageSize: 9 }
      );

  return (
    <div className="container max-w-6xl">
      <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar className="size-24 border-4 border-background shadow-elevated">
          {profile.image ? <AvatarImage src={profile.image} alt="" /> : null}
          <AvatarFallback className="text-2xl">{initials(profile.name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold tracking-tight">{profile.name}</h1>
            {profile.role.name !== "CITIZEN" ? (
              <Badge variant="default">{ROLE_LABELS[profile.role.name] ?? profile.role.label}</Badge>
            ) : null}
          </div>

          <p className="mt-1 text-muted-foreground">@{profile.username}</p>

          {profile.profile?.bio ? (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed">
              {profile.profile.bio}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {profile.municipality ? (
              <Link
                href={`/explore?municipality=${profile.municipality.slug}`}
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <MapPin className="size-4" aria-hidden />
                {profile.municipality.name}
              </Link>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />
              Anëtar që nga {formatDate(profile.createdAt, "MMMM yyyy")}
            </span>
          </div>
        </div>
      </header>

      {isPrivate ? (
        <EmptyState
          title="Ky profil është privat"
          description="Përdoruesi ka zgjedhur të mos i shfaqë publikisht raportet e tij."
        />
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Raporte të krijuara"
              value={formatNumber(profile._count.reports)}
              icon={FileText}
            />
            <StatCard
              label="Vota të marra"
              value={formatNumber(profile.profile?.votesReceived ?? 0)}
              icon={ThumbsUp}
              accent="success"
            />
            <StatCard
              label="Probleme të zgjidhura"
              value={formatNumber(profile.profile?.resolvedCount ?? 0)}
              icon={Award}
              accent="primary"
            />
          </div>

          {profile.badges.length > 0 ? (
            <Card className="mb-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Distinktivët</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-wrap gap-3">
                  {profile.badges.map(({ badge, earnedAt }) => (
                    <li
                      key={badge.id}
                      className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2"
                      title={`${badge.description} · fituar më ${formatDate(earnedAt)}`}
                    >
                      <span
                        className="flex size-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${badge.color}20` }}
                        aria-hidden
                      >
                        <Award className="size-4" style={{ color: badge.color }} />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{badge.name}</p>
                        <p className="text-xs text-muted-foreground">{badge.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <section aria-labelledby="user-reports-heading">
            <h2 id="user-reports-heading" className="mb-6 font-display text-2xl font-bold tracking-tight">
              Raportet
            </h2>

            {awaitingReview.length > 0 ? (
              <div className="mb-8 rounded-xl border border-warning/40 bg-warning/5 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="size-4 text-warning" aria-hidden />
                  Në pritje të miratimit ({awaitingReview.length})
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Këto raporte i shihni vetëm ju derisa administratori t&apos;i shqyrtojë.
                </p>
                <ul className="mt-3 divide-y">
                  {awaitingReview.map((item) => (
                    <li key={item.id} className="py-2.5">
                      <Link
                        href={`/reports/${item.slug}`}
                        className="text-sm font-medium hover:text-primary"
                      >
                        {item.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.moderationStatus === "REJECTED"
                          ? `Nuk u publikua — ${item.moderationNote ?? "pa arsye të dhënë"}`
                          : "Duke u shqyrtuar"}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!reports || reports.items.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Ende asnjë raport"
                description={
                  isOwner
                    ? "Raportet që krijoni do të shfaqen këtu."
                    : `${profile.name} nuk ka publikuar ende asnjë raport.`
                }
              />
            ) : (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {reports.items.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      isAuthenticated={Boolean(viewer)}
                    />
                  ))}
                </div>
                <Pagination page={reports.page} totalPages={reports.totalPages} className="mt-10" />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
