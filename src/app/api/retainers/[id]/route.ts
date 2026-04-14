import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  monthly_fee: z.coerce.number().nonnegative().optional(),
  start_date: z.string().optional(),
  renewal_date: z.string().optional(),
  billing_cycle: z.string().optional(),
  status: z.enum(["active", "paused", "cancelled"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const { id } = params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = { ...parsed.data, updated_at: new Date().toISOString() };
  const { data, error } = await ctx.supabase.from("retainers").update(body).eq("id", id).select("*, retainer_deliverables(*)").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ retainer: data });
}
