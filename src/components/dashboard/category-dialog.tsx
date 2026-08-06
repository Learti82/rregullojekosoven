"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useActionToast } from "@/hooks/use-action-state";
import { deleteCategoryAction, upsertCategoryAction } from "@/server/actions/admin";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form-error";

type Category = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
};

export function CategoryDialog({ category }: { category?: Category }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isActive, setIsActive] = React.useState(category?.isActive ?? true);
  const [color, setColor] = React.useState(category?.color ?? "#2563eb");
  const [state, action, pending] = useActionState(upsertCategoryAction, null);

  useActionToast(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {category ? (
          <Button variant="outline" size="sm">
            <Pencil /> Redakto
          </Button>
        ) : (
          <Button>
            <Plus /> Shto kategori
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <form action={action} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{category ? "Redakto kategorinë" : "Shto kategori"}</DialogTitle>
            <DialogDescription>
              Ngjyra përdoret në hartë, në kartelat e raporteve dhe në grafikë.
            </DialogDescription>
          </DialogHeader>

          {state && !state.success ? <FormMessage>{state.error}</FormMessage> : null}

          {category ? <input type="hidden" name="id" value={category.id} /> : null}

          <div className="space-y-1.5">
            <Label htmlFor="c-name">Emri</Label>
            <Input id="c-name" name="name" required defaultValue={category?.name} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-description">Përshkrimi</Label>
            <Textarea
              id="c-description"
              name="description"
              rows={2}
              defaultValue={category?.description ?? ""}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-color">Ngjyra</Label>
              <div className="flex gap-2">
                <input
                  id="c-color"
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border bg-background"
                  aria-label="Zgjidh ngjyrën"
                />
                <Input
                  name="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  pattern="^#[0-9a-fA-F]{6}$"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-icon">Ikona (lucide)</Label>
              <Input id="c-icon" name="icon" defaultValue={category?.icon ?? "alert-triangle"} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-order">Renditja</Label>
              <Input
                id="c-order"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={category?.sortOrder ?? 0}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="c-active" className="font-normal">
              Kategoria është aktive
            </Label>
            <Switch id="c-active" checked={isActive} onCheckedChange={setIsActive} />
            <input type="hidden" name="isActive" value={String(isActive)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Anulo
            </Button>
            <Button type="submit" loading={pending}>
              Ruaj
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteCategoryButton({ id, hasReports }: { id: string; hasReports: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const remove = () => {
    startTransition(async () => {
      const result = await deleteCategoryAction(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Kategoria u fshi.");
      router.refresh();
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          <Trash2 /> Fshij
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Të fshihet kategoria?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasReports
              ? "Kjo kategori ka raporte ekzistuese, prandaj do të çaktivizohet në vend që të fshihet."
              : "Ky veprim nuk mund të zhbëhet."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anulo</AlertDialogCancel>
          <AlertDialogAction onClick={remove} disabled={pending}>
            Vazhdo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
