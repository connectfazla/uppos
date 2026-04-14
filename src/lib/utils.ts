import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(iso: string) {
  const d = iso.includes("T") ? new Date(iso) : new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(d);
}
