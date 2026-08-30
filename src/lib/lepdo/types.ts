export type SourceType = "bank" | "cash";
export type Direction = "in" | "out";
export type TxStatus = "classified" | "unclassified" | "reconciled" | "void";

export type CategoryId =
  | "sale_payment"
  | "purchase_payment"
  | "expense"
  | "uchhina_given"
  | "uchhina_received"
  | "uchhina_money_given"
  | "uchhina_money_received_back"
  | "owner_investment"
  | "owner_drawing"
  | "bank_transfer"
  | "bank_to_cash"
  | "cash_to_bank"
  | "cash_transfer"
  | "customer_refund"
  | "supplier_refund"
  | "loan_emi"
  | "bank_charges"
  | "interest"
  | "other";

export interface BankAccount {
  id: string;
  bankName: string;
  nickname: string;
  last4: string;
  openingBalance: number;
  active: boolean;
}

export interface CashLocation {
  id: string;
  name: string;
  openingBalance: number;
  active: boolean;
}

export type PartyType = "customer" | "supplier" | "founder" | "other";

export interface Party {
  id: string;
  name: string;
  type: PartyType;
  phone?: string | undefined;
  email?: string | undefined;
  gstin?: string | undefined;
  billingAddress?: string | undefined;
  country?: string | undefined;
  company?: string | undefined;
  city?: string | undefined;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  carat: number;
  rate: number;
  /** purchase only — price per carat in USD (optional) */
  rateUsd?: number | undefined;
  /** HSN / tariff code printed on the invoice PDF */
  hsnCode?: string | undefined;

}

/** Jewelry making bill line (purchase side). */
export interface MakingLine {
  id: string;
  description: string;
  quantity: number;
  grossWeight: number;
  netWeight: number;
  diamondWeight: number;
  makingRate: number;
  total: number;
}


export type GstType = "igst" | "cgst_sgst" | "non_gst";
export type SaleType = "domestic" | "export" | "ue" | "ui" | "gst_inr";
export type InvoiceKind = "diamond" | "jewelry";

export interface StoneLine {
  id: string;
  stoneType: string;
  size: string;
  carat: number;
  rate: number;
  value: number;
}

export interface JewelryItem {
  id: string;
  description: string;
  karat: string;
  metalColour: string;
  netWeight: number;
  finePercent: number;
  fineGram: number;
  metalRate: number;
  metalValue: number;
  makingRate: number;
  makingValue: number;
  stones: StoneLine[];
  stoneValue: number;
  total: number;
}

export interface Invoice {
  id: string;
  number: string;
  partyId: string;
  date: string;
  total: number;
  paid: number;
  dueDate?: string | undefined;
  voided?: boolean | undefined;
  sellerName?: string | undefined;
  platform?: string | undefined;
  invoiceKind?: InvoiceKind | undefined;
  jewelryItems?: JewelryItem[] | undefined;
  /** grand total in the original invoice currency */
  foreignTotal?: number | undefined;
  saleType?: SaleType | undefined;
  currency?: string | undefined;
  exchangeRate?: number | undefined;
  gstType?: GstType | undefined;
  gstRate?: number | undefined;
  lines?: InvoiceLine[] | undefined;
  subtotal?: number | undefined;
  discount?: number | undefined;
  taxableAmount?: number | undefined;
  taxAmount?: number | undefined;
  shipping?: number | undefined;
  roundOff?: number | undefined;
  notes?: string | undefined;
  /* ---- purchase-side fields ---- */
  /** "diamond" = diamond purchase invoice, "jewelry_making" = jewelry making bill */
  billKind?: "diamond" | "jewelry_making" | undefined;
  brokerName?: string | undefined;
  supplierInvoiceNumber?: string | undefined;
  paymentTermsDays?: number | undefined;
  usdRate?: number | undefined;
  makingLines?: MakingLine[] | undefined;
  createdAt?: string | undefined;

  updatedAt?: string | undefined;
}



export interface Allocation {
  invoiceId: string;
  amount: number;
}

export interface Transaction {
  id: string;
  code: string;
  date: string;
  sourceType: SourceType;
  accountId: string;
  direction: Direction;
  amount: number;
  category: CategoryId | null;
  partyId: string | null;
  particulars: string;
  reference?: string | undefined;
  paymentMethod?: string | undefined;
  notes?: string | undefined;
  attachmentName?: string | undefined;
  transferGroupId?: string | undefined;
  allocations?: Allocation[] | undefined;
  advanceAmount?: number | undefined;
  uchhinaReturnDate?: string | undefined;
  drawingCategory?: string | undefined;
  /** expense head, e.g. "Office Expenses" */
  expenseCategory?: string | undefined;
  /** false = recorded but not yet paid (no bank/cash effect) */
  expensePaid?: boolean | undefined;
  reconciled: boolean;
  voided: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  entity: string;
  detail: string;
  by: string;
}

