"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { truncate } from "@/lib/utils";
import { adminDeleteReportAction } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function AdminDeleteReportButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const remove = () => {
    startTransition(async () => {
      const result = await adminDeleteReportAction(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Raporti u fshi.");
      router.refresh();
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Fshij raportin ${title}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Të fshihet raporti?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{truncate(title, 80)}&rdquo; do të fshihet përfundimisht, bashkë me komentet,
            votat dhe historikun e tij.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anulo</AlertDialogCancel>
          <AlertDialogAction onClick={remove} disabled={pending}>
            Fshij përfundimisht
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
