"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAssignmentStatusAction } from "@/server/actions/moderation";
import { Button } from "@/components/ui/button";

type AssignmentStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";

const OPTIONS: { value: AssignmentStatus; label: string }[] = [
  { value: "OPEN", label: "E hapur" },
  { value: "IN_PROGRESS", label: "Në proces" },
  { value: "DONE", label: "E përfunduar" },
  { value: "CANCELLED", label: "Anulo" },
];

export function AssignmentStatusControl({
  assignmentId,
  current,
}: {
  assignmentId: string;
  current: AssignmentStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const update = (status: AssignmentStatus) => {
    startTransition(async () => {
      const result = await updateAssignmentStatusAction(assignmentId, status);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Detyra u përditësua.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {OPTIONS.filter((option) => option.value !== current).map((option) => (
        <Button
          key={option.value}
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => update(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
