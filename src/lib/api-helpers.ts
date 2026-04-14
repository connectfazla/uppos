import { getProfile, isStaffRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const profile = await getProfile();
  if (!profile) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  return { supabase, profile } as const;
}

export async function requireStaff() {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx;
  if (!isStaffRole(ctx.profile.role)) {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return ctx;
}
