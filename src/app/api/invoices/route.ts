import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, requireUser } from "@/lib/api-helpers";
import { isStaffRole } from "@/lib/auth";
import { syncInvoiceStatuses } from "@/lib/invoice-sync";

const createSchema = z.object({
  client_id: z.string().uuid(),
  retainer_id: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().positive(),
  due_date: z.string(),
  status: z.enum(["paid", "unpaid", "overdue"]).optional(),
  invoice_link: z.string().min(1).refine((s) => /^https?:\/\//i.test(s), "invoice_link must be an http(s) URL"),
  notes: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  await syncInvoiceStatuses(ctx.supabase);
  const clientId = new URL(request.url).searchParams.get("client_id");
  let q = ctx.supabase.from("invoices").select("*").order("due_date", { ascending: true });
  if (!isStaffRole(ctx.profile.role)) {
    if (!ctx.profile.client_id) return NextResponse.json({ invoices: [] });
    q = q.eq("client_id", ctx.profile.client_id);
  } else if (clientId) {
    q = q.eq("client_id", clientId);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: data });
}

export async function POST(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await ctx.supabase.from("invoices").insert(parsed.data).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}
