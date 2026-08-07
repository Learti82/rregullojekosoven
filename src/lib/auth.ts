import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { loginSchema } from "@/validations/auth";
import { verifyLoginCode } from "@/lib/login-code";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      // Passwordless: the "credential" is a one-time code emailed to the
      // address. The code is verified here, server-side, so a crafted request
      // cannot bypass the check the UI performs.
      name: "email-code",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Kodi", type: "text" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, code } = parsed.data;

        const outcome = await verifyLoginCode(email, code);
        if (!outcome.ok) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { role: true },
        });
        if (!user || !user.isActive || user.isBanned) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            // Completing a code proves control of the address.
            emailVerified: user.emailVerified ?? new Date(),
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role.name,
          username: user.username,
          municipalityId: user.municipalityId,
        };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      await prisma.activityLog
        .create({
          data: {
            userId: user.id,
            action: "auth.sign_in",
            entityType: "user",
            entityId: user.id,
          },
        })
        .catch(() => {
          // Audit logging must never block sign-in.
        });
    },
  },
});
