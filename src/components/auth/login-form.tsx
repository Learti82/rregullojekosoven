"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { ArrowLeft, KeyRound, Mail, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { requestLoginCodeAction, verifyLoginCodeAction } from "@/server/actions/auth";
import { fieldError } from "@/hooks/use-action-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormMessage } from "@/components/ui/form-error";

/** Seconds before a new code may be requested, so resend cannot be spammed. */
const RESEND_COOLDOWN = 45;

/**
 * Passwordless sign-in.
 *
 * Step 1 asks for the email address, step 2 for the six-digit code sent to it.
 * The email is carried between steps in component state rather than the URL, so
 * it never lands in browser history or a shared link.
 */
export function LoginForm({
  callbackUrl,
  justRegistered,
}: {
  callbackUrl?: string;
  justRegistered?: boolean;
  /** Pre-fills the address right after registration. */
  presetEmail?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [stage, setStage] = React.useState<"email" | "code">("email");
  const [cooldown, setCooldown] = React.useState(0);

  const [requestState, requestAction, requesting] = useActionState(
    requestLoginCodeAction,
    null
  );
  const [verifyState, verifyAction, verifying] = useActionState(verifyLoginCodeAction, null);

  // Move to the code step once a code has actually been sent.
  React.useEffect(() => {
    if (requestState?.success) {
      setEmail(requestState.data.email);
      setStage("code");
      setCooldown(RESEND_COOLDOWN);
      if (requestState.message) toast.success(requestState.message);
    }
  }, [requestState]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  React.useEffect(() => {
    if (verifyState?.success) {
      router.refresh();
      router.push(verifyState.data.redirectTo);
    }
  }, [verifyState, router]);

  // ------------------------------------------------------------- step 1
  if (stage === "email") {
    return (
      <form action={requestAction} className="space-y-4" noValidate>
        {justRegistered ? (
          <FormMessage variant="success">
            Llogaria u krijua. Shkruani email-in tuaj për të marrë kodin e kyçjes.
          </FormMessage>
        ) : null}

        {requestState && !requestState.success ? (
          <FormMessage>{requestState.error}</FormMessage>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="ju@shembull.com"
            defaultValue={email}
            aria-describedby="email-error email-hint"
            aria-invalid={Boolean(fieldError(requestState, "email"))}
          />
          <p id="email-hint" className="text-xs text-muted-foreground">
            Do t&apos;ju dërgojmë një kod me 6 shifra. Nuk ka nevojë për fjalëkalim.
          </p>
          <FieldError id="email-error" messages={fieldError(requestState, "email")} />
        </div>

        <Button type="submit" className="w-full" size="lg" loading={requesting}>
          <Mail /> Dërgo kodin
        </Button>
      </form>
    );
  }

  // ------------------------------------------------------------- step 2
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setStage("email")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Ndrysho email-in
      </button>

      <FormMessage variant="success">
        Kodi u dërgua te <strong>{email}</strong>. Kontrolloni edhe dosjen e spamit.
      </FormMessage>

      {verifyState && !verifyState.success ? (
        <FormMessage>{verifyState.error}</FormMessage>
      ) : null}

      <form action={verifyAction} className="space-y-4" noValidate>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

        <div className="space-y-1.5">
          <Label htmlFor="code">Kodi me 6 shifra</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            // Lets phones offer the code straight from the SMS/email notification.
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={7}
            placeholder="123456"
            className="text-center font-mono text-2xl tracking-[0.4em]"
            aria-describedby="code-error"
            aria-invalid={Boolean(fieldError(verifyState, "code"))}
          />
          <FieldError id="code-error" messages={fieldError(verifyState, "code")} />
        </div>

        <Button type="submit" className="w-full" size="lg" loading={verifying}>
          <KeyRound /> Kyçu
        </Button>
      </form>

      <form action={requestAction}>
        <input type="hidden" name="email" value={email} />
        <Button
          type="submit"
          variant="ghost"
          className="w-full"
          disabled={cooldown > 0 || requesting}
          loading={requesting}
        >
          <RotateCcw />
          {cooldown > 0 ? `Dërgo kod të ri pas ${cooldown}s` : "Dërgo kod të ri"}
        </Button>
      </form>
    </div>
  );
}
