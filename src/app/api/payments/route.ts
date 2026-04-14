import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { syncInvoiceStatuses } from "@/lib/invoice-sync";
import { serializePayment } from "@/lib/serializers";

const schema = z.object({
  invoice_id: z.string().uuid(),
  amount_paid: z.coerce.number().positive(),
  payment_date: z.string(),
  method: z.string().min(1).default("bank_transfer"),
  reference_note: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payment = await prisma.payment.create({
    data: {
      invoiceId: parsed.data.invoice_id,
      amountPaid: parsed.data.amount_paid,
      paymentDate: new Date(parsed.data.payment_date),
      method: parsed.data.method,
      referenceNote: parsed.data.reference_note ?? null,
    },
  });
  await syncInvoiceStatuses();
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  return NextResponse.json({ payment: serializePayment(fresh) });
}
