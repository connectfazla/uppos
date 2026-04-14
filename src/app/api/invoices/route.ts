import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, requireUser } from "@/lib/api-helpers";
import { isStaffRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceStatusFromApi } from "@/lib/prisma-enums";
import { syncInvoiceStatuses } from "@/lib/invoice-sync";
import { serializeInvoice } from "@/lib/serializers";

const createSchema = z.object({
  client_id: z.string().uuid(),
  retainer_id: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().positive(),
  due_date: z.string(),
  status: z.enum(["paid", "unpaid", "overdue"]).optional(),
  invoice_link: z.string().min(1).refine((s) => /^https?:\/\//i.test(s), "invoice_link must be an http(s) URL"),
  notes: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  await syncInvoiceStatuses();

  const clientId = new URL(request.url).searchParams.get("client_id");
  const where: { clientId?: string } = {};
  if (!isStaffRole(ctx.profile.role)) {
    if (!ctx.profile.client_id) return NextResponse.json({ invoices: [] });
    where.clientId = ctx.profile.client_id;
  } else if (clientId) {
    where.clientId = clientId;
  }

  const rows = await prisma.invoice.findMany({
    where,
    orderBy: { dueDate: "asc" },
  });
  return NextResponse.json({ invoices: rows.map(serializeInvoice) });
}

export async function POST(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await prisma.invoice.create({
    data: {
      clientId: parsed.data.client_id,
      retainerId: parsed.data.retainer_id ?? null,
      amount: parsed.data.amount,
      dueDate: new Date(parsed.data.due_date),
      status: parsed.data.status ? invoiceStatusFromApi(parsed.data.status) : undefined,
      invoiceLink: parsed.data.invoice_link,
      notes: parsed.data.notes ?? null,
    },
  });
  await syncInvoiceStatuses();
  const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: created.id } });
  return NextResponse.json({ invoice: serializeInvoice(fresh) });
}
