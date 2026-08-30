import type { BankAccount, CategoryId } from "./types";

export interface BankMeta {
  id: string;
  bankName: string;
  nickname: string;
  last4: string;
  /** pastel background utility */
  bg: string;
}

/** Fixed LEPDO bank accounts shown as balance cards. */
export const BANKS: BankMeta[] = [
  { id: "bank_hdfc", bankName: "LEPDO HDFC", nickname: "LEPDO HDFC", last4: "4821", bg: "bg-pl-blue" },
  {
    id: "bank_indusind",
    bankName: "LEPDO IndusInd",
    nickname: "LEPDO IndusInd",
    last4: "7714",
    bg: "bg-pl-green",
  },
  {
    id: "bank_kotak",
    bankName: "Renuka Kotak",
    nickname: "Renuka Kotak",
    last4: "3390",
    bg: "bg-pl-purple",
  },
  { id: "bank_sbi", bankName: "Brijes SBI", nickname: "Brijes SBI", last4: "9037", bg: "bg-pl-orange" },
];

export const BANK_SEED: BankAccount[] = BANKS.map((b) => ({
  id: b.id,
  bankName: b.bankName,
  nickname: b.nickname,
  last4: b.last4,
  openingBalance: 0,
  active: true,
}));

/** Categories offered on the bank ledger, in display order. */
export const BANK_CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "sale_payment", label: "Sales Receipt" },
  { id: "purchase_payment", label: "Purchase Payment" },
  { id: "expense", label: "Expense" },
  { id: "uchhina_money_given", label: "Uchhina — Money Given" },
  { id: "uchhina_money_received_back", label: "Uchhina — Money Received Back" },
  { id: "uchhina_received", label: "Uchhina — Money Taken" },
  { id: "uchhina_given", label: "Uchhina — Money Returned" },
  { id: "bank_transfer", label: "Bank Transfer" },
  { id: "owner_drawing", label: "Founder Drawing" },
  { id: "owner_investment", label: "Capital / Investment" },
  { id: "customer_refund", label: "Customer Refund" },
  { id: "loan_emi", label: "Loan / EMI" },
  { id: "bank_charges", label: "Bank Charges" },
  { id: "interest", label: "Interest" },
  { id: "other", label: "Other" },
];

export type BankPreset = "month" | "prev_month" | "fy" | "custom";

export const BANK_PRESETS: { id: BankPreset; label: string }[] = [
  { id: "month", label: "This Month" },
  { id: "prev_month", label: "Previous Month" },
  { id: "fy", label: "This Financial Year" },
  { id: "custom", label: "Custom Date Range" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function bankRange(
  preset: BankPreset,
  today: string,
  from: string,
  to: string,
): [string, string] {
  const d = new Date(today);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (preset === "custom") return [from, to];
  if (preset === "prev_month")
    return [iso(new Date(Date.UTC(y, m - 1, 1))), iso(new Date(Date.UTC(y, m, 0)))];
  if (preset === "fy") {
    const fy = m >= 3 ? y : y - 1;
    return [`${fy}-04-01`, `${fy + 1}-03-31`];
  }
  return [iso(new Date(Date.UTC(y, m, 1))), iso(new Date(Date.UTC(y, m + 1, 0)))];
}

export function periodLabel(preset: BankPreset, from: string, to: string): string {
  const label = BANK_PRESETS.find((p) => p.id === preset)?.label ?? "Period";
  return preset === "custom" ? `${from} to ${to}` : `${label} (${from} to ${to})`;
}
