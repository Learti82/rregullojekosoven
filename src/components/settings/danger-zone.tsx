"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAccountAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function DangerZone() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const remove = () => {
    startTransition(async () => {
      const result = await deleteAccountAction();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Llogaria u fshi.");
      router.push("/");
      router.refresh();
    });
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Fshirja e llogarisë</CardTitle>
        <CardDescription>
          Llogaria juaj fshihet përgjithmonë. Raportet mbeten publike për interesin e komunitetit,
          por shkëputen nga identiteti juaj dhe shfaqen si anonime.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 /> Fshij llogarinë time
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>A jeni i sigurt?</AlertDialogTitle>
              <AlertDialogDescription>
                Ky veprim nuk mund të zhbëhet. Do të shkyçeni menjëherë dhe komentet tuaja do të
                fshihen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anulo</AlertDialogCancel>
              <AlertDialogAction onClick={remove} disabled={pending}>
                Po, fshije llogarinë
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
