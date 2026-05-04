import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb } from "../../../lib/db";

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    CredentialsProvider({
      name: "Email & Mot de passe",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "").trim();
        if (!email || !password) return null;

        const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
        const adminPassword = String(process.env.ADMIN_PASSWORD || "").trim();
        if (adminEmail && adminPassword && email === adminEmail) {
          if (password !== adminPassword) return null;
          return { id: "admin", email: adminEmail, name: "Admin", role: "admin", clientId: null };
        }

        const db = await getDb();
        const client = await db.collection("clients").findOne({ loginEmail: email, active: true });
        if (!client || !client.passwordHash) return null;
        const ok = await bcrypt.compare(password, client.passwordHash);
        if (!ok) return null;
        return { id: client._id.toString(), email: client.loginEmail, name: client.name, role: "client", clientId: client._id.toString() };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.clientId = user.clientId || null;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user) session.user = {};
      session.user.role = token.role;
      session.user.clientId = token.clientId;
      session.user.name = token.name;
      session.user.email = token.email;
      return session;
    },
  },
};

export default NextAuth(authOptions);