"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Mail, UserPlus } from "lucide-react";
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

export function RegisterForm({ municipalities }: { municipalities: Municipality[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(registerAction, null);
  const [municipalityId, setMunicipalityId] = React.useState("");

  React.useEffect(() => {
    if (state?.success) router.push(`/login?registered=1`);
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

      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
        <p className="flex items-start gap-2 text-muted-foreground">
          <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            Nuk ka fjalëkalim. Sa herë që kyçeni, ju dërgojmë një kod me 6 shifra
            në këtë email.
          </span>
        </p>
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
