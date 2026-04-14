import { ClientStatus, InvoiceStatus, RetainerStatus } from "@prisma/client";

export function clientStatusFromApi(v: "lead" | "active" | "paused" | "inactive"): ClientStatus {
  const map: Record<string, ClientStatus> = {
    lead: ClientStatus.LEAD,
    active: ClientStatus.ACTIVE,
    paused: ClientStatus.PAUSED,
    inactive: ClientStatus.INACTIVE,
  };
  return map[v] ?? ClientStatus.LEAD;
}

export function retainerStatusFromApi(v: "active" | "paused" | "cancelled"): RetainerStatus {
  const map: Record<string, RetainerStatus> = {
    active: RetainerStatus.ACTIVE,
    paused: RetainerStatus.PAUSED,
    cancelled: RetainerStatus.CANCELLED,
  };
  return map[v] ?? RetainerStatus.ACTIVE;
}

export function invoiceStatusFromApi(v: "paid" | "unpaid" | "overdue"): InvoiceStatus {
  const map: Record<string, InvoiceStatus> = {
    paid: InvoiceStatus.PAID,
    unpaid: InvoiceStatus.UNPAID,
    overdue: InvoiceStatus.OVERDUE,
  };
  return map[v] ?? InvoiceStatus.UNPAID;
}
