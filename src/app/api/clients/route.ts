import { NextResponse } from "next/server";
import { RetainerStatus } from "@prisma/client";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { clientStatusFromApi } from "@/lib/prisma-enums";
import { serializeClient } from "@/lib/serializers";

const createSchema = z.object({
  company_name: z.string().min(1),
  status: z.enum(["lead", "active", "paused", "inactive"]).default("lead"),
  assigned_manager: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

function d(v: Date): string {
  return v.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("archived") === "1";

  const rows = await prisma.client.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      accountManager: true,
      retainers: { where: { status: RetainerStatus.ACTIVE } },
      invoices: { include: { payments: true } },
    },
  });

  const clients = rows.map((c) => {
    const monthlyValue = c.retainers.reduce((s, r) => s + Number(r.monthlyFee), 0);
    const managerName = c.accountManager
      ? c.accountManager.fullName || c.accountManager.email
      : null;
    let lastPayment: string | null = null;
    for (const inv of c.invoices) {
      for (const p of inv.payments) {
        const pd = d(p.paymentDate);
        if (!lastPayment || pd > lastPayment) lastPayment = pd;
      }
    }
    return {
      ...serializeClient(c),
      monthly_value: monthlyValue,
      manager_name: managerName,
      last_payment: lastPayment,
    };
  });

  return NextResponse.json({ clients });
}

export async function POST(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const created = await prisma.client.create({
    data: {
      companyName: parsed.data.company_name,
      status: clientStatusFromApi(parsed.data.status),
      assignedManagerId: parsed.data.assigned_manager ?? null,
      notes: parsed.data.notes ?? null,
    },
  });
  return NextResponse.json({ client: serializeClient(created) });
}
