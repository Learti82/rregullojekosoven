"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginAction } from "@/server/actions/auth";
import { fieldError } from "@/hooks/use-action-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormMessage } from "@/components/ui/form-error";

export function LoginForm({
  callbackUrl,
  justRegistered,
}: {
  callbackUrl?: string;
  justRegistered?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = React.useState(false);

  // On success the session cookie is already set; refresh so server components
  // pick it up, then move to the requested destination.
  React.useEffect(() => {
    if (state?.success) {
      router.refresh();
      router.push(state.data.redirectTo);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {justRegistered ? (
        <FormMessage variant="success">
          Llogaria u krijua me sukses. Kyçuni për të vazhduar.
        </FormMessage>
      ) : null}

      {state && !state.success ? <FormMessage>{state.error}</FormMessage> : null}

      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="ju@shembull.com"
          aria-describedby="email-error"
          aria-invalid={Boolean(fieldError(state, "email"))}
        />
        <FieldError id="email-error" messages={fieldError(state, "email")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Fjalëkalimi</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="pr-10"
            aria-describedby="password-error"
            aria-invalid={Boolean(fieldError(state, "password"))}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Fshih fjalëkalimin" : "Shfaq fjalëkalimin"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <FieldError id="password-error" messages={fieldError(state, "password")} />
      </div>

      <Button type="submit" className="w-full" size="lg" loading={pending}>
        <LogIn /> Kyçu
      </Button>
    </form>
  );
}
