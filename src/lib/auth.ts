import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { createHash } from 'node:crypto';
import { db } from './db';
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credenciales',
      credentials: {
        usuario: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(c) {
        const usuario = c?.usuario?.trim().toLowerCase();
        const password = c?.password;
        if (!usuario || usuario.length > 80 || !password || Buffer.byteLength(password) > 72)
          return null;
        const clave = createHash('sha256').update(usuario).digest('hex');
        const now = new Date();
        const attempts = await db.$queryRaw<
          { intentos: number }[]
        >`INSERT INTO "LoginIntento" ("clave","intentos","ventana") VALUES (${clave},1,${now}) ON CONFLICT ("clave") DO UPDATE SET "intentos" = CASE WHEN "LoginIntento"."ventana" < ${new Date(now.getTime() - 15 * 60 * 1000)} THEN 1 ELSE "LoginIntento"."intentos"+1 END, "ventana" = CASE WHEN "LoginIntento"."ventana" < ${new Date(now.getTime() - 15 * 60 * 1000)} THEN ${now} ELSE "LoginIntento"."ventana" END RETURNING "intentos"`;
        if (attempts[0].intentos > 10) return null;
        const user = await db.administrador.findUnique({ where: { usuario } });
        // Fixed valid bcrypt hash keeps unknown-account attempts computationally comparable.
        const valid = await compare(
          password,
          user?.passwordHash ?? '$2b$12$C6UzMDM.H6dfI/f/IKcEe.yrb5bdGPUnP4X1nZ.9ykT/B3vEkMVty',
        );
        if (!user?.activo || !valid) return null;
        await db.loginIntento.deleteMany({ where: { clave } });
        return { id: user.id, name: user.nombre, role: user.rol, version: user.sessionVersion };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.version = user.version;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role;
        session.user.version = token.version;
      }
      return session;
    },
  },
};
