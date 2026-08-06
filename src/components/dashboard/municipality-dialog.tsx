"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useActionToast } from "@/hooks/use-action-state";
import { upsertMunicipalityAction } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
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
import { FormMessage } from "@/components/ui/form-error";

type Municipality = {
  id: string;
  name: string;
  region: string;
  population: number | null;
  latitude: number;
  longitude: number;
  email: string | null;
  phone: string | null;
  website: string | null;
  isActive: boolean;
};

export function MunicipalityDialog({ municipality }: { municipality?: Municipality }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isActive, setIsActive] = React.useState(municipality?.isActive ?? true);
  const [state, action, pending] = useActionState(upsertMunicipalityAction, null);

  useActionToast(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {municipality ? (
          <Button variant="outline" size="sm">
            <Pencil /> Redakto
          </Button>
        ) : (
          <Button>
            <Plus /> Shto komunë
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <form action={action} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{municipality ? "Redakto komunën" : "Shto komunë"}</DialogTitle>
            <DialogDescription>
              Koordinatat përcaktojnë qendrën e hartës për këtë komunë.
            </DialogDescription>
          </DialogHeader>

          {state && !state.success ? <FormMessage>{state.error}</FormMessage> : null}

          {municipality ? <input type="hidden" name="id" value={municipality.id} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Emri</Label>
              <Input id="m-name" name="name" required defaultValue={municipality?.name} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-region">Rajoni</Label>
              <Input id="m-region" name="region" required defaultValue={municipality?.region} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-lat">Gjerësia gjeografike</Label>
              <Input
                id="m-lat"
                name="latitude"
                type="number"
                step="0.000001"
                required
                defaultValue={municipality?.latitude}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-lng">Gjatësia gjeografike</Label>
              <Input
                id="m-lng"
                name="longitude"
                type="number"
                step="0.000001"
                required
                defaultValue={municipality?.longitude}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-population">Popullsia</Label>
              <Input
                id="m-population"
                name="population"
                type="number"
                min={0}
                defaultValue={municipality?.population ?? undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-email">Email zyrtar</Label>
              <Input
                id="m-email"
                name="email"
                type="email"
                defaultValue={municipality?.email ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-phone">Telefoni</Label>
              <Input id="m-phone" name="phone" defaultValue={municipality?.phone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-website">Uebfaqja</Label>
              <Input
                id="m-website"
                name="website"
                type="url"
                placeholder="https://…"
                defaultValue={municipality?.website ?? ""}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="m-active" className="font-normal">
              Komuna është aktive
            </Label>
            <Switch id="m-active" checked={isActive} onCheckedChange={setIsActive} />
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
