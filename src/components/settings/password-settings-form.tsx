"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { useActionToast, fieldError } from "@/hooks/use-action-state";
import { changePasswordAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormMessage } from "@/components/ui/form-error";

export function PasswordSettingsForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  useActionToast(state);

  return (
    <form action={action}>
      <Card>
        <CardHeader>
          <CardTitle>Ndrysho fjalëkalimin</CardTitle>
          <CardDescription>
            Përdorni një fjalëkalim të gjatë dhe unik për këtë llogari.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {state && !state.success ? <FormMessage>{state.error}</FormMessage> : null}

          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Fjalëkalimi aktual</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
            <FieldError messages={fieldError(state, "currentPassword")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">Fjalëkalimi i ri</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
            />
            <FieldError messages={fieldError(state, "newPassword")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Konfirmo fjalëkalimin e ri</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
            <FieldError messages={fieldError(state, "confirmPassword")} />
          </div>

          <Button type="submit" loading={pending}>
            <KeyRound /> Ndrysho fjalëkalimin
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
