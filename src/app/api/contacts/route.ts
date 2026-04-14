import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { serializeContact } from "@/lib/serializers";

const schema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1),
  email: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.union([z.string().email(), z.null()]).optional(),
  ),
  phone: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const clientId = new URL(request.url).searchParams.get("client_id");
  const rows = await prisma.contact.findMany({
    where: clientId ? { clientId } : {},
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ contacts: rows.map(serializeContact) });
}

export async function POST(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await prisma.contact.create({
    data: {
      clientId: parsed.data.client_id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      role: parsed.data.role ?? null,
    },
  });
  return NextResponse.json({ contact: serializeContact(created) });
}
