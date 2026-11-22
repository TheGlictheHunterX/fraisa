import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { canLogin } from "@/lib/core";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const email = credentials.email.trim().toLowerCase();
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user || !canLogin(user)) return null;
          const valid = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!valid) return null;
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.status = token.status;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  // A stale session cookie (e.g. from a previous NEXTAUTH_SECRET) is harmless:
  // NextAuth simply treats the visitor as signed out. Keep the demo console clean.
  logger: {
    error(code, ...message) {
      if (code === "JWT_SESSION_ERROR") return;
      console.error(`[next-auth:${code}]`, ...message);
    },
  },
};
