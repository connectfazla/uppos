import { NextResponse } from "next/server";
import { RetainerStatus } from "@prisma/client";
import { requireUser } from "@/lib/api-helpers";
import { isStaffRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncInvoiceStatuses } from "@/lib/invoice-sync";
import {
  serializeClient,
  serializeContract,
  serializeInvoice,
  serializePayment,
  serializeRetainer,
} from "@/lib/serializers";

export async function GET() {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  if (isStaffRole(ctx.profile.role)) {
    return NextResponse.json({ error: "Use /api/dashboard/metrics for staff" }, { status: 400 });
  }
  if (!ctx.profile.client_id) {
    return NextResponse.json({ error: "Client profile is not linked to an organization" }, { status: 403 });
  }
  const cid = ctx.profile.client_id;
  await syncInvoiceStatuses();

  const client = await prisma.client.findUnique({ where: { id: cid } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const retainers = await prisma.retainer.findMany({
    where: { clientId: cid, status: RetainerStatus.ACTIVE },
    include: { deliverables: true },
  });
  const contracts = await prisma.contract.findMany({
    where: { clientId: cid },
    orderBy: { createdAt: "desc" },
  });
  const invoices = await prisma.invoice.findMany({
    where: { clientId: cid },
    orderBy: { dueDate: "asc" },
  });
  const invoiceIds = invoices.map((i) => i.id);
  const payments =
    invoiceIds.length === 0
      ? []
      : await prisma.payment.findMany({
          where: { invoiceId: { in: invoiceIds } },
          orderBy: { paymentDate: "desc" },
        });

  const monthlyTotal = retainers.reduce((s, r) => s + Number(r.monthlyFee), 0);
  const nextRenewalDate = retainers
    .map((r) => r.renewalDate.toISOString().slice(0, 10))
    .sort()[0];

  return NextResponse.json({
    client: serializeClient(client),
    overview: {
      activeRetainers: retainers.map(serializeRetainer),
      monthlyTotal,
      nextRenewalDate: nextRenewalDate ?? null,
    },
    retainers: retainers.map(serializeRetainer),
    contracts: contracts.map(serializeContract),
    invoices: invoices.map(serializeInvoice),
    payments: payments.map(serializePayment),
  });
}
