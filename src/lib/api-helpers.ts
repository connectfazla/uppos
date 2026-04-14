import { getProfile, isStaffRole } from "@/lib/auth";
import type { Profile } from "@/types/database";

export async function requireUser(): Promise<{ profile: Profile } | { error: Response }> {
  const profile = await getProfile();
  if (!profile) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { profile };
}

export async function requireStaff(): Promise<{ profile: Profile } | { error: Response }> {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx;
  if (!isStaffRole(ctx.profile.role)) {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return ctx;
}
