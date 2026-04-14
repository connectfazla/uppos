import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";

const fieldSchema = z.object({
  client_id: z.string().uuid(),
  retainer_id: z.string().uuid().nullable().optional(),
  signed_status: z.string().default("unsigned"),
  signed_date: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const clientId = new URL(request.url).searchParams.get("client_id");
  let q = ctx.supabase.from("contracts").select("*, clients(company_name), retainers(name)").order("created_at", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contracts: data });
}

export async function POST(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  const meta = fieldSchema.safeParse({
    client_id: form.get("client_id"),
    retainer_id: form.get("retainer_id") || null,
    signed_status: form.get("signed_status") ?? "unsigned",
    signed_date: form.get("signed_date") || null,
  });
  if (!meta.success) return NextResponse.json({ error: meta.error.flatten() }, { status: 400 });

  const path = `${meta.data.client_id}/${crypto.randomUUID()}-${file.name.replace(/\s+/g, "_")}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await ctx.supabase.storage.from("contracts").upload(path, buffer, {
    contentType: file.type || "application/pdf",
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = ctx.supabase.storage.from("contracts").getPublicUrl(path);
  const { data: signed } = await ctx.supabase.storage.from("contracts").createSignedUrl(path, 60 * 60 * 24 * 365);

  const { data: contract, error } = await ctx.supabase
    .from("contracts")
    .insert({
      client_id: meta.data.client_id,
      retainer_id: meta.data.retainer_id ?? null,
      storage_path: path,
      contract_url: signed?.signedUrl ?? pub.publicUrl,
      signed_status: meta.data.signed_status,
      signed_date: meta.data.signed_date,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract });
}
