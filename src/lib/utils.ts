import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  // Date-only strings (YYYY-MM-DD) parse as UTC midnight, which renders a day
  // early in negative-offset timezones. Treat them as a local calendar date.
  const d =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(date + "T00:00:00")
      : new Date(date);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function generateContractNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `AS-${year}${month}-${random}`;
}

export function calculateSurcharge(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

export function calculateMinDeposit(total: number, pct = 0.3): number {
  return Math.ceil(total * pct * 100) / 100;
}
