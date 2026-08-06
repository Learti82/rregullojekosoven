import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireMunicipalityScope } from "@/lib/permissions";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/reports/status-badge";
import { AssignmentStatusControl } from "@/components/dashboard/assignment-status-control";

export const metadata: Metadata = {
  title: "Detyrat",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "E hapur",
  IN_PROGRESS: "Në proces",
  DONE: "E përfunduar",
  CANCELLED: "E anuluar",
};

export default async function AssignmentsPage() {
  const user = await requireMunicipalityScope();

  const assignments = await prisma.employeeAssignment.findMany({
    where: {
      ...(user.scopedMunicipalityId ? { municipalityId: user.scopedMunicipalityId } : {}),
      // Employees see only their own queue; municipal admins see everything.
      ...(user.role === "MUNICIPALITY_EMPLOYEE" ? { assigneeId: user.id } : {}),
    },
    include: {
      report: { select: { id: true, slug: true, title: true, status: true, reference: true } },
      assignee: { select: { id: true, name: true, username: true } },
      assignedBy: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Detyrat</h1>
        <p className="mt-1.5 text-muted-foreground">
          {user.role === "MUNICIPALITY_EMPLOYEE"
            ? "Raportet që ju janë caktuar."
            : "Të gjitha detyrat aktive të komunës."}
        </p>
      </header>

      {assignments.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Asnjë detyrë aktive"
          description="Detyrat shfaqen këtu sapo t'ju caktohet një raport."
        />
      ) : (
        <ul className="space-y-3">
          {assignments.map((assignment) => {
            const overdue =
              assignment.dueAt &&
              assignment.dueAt < new Date() &&
              assignment.status !== "DONE" &&
              assignment.status !== "CANCELLED";

            return (
              <li key={assignment.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/reports/${assignment.report.slug}`}
                      className="font-medium hover:text-primary"
                    >
                      {assignment.report.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {assignment.report.reference} · caktuar nga {assignment.assignedBy.name} ·{" "}
                      {formatRelativeTime(assignment.createdAt)}
                    </p>
                    {assignment.note ? (
                      <p className="mt-2 text-sm text-muted-foreground">{assignment.note}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={assignment.report.status} showDot={false} />
                    <Badge variant={assignment.status === "DONE" ? "success" : "secondary"}>
                      {STATUS_LABELS[assignment.status]}
                    </Badge>
                    {assignment.dueAt ? (
                      <Badge variant={overdue ? "destructive" : "outline"}>
                        Afati: {formatDate(assignment.dueAt, "d MMM")}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <AssignmentStatusControl
                    assignmentId={assignment.id}
                    current={assignment.status}
                  />
                  <Button size="sm" variant="ghost" asChild className="ml-auto">
                    <Link href={`/reports/${assignment.report.slug}`}>Hap raportin</Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
