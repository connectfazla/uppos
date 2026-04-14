import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";
import { deriveInvoiceStatus } from "@/lib/invoices";
import { syncInvoiceStatuses } from "@/lib/invoice-sync";

const schema = z.object({
  invoice_id: z.string().uuid(),
  amount_paid: z.coerce.number().positive(),
  payment_date: z.string(),
  method: z.string().min(1).default("bank_transfer"),
  reference_note: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { data: payment, error } = await ctx.supabase.from("payments").insert(parsed.data).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: invoice } = await ctx.supabase.from("invoices").select("id, amount, due_date").eq("id", parsed.data.invoice_id).single();
  if (invoice) {
    const { data: sums } = await ctx.supabase.from("payments").select("amount_paid").eq("invoice_id", invoice.id);
    const totalPaid = (sums ?? []).reduce((acc, row) => acc + Number(row.amount_paid), 0);
    const status = deriveInvoiceStatus({
      amount: Number(invoice.amount),
      totalPaid,
      dueDate: invoice.due_date,
    });
    await ctx.supabase
      .from("invoices")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", invoice.id);
  }
  await syncInvoiceStatuses(ctx.supabase);
  return NextResponse.json({ payment });
}
