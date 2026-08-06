import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { getCurrentUserSettings } from "@/server/queries/users";
import { getMunicipalities } from "@/server/queries/taxonomy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { PasswordSettingsForm } from "@/components/settings/password-settings-form";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { DangerZone } from "@/components/settings/danger-zone";

export const metadata: Metadata = {
  title: "Cilësimet",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login?callbackUrl=/settings");

  const [user, municipalities] = await Promise.all([
    getCurrentUserSettings(session.id),
    getMunicipalities(),
  ]);
  if (!user) redirect("/login");

  return (
    <div className="container max-w-3xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Cilësimet</h1>
        <p className="mt-1.5 text-muted-foreground">
          Menaxhoni profilin, sigurinë dhe preferencat e njoftimeve.
        </p>
      </header>

      <Tabs defaultValue="profile">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="profile">Profili</TabsTrigger>
          <TabsTrigger value="notifications">Njoftimet</TabsTrigger>
          <TabsTrigger value="security">Siguria</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <ProfileSettingsForm
            user={{
              name: user.name,
              email: user.email,
              username: user.username,
              image: user.image,
              municipalityId: user.municipalityId,
              bio: user.profile?.bio ?? "",
              phone: user.profile?.phone ?? "",
              city: user.profile?.city ?? "",
              isPublic: user.profile?.isPublic ?? true,
            }}
            municipalities={municipalities}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettingsForm
            preferences={{
              notifyByEmail: user.profile?.notifyByEmail ?? true,
              notifyInApp: user.profile?.notifyInApp ?? true,
            }}
          />
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          {user.passwordHash ? <PasswordSettingsForm /> : null}
          <DangerZone />
        </TabsContent>
      </Tabs>
    </div>
  );
}
