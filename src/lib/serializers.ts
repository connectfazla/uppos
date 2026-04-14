import type {
  Client as PrismaClient,
  Contact,
  Retainer,
  RetainerDeliverable,
  Contract,
  Invoice,
  Payment,
  User,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

function dec(v: Decimal | number): number {
  return typeof v === "number" ? v : Number(v);
}

function d(v: Date): string {
  return v.toISOString().slice(0, 10);
}

function ts(v: Date): string {
  return v.toISOString();
}

export function serializeUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    role: u.role.toLowerCase() as "admin" | "team" | "client",
    client_id: u.clientId,
    created_at: ts(u.createdAt),
    updated_at: ts(u.updatedAt),
  };
}

export function serializeClient(c: PrismaClient) {
  return {
    id: c.id,
    company_name: c.companyName,
    status: c.status.toLowerCase() as "lead" | "active" | "paused" | "inactive",
    assigned_manager: c.assignedManagerId,
    notes: c.notes,
    created_at: ts(c.createdAt),
    archived_at: c.archivedAt ? ts(c.archivedAt) : null,
  };
}

export function serializeContact(c: Contact) {
  return {
    id: c.id,
    client_id: c.clientId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    role: c.role,
    created_at: ts(c.createdAt),
  };
}

export function serializeRetainer(r: Retainer & { deliverables?: RetainerDeliverable[] }) {
  const deliverables = r.deliverables ?? [];
  return {
    id: r.id,
    client_id: r.clientId,
    name: r.name,
    monthly_fee: dec(r.monthlyFee),
    start_date: d(r.startDate),
    renewal_date: d(r.renewalDate),
    billing_cycle: r.billingCycle,
    status: r.status.toLowerCase() as "active" | "paused" | "cancelled",
    created_at: ts(r.createdAt),
    updated_at: ts(r.updatedAt),
    retainer_deliverables: deliverables.map(serializeDeliverable),
  };
}

export function serializeDeliverable(d: RetainerDeliverable) {
  return {
    id: d.id,
    retainer_id: d.retainerId,
    platform: d.platform,
    number_of_posts: d.numberOfPosts,
    campaigns: d.campaigns,
    notes: d.notes,
    created_at: ts(d.createdAt),
  };
}

export function serializeContract(c: Contract) {
  return {
    id: c.id,
    client_id: c.clientId,
    retainer_id: c.retainerId,
    contract_url: `/api/contracts/${c.id}/file`,
    storage_path: c.storagePath,
    signed_status: c.signedStatus,
    signed_date: c.signedDate ? d(c.signedDate) : null,
    created_at: ts(c.createdAt),
    original_name: c.originalName,
  };
}

export function serializeInvoice(i: Invoice) {
  return {
    id: i.id,
    client_id: i.clientId,
    retainer_id: i.retainerId,
    amount: dec(i.amount),
    due_date: d(i.dueDate),
    status: i.status.toLowerCase() as "paid" | "unpaid" | "overdue",
    invoice_link: i.invoiceLink,
    notes: i.notes,
    created_at: ts(i.createdAt),
    updated_at: ts(i.updatedAt),
  };
}

export function serializePayment(p: Payment) {
  return {
    id: p.id,
    invoice_id: p.invoiceId,
    amount_paid: dec(p.amountPaid),
    payment_date: d(p.paymentDate),
    method: p.method,
    reference_note: p.referenceNote,
    created_at: ts(p.createdAt),
  };
}