export type ContactKind = "broker" | "seller";

/** Broker (purchase side) or seller / salesperson (sales side) master record. */
export interface Contact {
  id: string;
  kind: ContactKind;
  name: string;
  phone?: string | undefined;
  /** broker only */
  company?: string | undefined;
  /** seller only */
  role?: string | undefined;
  /** commission (broker) / incentive (seller) type */
  rateType: "percent" | "fixed";
  rate?: number | undefined;
  notes?: string | undefined;
}

/* ---------------- Liabilities ---------------- */

export type LiabilityKind =
  | "friends_family"
  | "gold_loan"
  | "credit_card"
  | "bank_loan"
  | "business_loan"
  | "other";

export interface Liability {
  id: string;
  kind: LiabilityKind;
  name: string;
  lender: string;
  originalAmount: number;
  interestRate?: number | undefined;
  emi?: number | undefined;
  nextDueDate?: string | undefined;
  notes?: string | undefined;
  closed?: boolean | undefined;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type LiabilityEntryType =
  | "received"
  | "principal_repaid"
  | "interest_paid"
  | "additional_borrowing"
  | "adjustment";

export interface LiabilityEntry {
  id: string;
  liabilityId: string;
  date: string;
  type: LiabilityEntryType;
  particulars: string;
  principal: number;
  interest: number;
  paidFrom?: string | undefined;
  sourceModule: string;
  sourceTxId?: string | undefined;
  voided: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/* ---------------- Stock ---------------- */

export interface StockEntry {
  id: string;
  stock: "diamond" | "gold";
  date: string;
  description: string;
  category?: string | undefined;
  karat?: string | undefined;
  colour?: string | undefined;
  qtyIn: number;
  qtyOut: number;
  rate: number;
  reason?: string | undefined;
  sourceModule: string;
  sourceTxId?: string | undefined;
  voided: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/* ---------------- Team ---------------- */

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  monthlySalary: number;
  incentiveType?: "percent" | "fixed" | undefined;
  incentiveRate?: number | undefined;
  active: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type TeamPaymentType =
  | "salary"
  | "incentive"
  | "bonus"
  | "reimbursement"
  | "deduction"
  | "advance";

export interface TeamPayment {
  id: string;
  memberId: string;
  date: string;
  type: TeamPaymentType;
  month: string;
  particulars: string;
  amount: number;
  paid: boolean;
  paidFrom?: string | undefined;
  sourceModule: string;
  sourceTxId?: string | undefined;
  voided: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/* ---------------- Goals ---------------- */

export interface Goal {
  id: string;
  scope: "overall" | "seller" | "platform";
  target: string;
  period: "yearly" | "monthly" | "daily";
  periodKey: string;
  amount: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/* ---------------- Settings ---------------- */

export interface AppSettings {
  business: {
    name: string;
    legalName: string;
    gstin: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    financialYearStart: string;
    currency: string;
  };
  branding: {
    primary: string;
    accent: string;
    font: string;
    invoiceHeader: string;
    invoiceFooter: string;
  };
  invoice: {
    salesPrefix: string;
    salesStart: number;
    purchasePrefix: string;
    purchaseStart: number;
    diamondFormat: string;
    jewelryFormat: string;
    defaultDueDays: number;
    defaultTaxRate: number;
    defaultDiscount: number;
    shipping: number;
    roundOff: boolean;
    terms: string;
    bankDetails: string;
    signature: string;
    /** print the platform name on the invoice PDF (off by default) */
    showPlatform?: boolean | undefined;
    /** print the due date on the invoice PDF (off by default) */
    showDueDate?: boolean | undefined;
  };
  rules: {
    duplicateProtection: boolean;
    autoAllocateOldest: boolean;
    allowEditAfterPayment: boolean;
    voidInsteadOfDelete: boolean;
    monthlyLockDate: string;
  };
  security: {
    role: string;
    twoPersonVoid: boolean;
  };
}

export interface LepdoData {
  bankAccounts: BankAccount[];
  cashLocations: CashLocation[];
  parties: Party[];
  brokers: Contact[];
  sellers: Contact[];
  salesInvoices: Invoice[];
  purchaseBills: Invoice[];
  transactions: Transaction[];
  auditLogs: AuditEntry[];
  liabilities: Liability[];
  liabilityEntries: LiabilityEntry[];
  stockEntries: StockEntry[];
  teamMembers: TeamMember[];
  teamPayments: TeamPayment[];
  goals: Goal[];
  settings: AppSettings;
}
