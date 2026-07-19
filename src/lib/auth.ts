import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "./db";

export async function getSession() {
  try {
    return await auth();
  } catch {
    return null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        name: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const user = await db.user.findUnique({
          where: { name: credentials.name as string },
        });
        if (!user) return null;
        if (user.password !== credentials.password) return null;
        return { id: user.id, name: user.name };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  jwt: {
    maxAge: 7 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { tokenVersion: true },
        });
        token.tokenVersion = dbUser?.tokenVersion ?? 0;
      }
      if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, tokenVersion: true },
        });
        if (!dbUser) {
          return { ...token, error: "token_revoked" };
        }
        token.name = dbUser.name;
        if (dbUser.tokenVersion !== token.tokenVersion) {
          return { ...token, error: "token_revoked" };
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.error === "token_revoked") {
        session.user = null as any;
        return session;
      }
      session.user.id = token.id as string;
      if (token.name) session.user.name = token.name as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
