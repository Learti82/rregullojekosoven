"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Save } from "lucide-react";
import { initials } from "@/lib/utils";
import { useActionToast, fieldError } from "@/hooks/use-action-state";
import { updateProfileAction } from "@/server/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormMessage } from "@/components/ui/form-error";

type UserSettings = {
  name: string;
  email: string;
  username: string;
  image: string | null;
  municipalityId: string | null;
  bio: string;
  phone: string;
  city: string;
  isPublic: boolean;
};

export function ProfileSettingsForm({
  user,
  municipalities,
}: {
  user: UserSettings;
  municipalities: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateProfileAction, null);
  const [municipalityId, setMunicipalityId] = React.useState(user.municipalityId ?? "");
  const [isPublic, setIsPublic] = React.useState(user.isPublic);

  useActionToast(state, { onSuccess: () => router.refresh() });

  return (
    <form action={action}>
      <Card>
        <CardHeader>
          <CardTitle>Profili publik</CardTitle>
          <CardDescription>
            Këto të dhëna shfaqen në faqen tuaj publike të profilit.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {state && !state.success ? <FormMessage>{state.error}</FormMessage> : null}

          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              {user.image ? <AvatarImage src={user.image} alt="" /> : null}
              <AvatarFallback className="text-lg">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium">@{user.username}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Emri i plotë</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={user.name}
              aria-invalid={Boolean(fieldError(state, "name"))}
            />
            <FieldError messages={fieldError(state, "name")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              name="bio"
              rows={3}
              maxLength={500}
              defaultValue={user.bio}
              placeholder="Diçka të shkurtër për ju…"
            />
            <FieldError messages={fieldError(state, "bio")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="municipality">Komuna</Label>
              <Select value={municipalityId} onValueChange={setMunicipalityId}>
                <SelectTrigger id="municipality">
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
              <input type="hidden" name="municipalityId" value={municipalityId} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="city">Qyteti / fshati</Label>
              <Input id="city" name="city" defaultValue={user.city} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefoni (privat)</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={user.phone}
              placeholder="044123456"
              aria-describedby="phone-hint"
            />
            <p id="phone-hint" className="text-xs text-muted-foreground">
              Nuk shfaqet publikisht. Përdoret vetëm nëse komuna ka nevojë t&apos;ju kontaktojë.
            </p>
            <FieldError messages={fieldError(state, "phone")} />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <Label htmlFor="isPublic" className="font-normal">
                Profil publik
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Kur çaktivizohet, raportet tuaja mbeten publike por profili juaj fshihet.
              </p>
            </div>
            <Switch id="isPublic" checked={isPublic} onCheckedChange={setIsPublic} />
            <input type="hidden" name="isPublic" value={String(isPublic)} />
          </div>

          <Button type="submit" loading={pending}>
            <Save /> Ruaj ndryshimet
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
