import { redirect } from "next/navigation";
import { getProfile, isStaffRole } from "@/lib/auth";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (isStaffRole(profile.role)) redirect("/dashboard");
  redirect("/portal");
}
