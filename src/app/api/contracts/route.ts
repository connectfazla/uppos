import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";
import { ensureContractsRoot } from "@/lib/contracts-storage";
import { prisma } from "@/lib/prisma";
import { serializeContract } from "@/lib/serializers";

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
  const rows = await prisma.contract.findMany({
    where: clientId ? { clientId } : {},
    include: { client: true, retainer: true },
    orderBy: { createdAt: "desc" },
  });
  const contracts = rows.map((c) => ({
    ...serializeContract(c),
    clients: { company_name: c.client.companyName },
    retainers: c.retainer ? { name: c.retainer.name } : null,
  }));
  return NextResponse.json({ contracts });
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

  const root = await ensureContractsRoot();
  const rel = path.join(meta.data.client_id, `${crypto.randomUUID()}-${file.name.replace(/\s+/g, "_")}`);
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(abs, buffer);

  const storagePath = rel.split(path.sep).join("/");
  const contract = await prisma.contract.create({
    data: {
      clientId: meta.data.client_id,
      retainerId: meta.data.retainer_id ?? null,
      storagePath,
      originalName: file.name,
      mimeType: file.type || "application/pdf",
      signedStatus: meta.data.signed_status,
      signedDate: meta.data.signed_date ? new Date(meta.data.signed_date) : null,
    },
    include: { client: true, retainer: true },
  });

  return NextResponse.json({
    contract: {
      ...serializeContract(contract),
      clients: { company_name: contract.client.companyName },
      retainers: contract.retainer ? { name: contract.retainer.name } : null,
    },
  });
}
