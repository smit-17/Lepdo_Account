import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMoney, round2, todayISO, uid } from "@/lib/lepdo/format";
import { useLepdo, type SalesInvoiceInput } from "@/lib/lepdo/store";
import { PLATFORMS } from "@/lib/lepdo/sales";
import {
  DEFAULT_HSN,
  buildInvoiceDocHtml,
  printInvoiceDoc,
  validateInvoice,
} from "@/lib/lepdo/invoiceDoc";

import type { InvoiceKind, JewelryItem, SaleType, StoneLine } from "@/lib/lepdo/types";
import { CustomerForm } from "./CustomerForm";
import { ContactPicker } from "@/components/lepdo/ContactPicker";
import {
  CellLabel,
  ColHead,
  Combo,
  CURRENCIES,
  FormField,
  KARATS,
  METAL_COLOURS,
  Row,
  SALE_TYPES,
  STONE_TYPES,
  WIDE_MODAL_CLASS,
} from "./ui";

const MM_SIZES = [
  "1.0 mm",
  "1.2 mm",
  "1.5 mm",
  "1.8 mm",
  "2.0 mm",
  "2.5 mm",
  "3.0 mm",
  "4.0 mm",
  "5.0 mm",
];

interface DiamondRow {
  id: string;
  description: string;
  hsnCode: string;
  pcs: number;
  carat: number;
  rate: number;
}

const emptyDiamond = (): DiamondRow => ({
  id: uid("ln"),
  description: "",
  hsnCode: DEFAULT_HSN,
  pcs: 1,
  carat: 0,
  rate: 0,
});


const emptyStone = (): StoneLine => ({
  id: uid("st"),
  stoneType: "Lab Grown Diamond",
  size: "",
  carat: 0,
  rate: 0,
  value: 0,
});

const emptyJewelry = (): JewelryItem => ({
  id: uid("jw"),
  description: "",
  karat: "14KT",
  metalColour: "Yellow",
  netWeight: 0,
  finePercent: 58.5,
  fineGram: 0,
  metalRate: 0,
  metalValue: 0,
  makingRate: 0,
  makingValue: 0,
  stones: [emptyStone()],
  stoneValue: 0,
  total: 0,
});

function computeJewelry(item: JewelryItem): JewelryItem {
  const fineGram = round2(((Number(item.netWeight) || 0) * (Number(item.finePercent) || 0)) / 100);
  const metalValue = round2(fineGram * (Number(item.metalRate) || 0));
  const makingValue = round2((Number(item.netWeight) || 0) * (Number(item.makingRate) || 0));
  const stones = item.stones.map((s) => ({
    ...s,
    value: round2((Number(s.carat) || 0) * (Number(s.rate) || 0)),
  }));
  const stoneValue = round2(stones.reduce((s, x) => s + x.value, 0));
  return {
    ...item,
    fineGram,
    metalValue,
    makingValue,
    stones,
    stoneValue,
    total: round2(metalValue + makingValue + stoneValue),
  };
}

type PayMode = "pending" | "part" | "full";

