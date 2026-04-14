import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-helpers";
import { isStaffRole } from "@/lib/auth";
import { syncInvoiceStatuses } from "@/lib/invoice-sync";

export async function GET() {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  if (isStaffRole(ctx.profile.role)) {
    return NextResponse.json({ error: "Use /api/dashboard/metrics for staff" }, { status: 400 });
  }
  if (!ctx.profile.client_id) {
    return NextResponse.json({ error: "Client profile is not linked to an organization" }, { status: 403 });
  }
  const cid = ctx.profile.client_id;
  await syncInvoiceStatuses(ctx.supabase);

  const { data: client } = await ctx.supabase.from("clients").select("*").eq("id", cid).single();
  const { data: retainers } = await ctx.supabase
    .from("retainers")
    .select("*, retainer_deliverables(*)")
    .eq("client_id", cid)
    .eq("status", "active");
  const { data: contracts } = await ctx.supabase.from("contracts").select("*").eq("client_id", cid).order("created_at", { ascending: false });
  const { data: invoices } = await ctx.supabase.from("invoices").select("*").eq("client_id", cid).order("due_date", { ascending: true });
  const invoiceIds = (invoices ?? []).map((i) => i.id);
  let payments: unknown[] = [];
  if (invoiceIds.length) {
    const { data: p } = await ctx.supabase.from("payments").select("*").in("invoice_id", invoiceIds);
    payments = p ?? [];
  }

  const monthlyTotal = (retainers ?? []).reduce((s, r) => s + Number(r.monthly_fee), 0);
  const nextRenewal = (retainers ?? [])
    .map((r) => r.renewal_date)
    .filter(Boolean)
    .sort()[0];

  return NextResponse.json({
    client,
    overview: {
      activeRetainers: retainers ?? [],
      monthlyTotal,
      nextRenewalDate: nextRenewal ?? null,
    },
    retainers: retainers ?? [],
    contracts: contracts ?? [],
    invoices: invoices ?? [],
    payments,
  });
}
