import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { logLogin } from "./audit";
import { bootAuthEnv } from "./auth-env";
import { normalizeLoginEmail } from "./auth-login";
import { isMissingDatabaseUrlError, readDatabaseUrl } from "./db-url";

// next-auth parseUrl throws on NEXTAUTH_URL="" (Vercel Preview empty override).
// v4 needs NEXTAUTH_SECRET; Vercel often only has AUTH_SECRET.
const { secret: authSecret } = bootAuthEnv();

const WEB_LOGIN_ROLES = [
  "ADMIN",
  "SUPER_ADMIN",
  "EDITOR",
  "SPECIALIST",
  "CLIENT",
  "BROKER",
  "MANUFACTURER",
] as const;

export const authOptions: NextAuthOptions = {
  secret: authSecret || undefined,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        if (!readDatabaseUrl()) {
          console.error("[auth] DATABASE_URL is not set");
          throw new Error("DATABASE_URL is not set");
        }

        const email = normalizeLoginEmail(credentials.email);

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email },
          });
        } catch (err) {
          console.error("[auth] authorize prisma failed", err);
          if (isMissingDatabaseUrlError(err)) {
            throw new Error("DATABASE_URL is not set");
          }
          throw err;
        }

        if (!user) {
          return null;
        }

        if (!user.password) {
          const adminEmail = process.env.ADMIN_EMAIL;
          const adminPassword = process.env.ADMIN_PASSWORD;

          if (
            email === (adminEmail || "").trim().toLowerCase() &&
            credentials.password === adminPassword &&
            (user.role === "ADMIN" || user.role === "SUPER_ADMIN")
          ) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await prisma.user.update({
              where: { id: user.id },
              data: { password: hashedPassword },
            });
            return {
              id: user.id,
              email: user.email!,
              name: user.name || "Admin",
              role: user.role,
            };
          }
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        if (!WEB_LOGIN_ROLES.includes(user.role as (typeof WEB_LOGIN_ROLES)[number])) {
          return null;
        }

        logLogin(user.id, user.name || user.email || "Unknown", user.role);

        return {
          id: user.id,
          email: user.email!,
          name: user.name || "User",
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string; id?: string }).role = token.role as string;
        (session.user as { role?: string; id?: string }).id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