export function SaleForm({
  open,
  editId,
  onClose,
}: {
  open: boolean;
  editId: string | null;
  onClose: () => void;
}) {
  const store = useLepdo();
  const editing = editId ? store.salesInvoices.find((i) => i.id === editId) : undefined;
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<InvoiceKind | null>(null);
  const [numberLocked, setNumberLocked] = useState(true);
  const [customerFormId, setCustomerFormId] = useState<string | null>(null);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");

  const [form, setForm] = useState({
    number: "",
    date: todayISO(),
    dueDate: todayISO(),
    partyId: "",
    sellerName: "",
    platform: PLATFORMS[0] as string,
    currency: "INR",
    exchangeRate: "1",
    saleType: "ue" as SaleType,
    discount: "",
    shipping: "",
    notes: "",
  });
  const [diamondRows, setDiamondRows] = useState<DiamondRow[]>([emptyDiamond()]);
  const [jewelry, setJewelry] = useState<JewelryItem[]>([emptyJewelry()]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const [payMode, setPayMode] = useState<PayMode>("pending");
  const [pay, setPay] = useState({
    amount: "",
    date: todayISO(),
    account: "",
    reference: "",
  });

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setNumberLocked(true);
    setCustomerQuery("");
    setPayMode("pending");
    setPay({ amount: "", date: todayISO(), account: "", reference: "" });
    if (editing) {
      setKind(editing.invoiceKind ?? "diamond");
      setForm({
        number: editing.number,
        date: editing.date,
        dueDate: editing.dueDate ?? editing.date,
        partyId: editing.partyId,
        sellerName: editing.sellerName ?? "",
        platform: editing.platform ?? PLATFORMS[0],
        currency: editing.currency ?? "INR",
        exchangeRate: String(editing.exchangeRate ?? 1),
        saleType: editing.saleType ?? "ue",
        discount: editing.discount ? String(editing.discount) : "",
        shipping: editing.shipping ? String(editing.shipping) : "",
        notes: editing.notes ?? "",
      });
      setDiamondRows(
        editing.lines?.length
          ? editing.lines.map((l) => ({
              id: l.id,
              description: l.description,
              hsnCode: l.hsnCode || DEFAULT_HSN,
              pcs: l.quantity || 1,
              carat: l.carat,
              rate: l.rate,
            }))
          : [emptyDiamond()],
      );

      setJewelry(
        editing.jewelryItems?.length
          ? editing.jewelryItems.map((i) => ({ ...i }))
          : [emptyJewelry()],
      );
      return;
    }
    setKind(null);
    const today = todayISO();
    const due = new Date(today);
    due.setUTCDate(due.getUTCDate() + 15);
    setForm({
      number: store.nextInvoiceNumber(),
      date: today,
      dueDate: due.toISOString().slice(0, 10),
      partyId: "",
      sellerName: "",
      platform: PLATFORMS[0],
      currency: "INR",
      exchangeRate: "1",
      saleType: "ue",
      discount: "",
      shipping: "",
      notes: "",
    });
    setDiamondRows([emptyDiamond()]);
    setJewelry([emptyJewelry()]);
    setExpanded(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  const computedJewelry = useMemo(() => jewelry.map(computeJewelry), [jewelry]);
  const diamondTotals = useMemo(() => {
    const rows = diamondRows.map((r) => ({
      ...r,
      amount: round2((Number(r.carat) || 0) * (Number(r.rate) || 0)),
    }));
    return {
      rows,
      carat: round2(rows.reduce((s, r) => s + (Number(r.carat) || 0), 0)),
      subtotal: round2(rows.reduce((s, r) => s + r.amount, 0)),
    };
  }, [diamondRows]);

  const jewelryTotals = useMemo(
    () => ({
      weight: round2(computedJewelry.reduce((s, i) => s + (Number(i.netWeight) || 0), 0)),
      carat: round2(
        computedJewelry.reduce(
          (s, i) => s + i.stones.reduce((a, x) => a + (Number(x.carat) || 0), 0),
          0,
        ),
      ),
      metal: round2(computedJewelry.reduce((s, i) => s + i.metalValue, 0)),
      making: round2(computedJewelry.reduce((s, i) => s + i.makingValue, 0)),
      stone: round2(computedJewelry.reduce((s, i) => s + i.stoneValue, 0)),
      subtotal: round2(computedJewelry.reduce((s, i) => s + i.total, 0)),
    }),
    [computedJewelry],
  );

  const subtotal = kind === "jewelry" ? jewelryTotals.subtotal : diamondTotals.subtotal;
  const discount = round2(Number(form.discount) || 0);
  const shipping = round2(Number(form.shipping) || 0);
  const grandTotal = round2(Math.max(0, subtotal - discount + shipping));
  const rate = Number(form.exchangeRate) || 0;
  const isForeign = form.currency !== "INR";
  const inrTotal = isForeign ? round2(grandTotal * rate) : grandTotal;
  const payableTotal = inrTotal;

  const customers = store.parties.filter(
    (p) =>
      (p.type === "customer" || p.type === "other") &&
      (!customerQuery || p.name.toLowerCase().includes(customerQuery.toLowerCase())),
  );

  const accounts = [
    ...store.bankAccounts
      .filter((b) => b.active)
      .map((b) => ({ value: `bank:${b.id}`, label: `${b.bankName} — ${b.nickname}` })),
    ...store.cashLocations
      .filter((c) => c.active)
      .map((c) => ({ value: `cash:${c.id}`, label: `${c.name} Cash` })),
  ];

  const uniq = (list: (string | undefined)[]) =>
    [...new Set(list.map((x) => (x ?? "").trim()).filter(Boolean))].sort();
  const platformOptions = uniq([...PLATFORMS, ...store.salesInvoices.map((i) => i.platform)]);
  const descriptionOptions = uniq([
    ...store.salesInvoices.flatMap((i) => (i.lines ?? []).map((l) => l.description)),
    ...store.salesInvoices.flatMap((i) => (i.jewelryItems ?? []).map((j) => j.description)),
  ]);
  const karatOptions = uniq([
    ...KARATS,
    ...store.salesInvoices.flatMap((i) => (i.jewelryItems ?? []).map((j) => j.karat)),
  ]);
  const colourOptions = uniq([
    ...METAL_COLOURS,
    ...store.salesInvoices.flatMap((i) => (i.jewelryItems ?? []).map((j) => j.metalColour)),
  ]);
  const stoneOptions = uniq([
    ...STONE_TYPES,
    ...store.salesInvoices.flatMap((i) =>
      (i.jewelryItems ?? []).flatMap((j) => j.stones.map((s) => s.stoneType)),
    ),
  ]);
  const sizeOptions = uniq([
    ...MM_SIZES,
    ...store.salesInvoices.flatMap((i) =>
      (i.jewelryItems ?? []).flatMap((j) => j.stones.map((s) => s.size)),
    ),
  ]);
  const referenceOptions = uniq(store.transactions.map((t) => t.reference));

  const receivedNow =
    payMode === "full" ? payableTotal : payMode === "part" ? round2(Number(pay.amount) || 0) : 0;

  function buildPayload(): SalesInvoiceInput {
    const lines =
      kind === "jewelry"
        ? []
        : diamondTotals.rows
            .filter((r) => r.description.trim() && r.amount > 0)
            .map((r) => ({
              id: r.id,
              description: r.description.trim(),
              hsnCode: r.hsnCode?.trim() || DEFAULT_HSN,
              quantity: Number(r.pcs) || 1,
              carat: Number(r.carat) || 0,
              rate: Number(r.rate) || 0,
            }));

    return {
      id: editing?.id,
      number: form.number,
      partyId: form.partyId,
      date: form.date,
      dueDate: form.dueDate,
      sellerName: form.sellerName || undefined,
      platform: form.platform,
      invoiceKind: kind ?? "diamond",
      jewelryItems:
        kind === "jewelry"
          ? computedJewelry.filter((i) => i.description.trim() && i.total > 0)
          : [],
      foreignTotal: isForeign ? grandTotal : undefined,
      saleType: form.saleType,
      currency: form.currency,
      exchangeRate: isForeign ? rate : 1,
      gstType: form.saleType === "gst_inr" ? "igst" : "non_gst",
      gstRate: 0,
      lines,
      subtotal: isForeign ? round2(subtotal * rate) : subtotal,
      discount: isForeign ? round2(discount * rate) : discount,
      taxableAmount: inrTotal,
      taxAmount: 0,
      shipping: isForeign ? round2(shipping * rate) : shipping,
      roundOff: 0,
      total: inrTotal,
      notes: form.notes || undefined,
    };
  }

  function validatePayment(): string | null {
    if (payMode === "pending") return null;
    if (!pay.account) return "Select the bank or cash account that received the payment.";
    if (!pay.date) return "Payment date is required.";
    if (payMode === "part") {
      const amt = round2(Number(pay.amount) || 0);
      if (!(amt > 0)) return "Part received amount must be above ₹0.";
      if (amt >= payableTotal) return "Part received amount must be below the grand total.";
    }
    return null;
  }

  function submit(downloadPdf: boolean) {
    if (saving) return;
    if (isForeign && !(rate > 0)) {
      toast.error("Enter the exchange rate for a non-INR invoice.");
      return;
    }
    const payError = validatePayment();
    if (payError) {
      toast.error(payError);
      return;
    }
    setSaving(true);
    const payload = buildPayload();
    const result = store.saveSalesInvoice(payload);
    if (!result.ok || !result.id) {
      toast.error(result.message);
      setSaving(false);
      return;
    }

    if (receivedNow > 0 && pay.account && !editing) {
      const [sourceType, accountId] = pay.account.split(":") as ["bank" | "cash", string];
      const entry = {
        date: pay.date,
        sourceType,
        accountId,
        direction: "in" as const,
        amount: receivedNow,
        category: "sale_payment" as const,
        partyId: payload.partyId,
        particulars: `Sales receipt against ${payload.number}`,
        reference: pay.reference || undefined,
        allocations: [{ invoiceId: result.id, amount: receivedNow }],
      };
      if (store.isLikelyDuplicate(entry)) {
        toast.warning("A matching receipt already exists — payment was not duplicated.");
      } else {
        const rec = store.addEntry(entry);
        if (!rec.ok) toast.error(rec.message);
      }
    }

    toast.success(result.message);
    if (downloadPdf) {
      const invoice = {
        ...payload,
        id: result.id,
        paid: receivedNow,
        currency: payload.currency ?? "INR",
      } as never as import("@/lib/lepdo/types").Invoice;
      const customer = store.parties.find((p) => p.id === payload.partyId);
      const errors = validateInvoice(invoice, receivedNow);
      if (errors.length) {
        toast.error(`PDF not generated — ${errors[0]}`);
      } else {
        const ok = printInvoiceDoc(
          buildInvoiceDocHtml({ invoice, customer, settings: store.settings, received: receivedNow }),
        );
        if (!ok) toast.error("Allow pop-ups to download the invoice PDF.");
      }
    }

    onClose();
  }

  const setJw = (id: string, patch: Partial<JewelryItem>) =>
    setJewelry((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className={WIDE_MODAL_CLASS}>
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4 pr-12 text-left">
            <DialogTitle className="text-navy">
              {editing ? `Edit ${editing.number}` : "Add sale"}
            </DialogTitle>
            <DialogDescription>
              {kind
                ? `${kind === "jewelry" ? "Jewelry" : "Diamond"} invoice · totals are calculated automatically.`
                : "Choose the invoice format to continue."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-5 py-5">
            {!kind ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(["diamond", "jewelry"] as InvoiceKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className="rounded-xl border border-border bg-sl-total-bg p-5 text-left transition-shadow hover:shadow-sm"
                  >
                    <p className="text-base font-semibold text-navy">
                      {k === "diamond" ? "Diamond Invoice" : "Jewelry Invoice"}
                    </p>
                    <p className="mt-1 text-xs text-sl-total">
                      {k === "diamond"
                        ? "Carat × Price/CT line items."
                        : "Metal, making charges and stone lines per item."}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="Invoice date" required>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Due date" required>
                    <Input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Invoice number" required>
                    <div className="flex gap-2">
                      <Input
                        value={form.number}
                        disabled={numberLocked}
                        onChange={(e) => setForm({ ...form, number: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setNumberLocked((v) => !v)}
                      >
                        {numberLocked ? "Edit" : "Lock"}
                      </Button>
                    </div>
                  </FormField>

                  <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                    <FormField label="Customer" required>
                      <Select
                        value={form.partyId}
                        onValueChange={(v) => setForm({ ...form, partyId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              placeholder="Search customer"
                              value={customerQuery}
                              onChange={(e) => setCustomerQuery(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </div>
                          {customers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCustomerFormId(null);
                          setCustomerFormOpen(true);
                        }}
                      >
                        <Plus className="size-4" /> Add Customer
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!form.partyId}
                        onClick={() => {
                          setCustomerFormId(form.partyId);
                          setCustomerFormOpen(true);
                        }}
                      >
                        Edit Customer
                      </Button>
                    </div>
                  </div>

                  <FormField label="Seller" hint="Search a saved seller, or add a new one.">
                    <ContactPicker
                      kind="seller"
                      value={form.sellerName}
                      onChange={(v) => setForm({ ...form, sellerName: v })}
                    />
                  </FormField>
                  <FormField label="Order platform" hint="Select or type a new platform.">
                    <Combo
                      value={form.platform}
                      options={platformOptions}
                      onChange={(v) => setForm({ ...form, platform: v })}
                    />
                  </FormField>
                  <FormField label="Sale type" hint="UE, UI, Export, GST INR or a custom type.">
                    <Combo
                      value={
                        SALE_TYPES.find((s) => s.id === form.saleType)?.label ??
                        String(form.saleType)
                      }
                      options={SALE_TYPES.map((s) => s.label)}
                      onChange={(v) => {
                        const hit = SALE_TYPES.find(
                          (s) => s.label.toLowerCase() === v.trim().toLowerCase(),
                        );
                        setForm({ ...form, saleType: (hit ? hit.id : v) as SaleType });
                      }}
                    />
                  </FormField>
                  <FormField label="Currency" hint="Select or type a currency code.">
                    <Combo
                      value={form.currency}
                      options={CURRENCIES}
                      onChange={(v) => setForm({ ...form, currency: v.toUpperCase() })}
                    />
                  </FormField>

                  {isForeign ? (
                    <FormField label={`Exchange rate (1 ${form.currency} → ₹)`} required>
                      <Input
                        inputMode="decimal"
                        value={form.exchangeRate}
                        onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })}
                      />
                    </FormField>
                  ) : null}
                </div>

                {/* items */}
                {kind === "diamond" ? (
                  <div className="rounded-xl border border-border bg-muted/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-navy">Diamond items</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const row = emptyDiamond();
                            setDiamondRows([...diamondRows, row]);
                            setSelectedRow(row.id);
                          }}
                        >
                          <Plus className="size-4" /> Add Item
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          title="Duplicate the selected row so you can edit the copy"
                          onClick={() => {
                            const idx = diamondRows.findIndex((x) => x.id === selectedRow);
                            const at = idx >= 0 ? idx : diamondRows.length - 1;
                            const src = diamondRows[at];
                            if (!src) return;
                            const copy = { ...src, id: uid("ln") };
                            setDiamondRows([
                              ...diamondRows.slice(0, at + 1),
                              copy,
                              ...diamondRows.slice(at + 1),
                            ]);
                            setSelectedRow(copy.id);
                          }}
                        >
                          <Copy className="size-4" /> Copy This Item
                        </Button>
                      </div>
                    </div>

                    {/* permanent column titles (desktop) */}
                    <div className="mt-3 hidden gap-2 px-2 sm:grid sm:[grid-template-columns:repeat(16,minmax(0,1fr))]">
                      <ColHead label="Sr. No." className="sm:col-span-1" />
                      <ColHead label="Description" className="sm:col-span-4" />
                      <ColHead label="HSN Code" className="sm:col-span-2" />
                      <ColHead label="PCS" className="sm:col-span-1" />
                      <ColHead label="CT" className="sm:col-span-1" />
                      <ColHead label="Price/CT" className="sm:col-span-2" />
                      <ColHead label="Total Amount" className="sm:col-span-2" />
                      <ColHead label="Actions" className="sm:col-span-3" />
                    </div>

                    <div className="mt-2 space-y-2">
                      {diamondTotals.rows.map((r, idx) => (
                        <div
                          key={r.id}
                          onFocus={() => setSelectedRow(r.id)}
                          className={cn(
                            "grid grid-cols-1 gap-2 rounded-lg border bg-card p-2 sm:items-center sm:[grid-template-columns:repeat(16,minmax(0,1fr))]",
                            selectedRow === r.id
                              ? "border-navy ring-1 ring-navy/30"
                              : "border-border",
                          )}
                        >
                          <div className="sm:col-span-1">
                            <CellLabel label="Sr. No." />
                            <span className="num text-sm font-medium text-muted-foreground">
                              {idx + 1}
                            </span>
                          </div>
                          <div className="min-w-0 sm:col-span-4">
                            <CellLabel label="Description" />
                            <Combo
                              className="h-9"
                              value={r.description}
                              options={descriptionOptions}
                              placeholder="Select or type description"
                              onChange={(v) =>
                                setDiamondRows(
                                  diamondRows.map((x, i) =>
                                    i === idx ? { ...x, description: v } : x,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="min-w-0 sm:col-span-2">
                            <CellLabel label="HSN Code" />
                            <Combo
                              className="h-9"
                              value={r.hsnCode}
                              options={[DEFAULT_HSN, "71023910", "71131900"]}
                              placeholder="HSN"
                              onChange={(v) =>
                                setDiamondRows(
                                  diamondRows.map((x, i) => (i === idx ? { ...x, hsnCode: v } : x)),
                                )
                              }
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <CellLabel label="PCS" />
                            <Input
                              className="h-9"
                              inputMode="numeric"
                              value={String(r.pcs)}
                              onChange={(e) =>
                                setDiamondRows(
                                  diamondRows.map((x, i) =>
                                    i === idx ? { ...x, pcs: Number(e.target.value) || 0 } : x,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <CellLabel label="CT" />
                            <Input
                              className="h-9"
                              inputMode="decimal"
                              value={String(r.carat)}
                              onChange={(e) =>
                                setDiamondRows(
                                  diamondRows.map((x, i) =>
                                    i === idx ? { ...x, carat: Number(e.target.value) || 0 } : x,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <CellLabel label="Price/CT" />
                            <Input
                              className="h-9"
                              inputMode="decimal"
                              value={String(r.rate)}
                              onChange={(e) =>
                                setDiamondRows(
                                  diamondRows.map((x, i) =>
                                    i === idx ? { ...x, rate: Number(e.target.value) || 0 } : x,
                                  ),
                                )
                              }
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <CellLabel label="Total Amount (CT × Price/CT)" />
                            <span className="num block text-sm font-semibold text-navy">
                              {formatMoney(r.amount)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 sm:col-span-3">
                            <CellLabel label="Actions" />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs"
                              title="Select this row for editing"
                              onClick={() => setSelectedRow(r.id)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs"
                              title="Duplicate this row"
                              onClick={() => {
                                const copy = { ...r, id: uid("ln") };
                                setDiamondRows([
                                  ...diamondRows.slice(0, idx + 1),
                                  copy,
                                  ...diamondRows.slice(idx + 1),
                                ]);
                                setSelectedRow(copy.id);
                              }}
                            >
                              Copy
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs text-neg"
                              title="Delete this row"
                              disabled={diamondRows.length === 1}
                              onClick={() =>
                                setDiamondRows(diamondRows.filter((_, i) => i !== idx))
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="num mt-3 text-xs text-muted-foreground">
                      Total carat {diamondTotals.carat} · Subtotal{" "}
                      {formatMoney(diamondTotals.subtotal)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-navy">Jewelry items</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const item = emptyJewelry();
                            setJewelry([...jewelry, item]);
                            setExpanded(item.id);
                            setSelectedItem(item.id);
                          }}
                        >
                          <Plus className="size-4" /> Add Item
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          title="Duplicate the selected item so you can edit the copy"
                          onClick={() => {
                            const target = selectedItem ?? expanded;
                            const idx = computedJewelry.findIndex((x) => x.id === target);
                            const at = idx >= 0 ? idx : computedJewelry.length - 1;
                            const src = computedJewelry[at];
                            if (!src) return;
                            const copy: JewelryItem = {
                              ...src,
                              id: uid("jw"),
                              stones: src.stones.map((s) => ({ ...s, id: uid("st") })),
                            };
                            setJewelry([
                              ...jewelry.slice(0, at + 1),
                              copy,
                              ...jewelry.slice(at + 1),
                            ]);
                            setExpanded(copy.id);
                            setSelectedItem(copy.id);
                          }}
                        >
                          <Copy className="size-4" /> Copy This Item
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {computedJewelry.map((it, idx) => {
                        const isOpen = expanded === it.id;
                        return (
                          <div
                            key={it.id}
                            onFocus={() => setSelectedItem(it.id)}
                            className={cn(
                              "rounded-lg border bg-card",
                              (selectedItem ?? expanded) === it.id
                                ? "border-navy ring-1 ring-navy/30"
                                : "border-border",
                            )}
                          >
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-2">
                              <button
                                type="button"
                                className="flex min-w-0 items-center gap-2 text-left"
                                onClick={() => {
                                  setExpanded(isOpen ? null : it.id);
                                  setSelectedItem(it.id);
                                }}
                              >
                                {isOpen ? (
                                  <ChevronDown className="size-4 shrink-0 text-navy" />
                                ) : (
                                  <ChevronRight className="size-4 shrink-0 text-navy" />
                                )}
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-navy">
                                    {idx + 1}. {it.description || `Item ${idx + 1}`}
                                  </span>
                                  <span className="num block truncate text-[11px] text-muted-foreground">
                                    {it.karat} · {it.netWeight}g · {formatMoney(it.total)}
                                  </span>
                                </span>
                              </button>
                              <div className="flex shrink-0 flex-wrap gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-xs"
                                  title="Open this item for editing"
                                  onClick={() => {
                                    setExpanded(it.id);
                                    setSelectedItem(it.id);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-xs"
                                  title="Duplicate this item"
                                  onClick={() => {
                                    const copy: JewelryItem = {
                                      ...it,
                                      id: uid("jw"),
                                      stones: it.stones.map((s) => ({ ...s, id: uid("st") })),
                                    };
                                    setJewelry([
                                      ...jewelry.slice(0, idx + 1),
                                      copy,
                                      ...jewelry.slice(idx + 1),
                                    ]);
                                    setExpanded(copy.id);
                                    setSelectedItem(copy.id);
                                  }}
                                >
                                  Copy
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-xs text-neg"
                                  title="Delete this item"
                                  disabled={jewelry.length === 1}
                                  onClick={() => setJewelry(jewelry.filter((_, i) => i !== idx))}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>

                            {isOpen ? (
                              <div className="space-y-3 border-t border-border p-3">
                                <div>
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sl-total">
                                    A · Product and metal
                                  </p>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <FormField label="Sr. No.">
                                      <Input
                                        readOnly
                                        value={String(idx + 1)}
                                        className="bg-muted"
                                      />
                                    </FormField>
                                    <FormField label="Description">
                                      <Combo
                                        value={it.description}
                                        options={descriptionOptions}
                                        onChange={(v) => setJw(it.id, { description: v })}
                                      />
                                    </FormField>
                                    <FormField label="Metal KT" hint="Select or type a new karat.">
                                      <Combo
                                        value={it.karat}
                                        options={karatOptions}
                                        onChange={(v) => setJw(it.id, { karat: v })}
                                      />
                                    </FormField>
                                    <FormField
                                      label="Metal Colour"
                                      hint="Select or type a new colour."
                                    >
                                      <Combo
                                        value={it.metalColour}
                                        options={colourOptions}
                                        onChange={(v) => setJw(it.id, { metalColour: v })}
                                      />
                                    </FormField>
                                    <FormField label="Metal Weight / Gram">
                                      <Input
                                        inputMode="decimal"
                                        value={String(it.netWeight)}
                                        onChange={(e) =>
                                          setJw(it.id, { netWeight: Number(e.target.value) || 0 })
                                        }
                                      />
                                    </FormField>
                                    <FormField label="Fine 999 %">
                                      <Input
                                        inputMode="decimal"
                                        value={String(it.finePercent)}
                                        onChange={(e) =>
                                          setJw(it.id, { finePercent: Number(e.target.value) || 0 })
                                        }
                                      />
                                    </FormField>
                                    <FormField
                                      label="Fine 999 Gram"
                                      hint="Weight × Fine % — calculated."
                                    >
                                      <Input
                                        readOnly
                                        value={String(it.fineGram)}
                                        className="bg-muted"
                                      />
                                    </FormField>
                                    <FormField label="Metal Price / Gram">
                                      <Input
                                        inputMode="decimal"
                                        value={String(it.metalRate)}
                                        onChange={(e) =>
                                          setJw(it.id, { metalRate: Number(e.target.value) || 0 })
                                        }
                                      />
                                    </FormField>
                                    <FormField
                                      label="Total Metal Value"
                                      hint="Fine gram × price — calculated."
                                    >
                                      <Input
                                        readOnly
                                        value={formatMoney(it.metalValue)}
                                        className="bg-muted"
                                      />
                                    </FormField>
                                  </div>
                                </div>

                                <div>
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sl-part">
                                    B · Making charges
                                  </p>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <FormField label="Making Charge / Gram">
                                      <Input
                                        inputMode="decimal"
                                        value={String(it.makingRate)}
                                        onChange={(e) =>
                                          setJw(it.id, { makingRate: Number(e.target.value) || 0 })
                                        }
                                      />
                                    </FormField>
                                    <FormField
                                      label="Total Making Charges"
                                      hint="Weight × making rate — calculated."
                                    >
                                      <Input
                                        readOnly
                                        value={formatMoney(it.makingValue)}
                                        className="bg-muted"
                                      />
                                    </FormField>
                                  </div>
                                </div>

                                <div>
                                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-sl-advance">
                                      C · Diamond / stone
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          setJw(it.id, { stones: [...it.stones, emptyStone()] })
                                        }
                                      >
                                        <Plus className="size-4" /> Add Stone
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        title="Duplicate the last stone line"
                                        onClick={() => {
                                          const last = it.stones[it.stones.length - 1];
                                          if (!last) return;
                                          setJw(it.id, {
                                            stones: [...it.stones, { ...last, id: uid("st") }],
                                          });
                                        }}
                                      >
                                        <Copy className="size-4" /> Copy Stone
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="hidden gap-2 px-2 sm:grid sm:grid-cols-12">
                                    <ColHead label="Stone Type" className="sm:col-span-3" />
                                    <ColHead label="Size / MM" className="sm:col-span-2" />
                                    <ColHead label="Carat" className="sm:col-span-2" />
                                    <ColHead label="Price / CT" className="sm:col-span-2" />
                                    <ColHead label="Stone Value" className="sm:col-span-3" />
                                  </div>
                                  <div className="mt-1 space-y-2">
                                    {it.stones.map((s, si) => (
                                      <div
                                        key={s.id}
                                        className="grid grid-cols-1 gap-2 rounded-lg border border-border p-2 sm:grid-cols-12 sm:items-center"
                                      >
                                        <div className="min-w-0 sm:col-span-3">
                                          <CellLabel label="Stone Type" />
                                          <Combo
                                            className="h-9"
                                            value={s.stoneType}
                                            options={stoneOptions}
                                            onChange={(v) =>
                                              setJw(it.id, {
                                                stones: it.stones.map((x, i) =>
                                                  i === si ? { ...x, stoneType: v } : x,
                                                ),
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="min-w-0 sm:col-span-2">
                                          <CellLabel label="Size / MM" />
                                          <Combo
                                            className="h-9"
                                            value={s.size}
                                            options={sizeOptions}
                                            placeholder="Select or type size"
                                            onChange={(v) =>
                                              setJw(it.id, {
                                                stones: it.stones.map((x, i) =>
                                                  i === si ? { ...x, size: v } : x,
                                                ),
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="sm:col-span-2">
                                          <CellLabel label="Carat" />
                                          <Input
                                            className="h-9"
                                            inputMode="decimal"
                                            value={String(s.carat)}
                                            onChange={(e) =>
                                              setJw(it.id, {
                                                stones: it.stones.map((x, i) =>
                                                  i === si
                                                    ? { ...x, carat: Number(e.target.value) || 0 }
                                                    : x,
                                                ),
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="sm:col-span-2">
                                          <CellLabel label="Price / CT" />
                                          <Input
                                            className="h-9"
                                            inputMode="decimal"
                                            value={String(s.rate)}
                                            onChange={(e) =>
                                              setJw(it.id, {
                                                stones: it.stones.map((x, i) =>
                                                  i === si
                                                    ? { ...x, rate: Number(e.target.value) || 0 }
                                                    : x,
                                                ),
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="flex items-center justify-between gap-1 sm:col-span-3">
                                          <div className="min-w-0">
                                            <CellLabel label="Stone Value (Carat × Price/CT)" />
                                            <span className="num text-sm font-medium">
                                              {formatMoney(s.value)}
                                            </span>
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 px-2 text-xs"
                                              title="Duplicate this stone line"
                                              onClick={() =>
                                                setJw(it.id, {
                                                  stones: [
                                                    ...it.stones.slice(0, si + 1),
                                                    { ...s, id: uid("st") },
                                                    ...it.stones.slice(si + 1),
                                                  ],
                                                })
                                              }
                                            >
                                              Copy
                                            </Button>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 px-2 text-xs text-neg"
                                              title="Delete this stone line"
                                              disabled={it.stones.length === 1}
                                              onClick={() =>
                                                setJw(it.id, {
                                                  stones: it.stones.filter((_, i) => i !== si),
                                                })
                                              }
                                            >
                                              Delete
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="num flex items-center justify-between rounded-lg bg-sl-total-bg px-3 py-2 text-sm font-semibold text-sl-total">
                                  <span>Jewelry item value</span>
                                  <span>{formatMoney(it.total)}</span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <div className="num mt-3 grid grid-cols-2 gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                      <span>Total metal weight: {jewelryTotals.weight} g</span>
                      <span>Total carat: {jewelryTotals.carat}</span>
                      <span>Total metal: {formatMoney(jewelryTotals.metal)}</span>
                      <span>Total making: {formatMoney(jewelryTotals.making)}</span>
                      <span>Total stone: {formatMoney(jewelryTotals.stone)}</span>
                      <span>Subtotal: {formatMoney(jewelryTotals.subtotal)}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label={`Discount (${form.currency})`}>
                    <Input
                      inputMode="decimal"
                      value={form.discount}
                      onChange={(e) => setForm({ ...form, discount: e.target.value })}
                    />
                  </FormField>
                  <FormField label={`Shipping / other (${form.currency})`}>
                    <Input
                      inputMode="decimal"
                      value={form.shipping}
                      onChange={(e) => setForm({ ...form, shipping: e.target.value })}
                    />
                  </FormField>
                </div>

                <div className="num space-y-1 rounded-xl border border-border bg-sl-total-bg p-3 text-sm text-sl-total">
                  <Row
                    label="Subtotal"
                    value={`${isForeign ? form.currency + " " : ""}${subtotal.toFixed(2)}`}
                  />
                  <Row
                    label="Discount"
                    value={`${isForeign ? form.currency + " " : ""}${discount.toFixed(2)}`}
                  />
                  <Row
                    label="Shipping / other"
                    value={`${isForeign ? form.currency + " " : ""}${shipping.toFixed(2)}`}
                  />
                  <div className="mt-1 flex items-center justify-between border-t border-sl-total/20 pt-2 text-base font-semibold">
                    <span>Grand total{isForeign ? ` (${form.currency})` : ""}</span>
                    <span>
                      {isForeign
                        ? `${form.currency} ${grandTotal.toFixed(2)}`
                        : formatMoney(grandTotal)}
                    </span>
                  </div>
                  {isForeign ? (
                    <div className="flex items-center justify-between pt-1 text-sm font-semibold">
                      <span>Converted INR total</span>
                      <span>{formatMoney(inrTotal)}</span>
                    </div>
                  ) : null}
                </div>

                {/* payment at creation */}
                <div className="rounded-xl border border-border p-3">
                  <p className="text-sm font-semibold text-navy">Payment</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(
                      [
                        { id: "full", label: "Full Advance" },
                        { id: "part", label: "Part Received" },
                        { id: "pending", label: "Pending" },
                      ] as { id: PayMode; label: string }[]
                    ).map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        disabled={!!editing}
                        onClick={() => setPayMode(o.id)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm font-medium",
                          payMode === o.id
                            ? "border-navy bg-navy text-navy-foreground"
                            : "border-border text-muted-foreground",
                          editing && "opacity-60",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {editing ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Edit payments and allocations from Add Payment so no receipt is duplicated.
                    </p>
                  ) : payMode !== "pending" ? (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <FormField label="Amount received" required>
                        <Input
                          inputMode="decimal"
                          disabled={payMode === "full"}
                          value={payMode === "full" ? payableTotal.toFixed(2) : pay.amount}
                          onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Payment date" required>
                        <Input
                          type="date"
                          value={pay.date}
                          onChange={(e) => setPay({ ...pay, date: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Bank / cash account" required>
                        <Select
                          value={pay.account}
                          onValueChange={(v) => setPay({ ...pay, account: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem key={a.value} value={a.value}>
                                {a.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>
                      <FormField
                        label="Reference / UTR"
                        hint="Select a past reference or type a new one."
                      >
                        <Combo
                          value={pay.reference}
                          options={referenceOptions}
                          onChange={(v) => setPay({ ...pay, reference: v })}
                        />
                      </FormField>
                    </div>
                  ) : null}
                  <p className="num mt-2 text-xs text-muted-foreground">
                    Pending after saving:{" "}
                    {formatMoney(round2(Math.max(0, payableTotal - receivedNow)))}
                  </p>
                </div>

                <FormField label="Notes (optional)">
                  <Textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </FormField>
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 border-t border-border bg-card px-5 py-4">
            {kind ? (
              <>
                <Button disabled={saving} onClick={() => submit(false)}>
                  {editing ? "Save changes" : "Save Invoice"}
                </Button>
                <Button variant="outline" disabled={saving} onClick={() => submit(true)}>
                  Save &amp; Download PDF
                </Button>
              </>
            ) : null}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CustomerForm
        open={customerFormOpen}
        customerId={customerFormId}
        onClose={() => setCustomerFormOpen(false)}
        onSaved={(id) => setForm((f) => ({ ...f, partyId: id }))}
      />
    </>
  );
}
