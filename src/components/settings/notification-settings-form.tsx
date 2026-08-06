"use client";

import * as React from "react";
import { useActionState } from "react";
import { Save } from "lucide-react";
import { useActionToast } from "@/hooks/use-action-state";
import { updateNotificationPreferencesAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function NotificationSettingsForm({
  preferences,
}: {
  preferences: { notifyByEmail: boolean; notifyInApp: boolean };
}) {
  const [state, action, pending] = useActionState(updateNotificationPreferencesAction, null);
  const [byEmail, setByEmail] = React.useState(preferences.notifyByEmail);
  const [inApp, setInApp] = React.useState(preferences.notifyInApp);

  useActionToast(state);

  return (
    <form action={action}>
      <Card>
        <CardHeader>
          <CardTitle>Preferencat e njoftimeve</CardTitle>
          <CardDescription>
            Zgjidhni si dëshironi të njoftoheni për aktivitetin në raportet tuaja.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <Label htmlFor="notifyInApp" className="font-normal">
                Njoftime brenda platformës
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ndryshime statusi, komente dhe përgjigje.
              </p>
            </div>
            <Switch id="notifyInApp" checked={inApp} onCheckedChange={setInApp} />
            <input type="hidden" name="notifyInApp" value={String(inApp)} />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <Label htmlFor="notifyByEmail" className="font-normal">
                Njoftime me email
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Përmbledhje e aktivitetit të rëndësishëm në email-in tuaj.
              </p>
            </div>
            <Switch id="notifyByEmail" checked={byEmail} onCheckedChange={setByEmail} />
            <input type="hidden" name="notifyByEmail" value={String(byEmail)} />
          </div>

          <Button type="submit" loading={pending}>
            <Save /> Ruaj preferencat
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
