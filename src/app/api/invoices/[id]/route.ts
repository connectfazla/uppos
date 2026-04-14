import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";

const patchSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  due_date: z.string().optional(),
  status: z.enum(["paid", "unpaid", "overdue"]).optional(),
  invoice_link: z.string().min(1).refine((s) => /^https?:\/\//i.test(s), "invalid URL").optional(),
  notes: z.string().nullable().optional(),
  retainer_id: z.string().uuid().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const { id } = params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = { ...parsed.data, updated_at: new Date().toISOString() };
  const { data, error } = await ctx.supabase.from("invoices").update(body).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}
