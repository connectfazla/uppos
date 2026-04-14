import type { InvoiceStatus } from "@/types/database";
import { isBefore, startOfDay } from "date-fns";

export function deriveInvoiceStatus(params: {
  amount: number;
  totalPaid: number;
  dueDate: string;
  currentStatus?: InvoiceStatus;
}): InvoiceStatus {
  const { amount, totalPaid, dueDate } = params;
  if (totalPaid >= amount) return "paid";
  const due = startOfDay(new Date(dueDate + "T12:00:00"));
  if (isBefore(due, startOfDay(new Date())) && totalPaid < amount) {
    return "overdue";
  }
  return "unpaid";
}
