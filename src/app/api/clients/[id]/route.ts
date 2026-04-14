import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { clientStatusFromApi } from "@/lib/prisma-enums";
import {
  serializeClient,
  serializeContact,
  serializeInvoice,
  serializeRetainer,
} from "@/lib/serializers";

const patchSchema = z.object({
  company_name: z.string().min(1).optional(),
  status: z.enum(["lead", "active", "paused", "inactive"]).optional(),
  assigned_manager: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  archived: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const { id } = params;
  const client = await prisma.client.findFirst({
    where: { id },
    include: {
      accountManager: true,
      contacts: { orderBy: { createdAt: "desc" } },
      retainers: { include: { deliverables: true }, orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { dueDate: "asc" } },
    },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    client: serializeClient(client),
    contacts: client.contacts.map(serializeContact),
    retainers: client.retainers.map((r) => serializeRetainer(r)),
    invoices: client.invoices.map(serializeInvoice),
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const { id } = params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.client.update({
    where: { id },
    data: {
      ...(parsed.data.company_name !== undefined ? { companyName: parsed.data.company_name } : {}),
      ...(parsed.data.status !== undefined ? { status: clientStatusFromApi(parsed.data.status) } : {}),
      ...(parsed.data.assigned_manager !== undefined
        ? { assignedManagerId: parsed.data.assigned_manager }
        : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      ...(parsed.data.archived === true ? { archivedAt: new Date() } : {}),
      ...(parsed.data.archived === false ? { archivedAt: null } : {}),
    },
  });
  return NextResponse.json({ client: serializeClient(updated) });
}
