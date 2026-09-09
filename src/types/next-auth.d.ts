import type { DefaultSession } from 'next-auth';
declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & { id: string; role: 'admin' | 'consulta'; version: number };
  }
  interface User {
    role: 'admin' | 'consulta';
    version: number;
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    role: 'admin' | 'consulta';
    version: number;
  }
}
