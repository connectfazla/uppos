import type { UserRole } from "@/types/database";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return null;
  return data as {
    id: string;
    email: string | null;
    full_name: string | null;
    role: UserRole;
    client_id: string | null;
  } | null;
}

export function isStaffRole(role: UserRole) {
  return role === "admin" || role === "team";
}
