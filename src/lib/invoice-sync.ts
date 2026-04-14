import { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/invoices";

function toPrismaInvoiceStatus(s: "paid" | "unpaid" | "overdue"): InvoiceStatus {
  if (s === "paid") return InvoiceStatus.PAID;
  if (s === "overdue") return InvoiceStatus.OVERDUE;
  return InvoiceStatus.UNPAID;
}

export async function syncInvoiceStatuses() {
  const invoices = await prisma.invoice.findMany({
    select: { id: true, amount: true, dueDate: true },
  });
  if (!invoices.length) return;
  const payments = await prisma.payment.findMany({
    select: { invoiceId: true, amountPaid: true },
  });
  const paidByInvoice = new Map<string, number>();
  for (const p of payments) {
    const cur = paidByInvoice.get(p.invoiceId) ?? 0;
    paidByInvoice.set(p.invoiceId, cur + Number(p.amountPaid));
  }
  for (const inv of invoices) {
    const totalPaid = paidByInvoice.get(inv.id) ?? 0;
    const next = deriveInvoiceStatus({
      amount: Number(inv.amount),
      totalPaid,
      dueDate: inv.dueDate.toISOString().slice(0, 10),
    });
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { status: toPrismaInvoiceStatus(next) },
    });
  }
}
