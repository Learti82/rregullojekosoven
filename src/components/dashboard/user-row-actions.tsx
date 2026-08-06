"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { MoreHorizontal, Shield, Ban, CircleCheck } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";
import { useActionToast } from "@/hooks/use-action-state";
import { setUserBanAction, updateUserRoleAction } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form-error";

type TargetUser = {
  id: string;
  name: string;
  role: string;
  municipalityId: string | null;
  isBanned: boolean;
};

const MUNICIPAL_ROLES = ["MUNICIPALITY_EMPLOYEE", "MUNICIPALITY_ADMIN"];

export function UserRowActions({
  user,
  municipalities,
}: {
  user: TargetUser;
  municipalities: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [roleOpen, setRoleOpen] = React.useState(false);
  const [banOpen, setBanOpen] = React.useState(false);
  const [role, setRole] = React.useState(user.role);
  const [municipalityId, setMunicipalityId] = React.useState(user.municipalityId ?? "");

  const [roleState, roleAction, rolePending] = useActionState(updateUserRoleAction, null);
  const [banState, banAction, banPending] = useActionState(setUserBanAction, null);

  useActionToast(roleState, {
    onSuccess: () => {
      setRoleOpen(false);
      router.refresh();
    },
  });
  useActionToast(banState, {
    onSuccess: () => {
      setBanOpen(false);
      router.refresh();
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Veprime për ${user.name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRoleOpen(true)}>
            <Shield /> Ndrysho rolin
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setBanOpen(true)}>
            {user.isBanned ? <CircleCheck /> : <Ban />}
            {user.isBanned ? "Hiq bllokimin" : "Blloko përdoruesin"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <form action={roleAction} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Ndrysho rolin</DialogTitle>
              <DialogDescription>
                Përcakto lejet e {user.name} në platformë.
              </DialogDescription>
            </DialogHeader>

            {roleState && !roleState.success ? <FormMessage>{roleState.error}</FormMessage> : null}

            <input type="hidden" name="userId" value={user.id} />

            <div className="space-y-1.5">
              <Label htmlFor={`role-${user.id}`}>Roli</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id={`role-${user.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="role" value={role} />
            </div>

            {MUNICIPAL_ROLES.includes(role) ? (
              <div className="space-y-1.5">
                <Label htmlFor={`municipality-${user.id}`}>Komuna</Label>
                <Select value={municipalityId} onValueChange={setMunicipalityId}>
                  <SelectTrigger id={`municipality-${user.id}`}>
                    <SelectValue placeholder="Zgjidhni komunën" />
                  </SelectTrigger>
                  <SelectContent>
                    {municipalities.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <input type="hidden" name="municipalityId" value={municipalityId} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRoleOpen(false)}>
                Anulo
              </Button>
              <Button type="submit" loading={rolePending}>
                Ruaj
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent>
          <form action={banAction} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {user.isBanned ? "Hiq bllokimin" : "Blloko përdoruesin"}
              </DialogTitle>
              <DialogDescription>
                {user.isBanned
                  ? `${user.name} do të mund të kyçet sërish.`
                  : `${user.name} do të shkyçet menjëherë dhe nuk do të mund të kyçet.`}
              </DialogDescription>
            </DialogHeader>

            {banState && !banState.success ? <FormMessage>{banState.error}</FormMessage> : null}

            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="isBanned" value={String(!user.isBanned)} />

            {!user.isBanned ? (
              <div className="space-y-1.5">
                <Label htmlFor={`reason-${user.id}`}>Arsyeja</Label>
                <Textarea id={`reason-${user.id}`} name="reason" rows={3} required />
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBanOpen(false)}>
                Anulo
              </Button>
              <Button
                type="submit"
                variant={user.isBanned ? "default" : "destructive"}
                loading={banPending}
              >
                {user.isBanned ? "Hiq bllokimin" : "Blloko"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
