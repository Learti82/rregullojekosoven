import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Security panel for a passwordless account.
 *
 * There is no password to change, so this explains how access actually works —
 * otherwise the settings page would simply be missing a section people expect.
 */
export function SecurityInfo({ email }: { email: string }) {
  const points = [
    {
      icon: Mail,
      title: "Kyçje me kod",
      body: `Sa herë që kyçeni, dërgojmë një kod me 6 shifra në ${email}. Kodi skadon pas 10 minutash dhe përdoret vetëm një herë.`,
    },
    {
      icon: KeyRound,
      title: "Pa fjalëkalim",
      body: "Llogaria juaj nuk ka fjalëkalim, prandaj nuk mund të vidhet apo të ripërdoret nga një rrjedhje e faqeve të tjera.",
    },
    {
      icon: ShieldCheck,
      title: "Mbroni email-in tuaj",
      body: "Kushdo që ka qasje në email-in tuaj mund të kyçet. Përdorni verifikim me dy hapa te ofruesi i email-it.",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Siguria e llogarisë</CardTitle>
        <CardDescription>Si funksionon qasja në llogarinë tuaj.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {points.map((point) => (
          <div key={point.title} className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <point.icon className="size-4 text-primary" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium">{point.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
