import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CopyCheck,
  Eye,
  Hash,
  MapPin,
  ShieldAlert,
  Tag,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canManageReport } from "@/lib/permissions";
import {
  getRelatedReports,
  getReportBySlug,
  incrementViewCount,
} from "@/server/queries/reports";
import { getCommentTree } from "@/server/queries/comments";
import { getMunicipalityStaff } from "@/server/queries/users";
import { REPORT_STATUS_META } from "@/lib/constants";
import { absoluteUrl, formatDateTime, formatNumber, initials, truncate } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PriorityBadge, StatusBadge } from "@/components/reports/status-badge";
import { VoteButton } from "@/components/reports/vote-button";
import { FollowButton } from "@/components/reports/follow-button";
import { ShareButton } from "@/components/reports/share-button";
import { ReportGallery } from "@/components/reports/report-gallery";
import { StatusTimeline } from "@/components/reports/status-timeline";
import { ReportCard } from "@/components/reports/report-card";
import { CommentSection } from "@/components/comments/comment-section";
import { ManagePanel } from "@/components/dashboard/manage-panel";
import { SingleReportMap } from "@/components/map/dynamic-map";
import { AdSlot } from "@/components/ads/ad-slot";

/**
 * NOTE: this route must not gain a `loading.tsx` (here or in any ancestor
 * segment). A `loading.tsx` wraps the segment in a Suspense boundary, which
 * commits the HTTP response before rendering finishes — `notFound()` would then
 * render the not-found UI with a 200 status, turning every missing report into
 * a soft 404 that search engines happily index.
 */
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const report = await getReportBySlug(slug);
  if (!report) return { title: "Raporti nuk u gjet" };

  const description = truncate(report.description, 160);
  const image = report.images[0]?.url;

  return {
    title: report.title,
    description,
    alternates: { canonical: `/reports/${report.slug}` },
    // Only the author and staff can load an unapproved report, but a crawler
    // that gets the URL some other way must not index a page the public cannot
    // see — and must not keep it cached if it is later rejected.
    ...(report.moderationStatus === "APPROVED"
      ? {}
      : { robots: { index: false, follow: false } }),
    openGraph: {
      type: "article",
      title: report.title,
      description,
      url: absoluteUrl(`/reports/${report.slug}`),
      publishedTime: report.createdAt.toISOString(),
      modifiedTime: report.updatedAt.toISOString(),
      images: image ? [{ url: image, alt: report.title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: report.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ReportDetailPage({ params }: Props) {
  const { slug } = await params;
  const report = await getReportBySlug(slug);
  if (!report) notFound();

  const viewer = await getCurrentUser();
  const canManage = viewer ? canManageReport(viewer, report) : false;

  const [comments, related, staff, internalNotes] = await Promise.all([
    getCommentTree(report.id),
    getRelatedReports(report),
    canManage ? getMunicipalityStaff(report.municipalityId) : Promise.resolve([]),
    canManage
      ? prisma.internalNote.findMany({
          where: { reportId: report.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  // Not awaited: the counter must never delay the render.
  void incrementViewCount(report.id);

  const originalImages = report.images.filter((image) => image.kind === "ORIGINAL");
  const progressImages = report.images.filter((image) => image.kind !== "ORIGINAL");
  const statusMeta = REPORT_STATUS_META[report.status];

  // Structured data helps the report surface in search results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Report",
    headline: report.title,
    description: truncate(report.description, 300),
    datePublished: report.createdAt.toISOString(),
    dateModified: report.updatedAt.toISOString(),
    url: absoluteUrl(`/reports/${report.slug}`),
    image: report.images[0]?.url,
    author: report.isAnonymous
      ? { "@type": "Person", name: "Anonim" }
      : { "@type": "Person", name: report.createdBy.name },
    contentLocation: {
      "@type": "Place",
      name: report.address ?? report.municipality.name,
      geo: {
        "@type": "GeoCoordinates",
        latitude: report.latitude,
        longitude: report.longitude,
      },
    },
  };

  return (
    <div className="container max-w-6xl">
      <script
        type="application/ld+json"
        // Serialised from server-controlled values only.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Shtegu" className="mb-6 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/explore" className="hover:text-foreground">
              Raportet
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link
              href={`/explore?municipality=${report.municipality.slug}`}
              className="hover:text-foreground"
            >
              {report.municipality.name}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="truncate text-foreground" aria-current="page">
            {truncate(report.title, 40)}
          </li>
        </ol>
      </nav>

      {report.moderationStatus !== "APPROVED" ? (
        <Alert
          variant={report.moderationStatus === "REJECTED" ? "destructive" : "default"}
          className="mb-6"
        >
          <ShieldAlert className="size-4" />
          <AlertTitle>
            {report.moderationStatus === "REJECTED"
              ? "Ky raport nuk u publikua"
              : "Ky raport është duke u shqyrtuar"}
          </AlertTitle>
          <AlertDescription>
            {report.moderationStatus === "REJECTED"
              ? (report.moderationNote ??
                "Administratori nuk e miratoi këtë raport për publikim.")
              : "Vetëm ju dhe administratorët e shihni këtë faqe. Sapo të miratohet, do të shfaqet në hartë, në kërkim dhe te raportet publike."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <article className="min-w-0 space-y-8">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={report.status} />
              <PriorityBadge priority={report.priority} />
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: report.category.color }}
              >
                <Tag className="size-3" aria-hidden />
                {report.category.name}
              </span>
            </div>

            <h1 className="text-balance font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {report.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Hash className="size-4" aria-hidden />
                {report.reference}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4" aria-hidden />
                <time dateTime={report.createdAt.toISOString()}>
                  {formatDateTime(report.createdAt)}
                </time>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye className="size-4" aria-hidden />
                {formatNumber(report.viewsCount)} shikime
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-y py-4">
              <VoteButton
                reportId={report.id}
                score={report.score}
                viewerVote={report.viewerVote ?? null}
                isAuthenticated={Boolean(viewer)}
                orientation="horizontal"
              />
              <FollowButton
                reportId={report.id}
                following={report.viewerFollows ?? false}
                followersCount={report.followersCount}
                isAuthenticated={Boolean(viewer)}
              />
              <ShareButton
                title={report.title}
                url={absoluteUrl(`/reports/${report.slug}`)}
              />
            </div>
          </header>

          {report.status === "DUPLICATE" && report.duplicateOf ? (
            <Alert variant="info">
              <CopyCheck />
              <AlertTitle>Ky raport është shënuar si dublikat</AlertTitle>
              <AlertDescription>
                Problemi origjinal ndiqet te{" "}
                <Link
                  href={`/reports/${report.duplicateOf.slug}`}
                  className="font-medium underline underline-offset-2"
                >
                  {report.duplicateOf.title}
                </Link>
                .
              </AlertDescription>
            </Alert>
          ) : null}

          {report.status === "REJECTED" && report.rejectionReason ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Raporti u refuzua</AlertTitle>
              <AlertDescription>{report.rejectionReason}</AlertDescription>
            </Alert>
          ) : null}

          {originalImages.length > 0 ? (
            <ReportGallery images={originalImages} title={report.title} />
          ) : null}

          <section aria-labelledby="description-heading">
            <h2 id="description-heading" className="sr-only">
              Përshkrimi
            </h2>
            <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {report.description}
            </div>
          </section>

          {progressImages.length > 0 ? (
            <section aria-labelledby="progress-heading" className="space-y-3">
              <h2 id="progress-heading" className="font-display text-lg font-semibold">
                Dokumentimi i punës
              </h2>
              <ReportGallery images={progressImages} title="Dokumentimi i punës" />
            </section>
          ) : null}

          {report.status === "COMPLETED" && report.resolutionNote ? (
            <Alert variant="success">
              <AlertTitle>Shënimi i zgjidhjes</AlertTitle>
              <AlertDescription>{report.resolutionNote}</AlertDescription>
            </Alert>
          ) : null}

          <Separator />

          <StatusTimeline history={report.statusHistory} createdAt={report.createdAt} />

          {canManage && viewer ? (
            <ManagePanel
              report={{
                id: report.id,
                status: report.status,
                municipalityId: report.municipalityId,
              }}
              staff={staff}
              internalNotes={internalNotes}
              uploadsEnabled
            />
          ) : null}

          <Separator />

          <CommentSection reportId={report.id} comments={comments} viewer={viewer} />
        </article>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vendndodhja</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-48 overflow-hidden rounded-lg border">
                <SingleReportMap
                  latitude={report.latitude}
                  longitude={report.longitude}
                  title={report.title}
                  status={report.status}
                  color={report.category.color}
                />
              </div>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {report.address ? `${report.address}, ` : ""}
                  {report.municipality.name}
                </span>
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${report.latitude},${report.longitude}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-block text-sm font-medium text-primary hover:underline"
              >
                Hap në Google Maps →
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Raportuar nga</CardTitle>
            </CardHeader>
            <CardContent>
              {report.isAnonymous ? (
                <p className="text-sm text-muted-foreground">Raport anonim</p>
              ) : (
                <Link
                  href={`/profile/${report.createdBy.username}`}
                  className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-accent"
                >
                  <Avatar>
                    {report.createdBy.image ? (
                      <AvatarImage src={report.createdBy.image} alt="" />
                    ) : null}
                    <AvatarFallback>{initials(report.createdBy.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{report.createdBy.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{report.createdBy.username}
                    </p>
                  </div>
                </Link>
              )}

              <Separator className="my-4" />

              <Link
                href={`/explore?municipality=${report.municipality.slug}`}
                className="flex items-center gap-2 text-sm hover:text-primary"
              >
                <Building2 className="size-4 text-muted-foreground" aria-hidden />
                {/* Label + name, avoiding the genitive form the phrase would need. */}
                <span className="text-muted-foreground">Komuna:</span>{" "}
                {report.municipality.name}
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Statusi aktual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <StatusBadge status={report.status} />
              <p className="text-sm text-muted-foreground">{statusMeta.description}</p>
              {report.resolvedAt ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Zgjidhur më </span>
                  <time dateTime={report.resolvedAt.toISOString()}>
                    {formatDateTime(report.resolvedAt)}
                  </time>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <AdSlot id="report-sidebar" />
        </aside>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="mt-16">
          <h2 id="related-heading" className="font-display text-2xl font-bold tracking-tight">
            Probleme të ngjashme afër
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ReportCard key={item.id} report={item} isAuthenticated={Boolean(viewer)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
