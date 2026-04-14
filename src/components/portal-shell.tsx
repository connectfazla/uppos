import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, isStaffRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";

export async function PortalShell({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (isStaffRole(profile.role)) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client portal</div>
            <div className="text-lg font-semibold text-foreground">Uppearance OS</div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal">Overview</Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
