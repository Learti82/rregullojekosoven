"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { cn, truncate } from "@/lib/utils";
import { RelativeTime } from "@/components/ui/relative-time";
import {
  approveManyAction,
  approveReportAction,
  rejectReportAction,
} from "@/server/actions/moderation-queue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/form-error";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PendingReport = {
  id: string;
  slug: string;
  reference: string;
  title: string;
  description: string;
  address: string | null;
  latitude: number;
  longitude: number;
  isAnonymous: boolean;
  createdAt: Date;
  category: { name: string; color: string };
  municipality: { name: string };
  createdBy: { name: string | null; username: string };
  images: { id: string; url: string; caption: string | null }[];
};

/**
 * The admin approval queue.
 *
 * Selection state lives here rather than in the URL: a moderator works through
 * a page, and a reload mid-review should start clean rather than restore a
 * half-finished set of ticks.
 */
export function ModerationQueue({ reports }: { reports: PendingReport[] }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingBulk, startBulk] = React.useTransition();

  // Reports that disappear after a decision must not linger in the selection,
  // or a later bulk approve would send ids that no longer qualify.
  React.useEffect(() => {
    setSelected((current) => {
      const ids = new Set(reports.map((report) => report.id));
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [reports]);

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allSelected = reports.length > 0 && selected.size === reports.length;

  const approveSelected = () => {
    const ids = [...selected];
    startBulk(async () => {
      const result = await approveManyAction(ids);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Raportet u miratuan.");
      setSelected(new Set());
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) =>
              setSelected(checked === true ? new Set(reports.map((r) => r.id)) : new Set())
            }
            aria-label="Zgjidh të gjitha raportet në këtë faqe"
          />
          {selected.size > 0 ? `${selected.size} të zgjedhura` : "Zgjidh të gjitha"}
        </label>

        <Button
          size="sm"
          onClick={approveSelected}
          disabled={selected.size === 0 || pendingBulk}
        >
          <Check className="size-4" aria-hidden />
          {pendingBulk ? "Duke miratuar…" : `Mirato të zgjedhurat`}
        </Button>
      </div>

      <ul className="space-y-4">
        {reports.map((report) => (
          <li key={report.id}>
            <ModerationCard
              report={report}
              selected={selected.has(report.id)}
              onSelectedChange={(checked) => toggle(report.id, checked)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModerationCard({
  report,
  selected,
  onSelectedChange,
}: {
  report: PendingReport;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [rejectOpen, setRejectOpen] = React.useState(false);

  const approve = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("reportId", report.id);
      const result = await approveReportAction(null, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Raporti u miratua.");
      router.refresh();
    });
  };

  return (
    <article
      className={cn(
        "rounded-xl border bg-card transition-colors",
        selected && "border-primary/60 bg-primary/[0.03]"
      )}
    >
      <div className="flex gap-4 p-4">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectedChange(checked === true)}
          className="mt-1 shrink-0"
          aria-label={`Zgjidh raportin ${report.title}`}
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              style={{ borderColor: `${report.category.color}66`, color: report.category.color }}
            >
              {report.category.name}
            </Badge>
            <span className="text-xs text-muted-foreground">{report.municipality.name}</span>
            <span aria-hidden className="text-xs text-muted-foreground">
              ·
            </span>
            <RelativeTime date={report.createdAt} className="text-xs text-muted-foreground" />
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {report.reference}
            </span>
          </div>

          <div>
            <h2 className="font-semibold leading-snug">{report.title}</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
              {truncate(report.description, 400)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {report.address ?? `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`}
            </span>
            <span>
              Autori:{" "}
              {report.isAnonymous
                ? `Anonim (${report.createdBy.username})`
                : (report.createdBy.name ?? report.createdBy.username)}
            </span>
          </div>

          {report.images.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {report.images.map((image) => (
                <li key={image.id}>
                  <Image
                    src={image.url}
                    alt={image.caption ?? `Foto e raportit ${report.reference}`}
                    width={112}
                    height={84}
                    className="h-[84px] w-28 rounded-lg border object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" onClick={approve} disabled={pending}>
              <Check className="size-4" aria-hidden />
              Mirato
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRejectOpen(true)}
              disabled={pending}
            >
              <X className="size-4" aria-hidden />
              Refuzo
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/reports/${report.slug}`} target="_blank" rel="noreferrer">
                Shiko të plotë
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <RejectDialog
        report={report}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onRejected={() => router.refresh()}
      />
    </article>
  );
}

function RejectDialog({
  report,
  open,
  onOpenChange,
  onRejected,
}: {
  report: PendingReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRejected: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const submit = (formData: FormData) => {
    setError(null);
    formData.set("reportId", report.id);
    startTransition(async () => {
      const result = await rejectReportAction(null, formData);
      if (!result.success) {
        setError(result.fieldErrors?.note?.[0] ?? result.error);
        return;
      }
      toast.success(result.message ?? "Raporti u refuzua.");
      onOpenChange(false);
      onRejected();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={submit}>
          <DialogHeader>
            <DialogTitle>Refuzo raportin</DialogTitle>
            <DialogDescription>
              &ldquo;{truncate(report.title, 80)}&rdquo; nuk do të publikohet. Autori e merr
              arsyen tuaj në njoftime, prandaj shkruajeni qartë.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor={`reject-note-${report.id}`}>Arsyeja e refuzimit</Label>
            <Textarea
              id={`reject-note-${report.id}`}
              name="note"
              rows={4}
              maxLength={500}
              required
              placeholder="P.sh. raporti nuk përmban vendndodhje të saktë, ose përsërit një raport ekzistues."
            />
            <FieldError
              id={`reject-note-error-${report.id}`}
              messages={error ? [error] : undefined}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anulo
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Duke refuzuar…" : "Refuzo raportin"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
