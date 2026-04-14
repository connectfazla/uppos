import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";

const createSchema = z.object({
  company_name: z.string().min(1),
  status: z.enum(["lead", "active", "paused", "inactive"]).default("lead"),
  assigned_manager: z.string().uuid().nullable().optional(),
});

export async function GET(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("archived") === "1";
  let q = ctx.supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (!includeArchived) {
    q = q.is("archived_at", null);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data });
}

export async function POST(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { data, error } = await ctx.supabase
    .from("clients")
    .insert({
      company_name: parsed.data.company_name,
      status: parsed.data.status,
      assigned_manager: parsed.data.assigned_manager ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: data });
}
