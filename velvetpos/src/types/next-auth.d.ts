import type { DefaultSession } from 'next-auth';
import type { UserRole } from '@/generated/prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      permissions: string[];
      tenantId: string | null;
      sessionVersion: number;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
    permissions?: string[];
    tenantId?: string | null;
    sessionVersion?: number;
  }
}
