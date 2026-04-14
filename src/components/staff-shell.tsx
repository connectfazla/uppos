import Link from "next/link";
import { LayoutDashboard, Users, Repeat, FileText, FileSignature, LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { getProfile, isStaffRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { signOut } from "@/app/actions/auth";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/retainers", label: "Retainers", icon: Repeat },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/contracts", label: "Contracts", icon: FileSignature },
];

export async function StaffShell({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!isStaffRole(profile.role)) redirect("/portal");

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-card px-3 py-6 md:flex md:flex-col">
        <div className="px-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Uppearance OS</div>
          <div className="mt-1 text-sm font-medium text-foreground">Operations</div>
        </div>
        <Separator className="my-4" />
        <nav className="flex flex-1 flex-col gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-2 px-2">
          <div className="truncate text-xs text-muted-foreground">{profile.email}</div>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm" className="w-full gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <span className="font-semibold">Uppearance OS</span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Out
            </Button>
          </form>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
