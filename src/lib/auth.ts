import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import type { Profile, UserRole } from "@/types/database";

export async function getProfile(): Promise<Profile | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const u = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    full_name: u.fullName ?? null,
    role: u.role.toLowerCase() as UserRole,
    client_id: u.clientId,
    created_at: u.createdAt.toISOString(),
    updated_at: u.updatedAt.toISOString(),
  };
}

export function isStaffRole(role: UserRole) {
  return role === "admin" || role === "team";
}
