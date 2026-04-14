import { NextResponse } from "next/server";
import { addDays, formatISO, startOfDay } from "date-fns";
import { requireStaff } from "@/lib/api-helpers";
import { syncInvoiceStatuses } from "@/lib/invoice-sync";

export async function GET() {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  await syncInvoiceStatuses(ctx.supabase);

  const today = formatISO(startOfDay(new Date()), { representation: "date" });
  const horizon = formatISO(addDays(startOfDay(new Date()), 30), { representation: "date" });

  const { data: retainers } = await ctx.supabase.from("retainers").select("*").eq("status", "active");
  const activeRetainers = retainers ?? [];
  const mrr = activeRetainers.reduce((sum, r) => sum + Number(r.monthly_fee), 0);

  const { data: renewals } = await ctx.supabase
    .from("retainers")
    .select("*, clients(company_name)")
    .eq("status", "active")
    .gte("renewal_date", today)
    .lte("renewal_date", horizon)
    .order("renewal_date", { ascending: true });

  const { data: openInvoices } = await ctx.supabase
    .from("invoices")
    .select("id, amount, status, due_date, clients(company_name)")
    .neq("status", "paid")
    .order("due_date", { ascending: true });

  const { data: allPayments } = await ctx.supabase.from("payments").select("invoice_id, amount_paid");
  const paidMap = new Map<string, number>();
  (allPayments ?? []).forEach((p) => {
    paidMap.set(p.invoice_id, (paidMap.get(p.invoice_id) ?? 0) + Number(p.amount_paid));
  });

  const overdueInvoices = (openInvoices ?? []).filter((inv) => {
    if (inv.status === "overdue") return true;
    return inv.status === "unpaid" && inv.due_date < today;
  });

  const { data: recentPayments } = await ctx.supabase
    .from("payments")
    .select("*, invoices(amount, client_id, clients(company_name))")
    .order("created_at", { ascending: false })
    .limit(10);

  const outstanding = (openInvoices ?? []).reduce((sum, inv) => {
    const paid = paidMap.get(inv.id) ?? 0;
    return sum + Math.max(0, Number(inv.amount) - paid);
  }, 0);

  return NextResponse.json({
    metrics: {
      activeRetainersCount: activeRetainers.length,
      mrr,
      upcomingRenewalsCount: renewals?.length ?? 0,
      outstandingInvoiceAmount: outstanding,
    },
    upcomingRenewals: renewals ?? [],
    overdueInvoices: overdueInvoices ?? [],
    recentPayments: recentPayments ?? [],
  });
}
