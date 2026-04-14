import { NextResponse } from "next/server";
import { InvoiceStatus, RetainerStatus } from "@prisma/client";
import { addDays, startOfDay } from "date-fns";
import { requireStaff } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { syncInvoiceStatuses } from "@/lib/invoice-sync";
import { serializeInvoice, serializePayment, serializeRetainer } from "@/lib/serializers";

export async function GET() {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  await syncInvoiceStatuses();

  const today = startOfDay(new Date());
  const horizon = addDays(today, 30);

  const activeRetainers = await prisma.retainer.findMany({
    where: { status: RetainerStatus.ACTIVE },
  });
  const mrr = activeRetainers.reduce((sum, r) => sum + Number(r.monthlyFee), 0);

  const renewalRows = await prisma.retainer.findMany({
    where: {
      status: RetainerStatus.ACTIVE,
      renewalDate: { gte: today, lte: horizon },
    },
    include: { client: true, deliverables: true },
    orderBy: { renewalDate: "asc" },
  });

  const openInvoices = await prisma.invoice.findMany({
    where: { status: { not: InvoiceStatus.PAID } },
    include: { client: true },
    orderBy: { dueDate: "asc" },
  });

  const allPayments = await prisma.payment.findMany({
    select: { invoiceId: true, amountPaid: true },
  });
  const paidMap = new Map<string, number>();
  for (const p of allPayments) {
    paidMap.set(p.invoiceId, (paidMap.get(p.invoiceId) ?? 0) + Number(p.amountPaid));
  }

  const overdueInvoices = openInvoices.filter((inv) => {
    if (inv.status === InvoiceStatus.OVERDUE) return true;
    return inv.status === InvoiceStatus.UNPAID && startOfDay(inv.dueDate) < today;
  });

  const recentPaymentRows = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      invoice: { include: { client: true } },
    },
  });

  const outstanding = openInvoices.reduce((sum, inv) => {
    const paid = paidMap.get(inv.id) ?? 0;
    return sum + Math.max(0, Number(inv.amount) - paid);
  }, 0);

  return NextResponse.json({
    metrics: {
      activeRetainersCount: activeRetainers.length,
      mrr,
      upcomingRenewalsCount: renewalRows.length,
      outstandingInvoiceAmount: outstanding,
    },
    upcomingRenewals: renewalRows.map((r) => ({
      ...serializeRetainer(r),
      clients: r.client ? { company_name: r.client.companyName } : null,
    })),
    overdueInvoices: overdueInvoices.map((inv) => ({
      ...serializeInvoice(inv),
      clients: inv.client ? { company_name: inv.client.companyName } : null,
    })),
    recentPayments: recentPaymentRows.map((p) => ({
      ...serializePayment(p),
      invoices: p.invoice
        ? {
            amount: Number(p.invoice.amount),
            clients: p.invoice.client ? { company_name: p.invoice.client.companyName } : null,
          }
        : null,
    })),
  });
}
