import type { CategoryId } from "./types";

export interface CashBookMeta {
  id: string;
  name: string;
  short: string;
}

/** The two fixed LEPDO cash books. */
export const CASH_BOOKS: CashBookMeta[] = [
  { id: "cash_itpark", name: "IT Park Cash Book", short: "IT Park" },
  { id: "cash_mahidharpura", name: "Mahidharpura Cash Book", short: "Mahidharpura" },
];

/** Categories offered on the cash book, in display order. */
export const CASH_CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "sale_payment", label: "Sales Receipt" },
  { id: "purchase_payment", label: "Purchase Payment" },
  { id: "expense", label: "Expense" },
  { id: "uchhina_money_given", label: "Uchhina — Money Given" },
  { id: "uchhina_money_received_back", label: "Uchhina — Money Received Back" },
  { id: "uchhina_received", label: "Uchhina — Money Taken" },
  { id: "uchhina_given", label: "Uchhina — Money Returned" },
  { id: "owner_drawing", label: "Founder Drawing" },
  { id: "owner_investment", label: "Capital / Investment" },
  { id: "bank_to_cash", label: "Bank Withdrawal" },
  { id: "cash_to_bank", label: "Bank Deposit" },
  { id: "cash_transfer", label: "Cash Transfer" },
  { id: "other", label: "Other" },
];

export function cashCategoryLabel(id: CategoryId | null): string {
  if (!id) return "Unclassified";
  return CASH_CATEGORIES.find((c) => c.id === id)?.label ?? "Other";
}

/** Fixed direction for categories that can only go one way in a cash book. */
export function fixedDirection(id: CategoryId | ""): "in" | "out" | null {
  if (
    id === "sale_payment" ||
    id === "owner_investment" ||
    id === "bank_to_cash" ||
    id === "uchhina_received" ||
    id === "uchhina_money_received_back"
  )
    return "in";
  if (
    id === "purchase_payment" ||
    id === "expense" ||
    id === "owner_drawing" ||
    id === "cash_to_bank" ||
    id === "uchhina_given" ||
    id === "uchhina_money_given"
  )
    return "out";
  return null;
}
