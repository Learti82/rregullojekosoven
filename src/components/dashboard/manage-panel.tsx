"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { ClipboardList, Lock, UserPlus, Wrench } from "lucide-react";
import type { InternalNote, ReportStatus } from "@prisma/client";
import { REPORT_STATUS_META, STATUS_TRANSITIONS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { useActionToast } from "@/hooks/use-action-state";
import {
  addInternalNoteAction,
  assignReportAction,
  updateReportStatusAction,
} from "@/server/actions/moderation";
import type { ReportImageInput } from "@/validations/report";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form-error";
import { ImageUploader } from "@/components/uploads/image-uploader";

type Staff = {
  id: string;
  name: string;
  username: string;
  role: { name: string; label: string };
  _count: { assignmentsOwned: number };
};

/**
 * Municipality control panel, rendered inline on the report page for staff.
 *
 * The status list is derived from `STATUS_TRANSITIONS` so the UI can only offer
 * moves the server would accept — the server re-checks regardless.
 */
export function ManagePanel({
  report,
  staff,
  internalNotes,
  uploadsEnabled,
}: {
  report: { id: string; status: ReportStatus; municipalityId: string };
  staff: Staff[];
  internalNotes: InternalNote[];
  uploadsEnabled: boolean;
}) {
  const router = useRouter();

  const [statusState, statusAction, statusPending] = useActionState(
    updateReportStatusAction,
    null
  );
  const [assignState, assignAction, assignPending] = useActionState(assignReportAction, null);
  const [noteState, noteAction, notePending] = useActionState(addInternalNoteAction, null);

  const [nextStatus, setNextStatus] = React.useState<ReportStatus | "">("");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [proofImages, setProofImages] = React.useState<ReportImageInput[]>([]);

  useActionToast(statusState, { onSuccess: () => router.refresh() });
  useActionToast(assignState, { onSuccess: () => router.refresh() });
  useActionToast(noteState, { onSuccess: () => router.refresh() });

  const allowed = STATUS_TRANSITIONS[report.status] ?? [];
  const requiresNote = nextStatus === "REJECTED";
  const showProofUpload =
    uploadsEnabled && (nextStatus === "IN_PROGRESS" || nextStatus === "COMPLETED");

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="size-4 text-primary" aria-hidden />
          Paneli i menaxhimit
        </CardTitle>
        <CardDescription>
          I dukshëm vetëm për stafin e komunës dhe administratorët.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="status">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="status">Statusi</TabsTrigger>
            <TabsTrigger value="assign">Cakto</TabsTrigger>
            <TabsTrigger value="notes">
              Shënime
              {internalNotes.length > 0 ? (
                <span className="tabular-nums">({internalNotes.length})</span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            <form
              action={(formData) => {
                formData.set("reportId", report.id);
                formData.set("images", JSON.stringify(proofImages));
                statusAction(formData);
              }}
              className="space-y-4"
            >
              {statusState && !statusState.success ? (
                <FormMessage>{statusState.error}</FormMessage>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="status">Statusi i ri</Label>
                <Select
                  value={nextStatus}
                  onValueChange={(value) => setNextStatus(value as ReportStatus)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Zgjidhni statusin" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowed.map((status) => (
                      <SelectItem key={status} value={status}>
                        {REPORT_STATUS_META[status].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="status" value={nextStatus} />
                {allowed.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nga statusi aktual nuk ka kalime të lejuara.
                  </p>
                ) : null}
              </div>

              {nextStatus === "DUPLICATE" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="duplicateOfId">ID e raportit origjinal</Label>
                  <Input
                    id="duplicateOfId"
                    name="duplicateOfId"
                    placeholder="cuid i raportit origjinal"
                  />
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="note">
                  Shënim publik {requiresNote ? "(i detyrueshëm)" : "(opsional)"}
                </Label>
                <Textarea
                  id="note"
                  name="note"
                  rows={3}
                  required={requiresNote}
                  placeholder={
                    requiresNote
                      ? "Shpjegoni pse po refuzohet ky raport…"
                      : "Ky shënim u shfaqet qytetarëve në historikun e raportit."
                  }
                />
              </div>

              {showProofUpload ? (
                <ImageUploader
                  onChange={setProofImages}
                  prefix="progress"
                  max={4}
                  label={nextStatus === "COMPLETED" ? "Prova e përfundimit" : "Foto të punimeve"}
                  hint="Fotot e punës rrisin besimin e qytetarëve në komunë."
                />
              ) : null}

              <Button type="submit" loading={statusPending} disabled={!nextStatus}>
                Përditëso statusin
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="assign">
            <form
              action={(formData) => {
                formData.set("reportId", report.id);
                assignAction(formData);
              }}
              className="space-y-4"
            >
              {assignState && !assignState.success ? (
                <FormMessage>{assignState.error}</FormMessage>
              ) : null}

              {staff.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Kjo komunë nuk ka ende punonjës të regjistruar në platformë.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="assigneeId">Punonjësi</Label>
                    <Select value={assigneeId} onValueChange={setAssigneeId}>
                      <SelectTrigger id="assigneeId">
                        <SelectValue placeholder="Zgjidhni punonjësin" />
                      </SelectTrigger>
                      <SelectContent>
                        {staff.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name} · {member._count.assignmentsOwned} detyra
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input type="hidden" name="assigneeId" value={assigneeId} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="dueAt">Afati (opsional)</Label>
                      <Input id="dueAt" name="dueAt" type="date" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="assign-note">Udhëzime (opsionale)</Label>
                    <Textarea id="assign-note" name="note" rows={2} />
                  </div>

                  <Button type="submit" loading={assignPending} disabled={!assigneeId}>
                    <UserPlus /> Cakto detyrën
                  </Button>
                </>
              )}
            </form>
          </TabsContent>

          <TabsContent value="notes">
            <div className="space-y-5">
              <form
                action={(formData) => {
                  formData.set("reportId", report.id);
                  noteAction(formData);
                }}
                className="space-y-3"
              >
                {noteState && !noteState.success ? (
                  <FormMessage>{noteState.error}</FormMessage>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="internal-note" className="flex items-center gap-1.5">
                    <Lock className="size-3.5" aria-hidden />
                    Shënim i brendshëm
                  </Label>
                  <Textarea
                    id="internal-note"
                    name="body"
                    rows={3}
                    required
                    placeholder="I dukshëm vetëm për stafin komunal — nuk u shfaqet qytetarëve."
                  />
                </div>

                <Button type="submit" size="sm" loading={notePending}>
                  <ClipboardList /> Ruaj shënimin
                </Button>
              </form>

              {internalNotes.length > 0 ? (
                <ul className="space-y-3 border-t pt-4">
                  {internalNotes.map((note) => (
                    <li key={note.id} className="rounded-lg bg-muted/60 p-3">
                      <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                      <time
                        dateTime={note.createdAt.toISOString()}
                        className="mt-1.5 block text-xs text-muted-foreground"
                      >
                        {formatDateTime(note.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
