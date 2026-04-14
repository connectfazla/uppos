import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";

const deliverableSchema = z.object({
  platform: z.string().min(1),
  number_of_posts: z.coerce.number().int().min(0).default(0),
  campaigns: z.coerce.number().int().min(0).default(0),
  notes: z.string().nullable().optional(),
});

const createSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1),
  monthly_fee: z.coerce.number().nonnegative(),
  start_date: z.string(),
  renewal_date: z.string(),
  billing_cycle: z.string().default("monthly"),
  status: z.enum(["active", "paused", "cancelled"]).default("active"),
  deliverables: z.array(deliverableSchema).optional(),
});

export async function GET(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const clientId = new URL(request.url).searchParams.get("client_id");
  let q = ctx.supabase
    .from("retainers")
    .select("*, retainer_deliverables(*)")
    .order("created_at", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ retainers: data });
}

export async function POST(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { deliverables, ...retainer } = parsed.data;
  const { data: created, error } = await ctx.supabase.from("retainers").insert(retainer).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (deliverables?.length) {
    const rows = deliverables.map((d) => ({ ...d, retainer_id: created.id }));
    const { error: dErr } = await ctx.supabase.from("retainer_deliverables").insert(rows);
    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });
  }
  const { data: full } = await ctx.supabase.from("retainers").select("*, retainer_deliverables(*)").eq("id", created.id).single();
  return NextResponse.json({ retainer: full });
}
