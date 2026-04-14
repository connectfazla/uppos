import type { UserRole } from "@/types/database";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: UserRole;
      clientId: string | null;
    };
  }

  interface User {
    role: UserRole;
    clientId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    clientId: string | null;
  }
}
