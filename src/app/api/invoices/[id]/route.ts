import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { invoiceStatusFromApi } from "@/lib/prisma-enums";
import { syncInvoiceStatuses } from "@/lib/invoice-sync";
import { serializeInvoice } from "@/lib/serializers";

const patchSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  due_date: z.string().optional(),
  status: z.enum(["paid", "unpaid", "overdue"]).optional(),
  invoice_link: z.string().min(1).refine((s) => /^https?:\/\//i.test(s), "invalid URL").optional(),
  notes: z.string().nullable().optional(),
  retainer_id: z.string().uuid().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const { id } = params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      ...(parsed.data.amount !== undefined ? { amount: parsed.data.amount } : {}),
      ...(parsed.data.due_date !== undefined ? { dueDate: new Date(parsed.data.due_date) } : {}),
      ...(parsed.data.status !== undefined ? { status: invoiceStatusFromApi(parsed.data.status) } : {}),
      ...(parsed.data.invoice_link !== undefined ? { invoiceLink: parsed.data.invoice_link } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      ...(parsed.data.retainer_id !== undefined ? { retainerId: parsed.data.retainer_id } : {}),
    },
  });
  await syncInvoiceStatuses();
  const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: updated.id } });
  return NextResponse.json({ invoice: serializeInvoice(fresh) });
}
