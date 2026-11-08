import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getDb, type Role } from '@cmms/db';
import { authenticateUser, LoginCredentialsSchema } from '@cmms/core';

declare module 'next-auth' {
  interface User {
    username: string;
    fullName: string;
    role: Role;
    plantIds: string[];
    rulesVersion: number;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      fullName: string;
      role: Role;
      plantIds: string[];
      rulesVersion: number;
    } & DefaultSession['user'];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'Factory Credentials',
      credentials: {
        username: { label: 'نام کاربری', type: 'text' },
        secret: { label: 'رمز عبور یا پین', type: 'password' },
        mode: { label: 'حالت ورود', type: 'text' },
      },
      async authorize(rawCredentials) {
        const parsed = LoginCredentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const db = getDb();
        const authUser = await authenticateUser(db, parsed.data);
        if (!authUser) return null;

        return {
          id: authUser.id,
          name: authUser.fullName,
          username: authUser.username,
          fullName: authUser.fullName,
          role: authUser.role,
          plantIds: authUser.plantIds,
          rulesVersion: authUser.rulesVersion,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token['id'] = user.id;
        token['username'] = user.username;
        token['fullName'] = user.fullName;
        token['role'] = user.role;
        token['plantIds'] = user.plantIds;
        token['rulesVersion'] = user.rulesVersion;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token['id'] ?? '');
        session.user.username = String(token['username'] ?? '');
        session.user.fullName = String(token['fullName'] ?? '');
        session.user.role = (token['role'] as Role) ?? 'TECHNICIAN';
        session.user.plantIds = Array.isArray(token['plantIds'])
          ? (token['plantIds'] as string[])
          : [];
        session.user.rulesVersion = Number(token['rulesVersion'] ?? 1);
      }
      return session;
    },
  },
});
