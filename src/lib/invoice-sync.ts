import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveInvoiceStatus } from "@/lib/invoices";

export async function syncInvoiceStatuses(supabase: SupabaseClient) {
  const { data: invoices, error } = await supabase.from("invoices").select("id, amount, due_date");
  if (error || !invoices?.length) return;
  const { data: payments } = await supabase.from("payments").select("invoice_id, amount_paid");
  const paidByInvoice = new Map<string, number>();
  (payments ?? []).forEach((p) => {
    const cur = paidByInvoice.get(p.invoice_id) ?? 0;
    paidByInvoice.set(p.invoice_id, cur + Number(p.amount_paid));
  });
  for (const inv of invoices) {
    const totalPaid = paidByInvoice.get(inv.id) ?? 0;
    const next = deriveInvoiceStatus({
      amount: Number(inv.amount),
      totalPaid,
      dueDate: inv.due_date,
    });
    await supabase.from("invoices").update({ status: next, updated_at: new Date().toISOString() }).eq("id", inv.id);
  }
}
