"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Check, Eye, EyeOff, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { registerAction } from "@/server/actions/auth";
import { fieldError } from "@/hooks/use-action-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError, FormMessage } from "@/components/ui/form-error";

type Municipality = { id: string; name: string };

const RULES = [
  { test: (value: string) => value.length >= 8, label: "Së paku 8 karaktere" },
  { test: (value: string) => /[a-z]/.test(value), label: "Një shkronjë e vogël" },
  { test: (value: string) => /[A-Z]/.test(value), label: "Një shkronjë e madhe" },
  { test: (value: string) => /[0-9]/.test(value), label: "Një numër" },
] as const;

export function RegisterForm({ municipalities }: { municipalities: Municipality[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(registerAction, null);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [municipalityId, setMunicipalityId] = React.useState("");

  React.useEffect(() => {
    if (state?.success) router.push("/login?registered=1");
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state && !state.success ? <FormMessage>{state.error}</FormMessage> : null}

      <div className="space-y-1.5">
        <Label htmlFor="name">Emri i plotë</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          placeholder="Arta Krasniqi"
          aria-invalid={Boolean(fieldError(state, "name"))}
          aria-describedby="name-error"
        />
        <FieldError id="name-error" messages={fieldError(state, "name")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="username">Emri i përdoruesit</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          required
          placeholder="arta_k"
          pattern="[a-z0-9_]+"
          aria-invalid={Boolean(fieldError(state, "username"))}
          aria-describedby="username-error username-hint"
        />
        <p id="username-hint" className="text-xs text-muted-foreground">
          Shkronja të vogla, numra dhe nënvijë. Do të shfaqet në profilin tuaj publik.
        </p>
        <FieldError id="username-error" messages={fieldError(state, "username")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="ju@shembull.com"
          aria-invalid={Boolean(fieldError(state, "email"))}
          aria-describedby="email-error"
        />
        <FieldError id="email-error" messages={fieldError(state, "email")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="municipality">Komuna juaj (opsionale)</Label>
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
        <p className="text-xs text-muted-foreground">
          Përdoret për të personalizuar ballinën tuaj me raportet e afërta.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Fjalëkalimi</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="pr-10"
            aria-invalid={Boolean(fieldError(state, "password"))}
            aria-describedby="password-error password-rules"
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

        {password.length > 0 ? (
          <ul id="password-rules" className="grid gap-1 pt-1 sm:grid-cols-2">
            {RULES.map((rule) => {
              const passed = rule.test(password);
              return (
                <li
                  key={rule.label}
                  className={cn(
                    "flex items-center gap-1.5 text-xs",
                    passed ? "text-success" : "text-muted-foreground"
                  )}
                >
                  {passed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
        ) : null}
        <FieldError id="password-error" messages={fieldError(state, "password")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Konfirmo fjalëkalimin</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(fieldError(state, "confirmPassword"))}
          aria-describedby="confirm-error"
        />
        <FieldError id="confirm-error" messages={fieldError(state, "confirmPassword")} />
      </div>

      <div className="flex items-start gap-2.5 pt-1">
        <Checkbox id="acceptTerms" name="acceptTerms" required className="mt-0.5" />
        <Label htmlFor="acceptTerms" className="text-sm font-normal leading-relaxed">
          Pranoj{" "}
          <Link href="/terms" className="text-primary hover:underline">
            kushtet e përdorimit
          </Link>{" "}
          dhe{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            politikën e privatësisë
          </Link>
          .
        </Label>
      </div>
      <FieldError messages={fieldError(state, "acceptTerms")} />

      <Button type="submit" className="w-full" size="lg" loading={pending}>
        <UserPlus /> Krijo llogarinë
      </Button>
    </form>
  );
}
