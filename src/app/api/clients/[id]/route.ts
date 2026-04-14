import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";

const patchSchema = z.object({
  company_name: z.string().min(1).optional(),
  status: z.enum(["lead", "active", "paused", "inactive"]).optional(),
  assigned_manager: z.string().uuid().nullable().optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const { id } = params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body: Record<string, unknown> = {};
  if (parsed.data.company_name !== undefined) body.company_name = parsed.data.company_name;
  if (parsed.data.status !== undefined) body.status = parsed.data.status;
  if (parsed.data.assigned_manager !== undefined) body.assigned_manager = parsed.data.assigned_manager;
  if (parsed.data.archived === true) body.archived_at = new Date().toISOString();
  if (parsed.data.archived === false) body.archived_at = null;
  const { data, error } = await ctx.supabase.from("clients").update(body).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: data });
}
