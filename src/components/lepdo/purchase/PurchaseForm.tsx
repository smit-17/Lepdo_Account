import { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { formatMoney, round2, todayISO, uid } from "@/lib/lepdo/format";
import { addDays } from "@/lib/lepdo/purchase";
import { downloadBillPdf } from "@/lib/lepdo/purchaseReport";
import { useLepdo } from "@/lib/lepdo/store";
import type { InvoiceLine, MakingLine } from "@/lib/lepdo/types";
import {
  CellLabel,
  ColHead,
  Combo,
  FormField,
  WIDE_MODAL_CLASS,
} from "@/components/lepdo/sales/ui";
import { ContactPicker } from "@/components/lepdo/ContactPicker";

type BillKind = "diamond" | "jewelry_making";
type PayMode = "pending" | "paid" | "part" | "advance";

const emptyLine = (): InvoiceLine => ({
  id: uid("ln"),
  description: "",
  quantity: 1,
  carat: 0,
  rate: 0,
  rateUsd: 0,
});

const emptyMaking = (): MakingLine => ({
  id: uid("mk"),
  description: "",
  quantity: 1,
  grossWeight: 0,
  netWeight: 0,
  diamondWeight: 0,
  makingRate: 0,
  total: 0,
});

const n = (v: string | number | undefined) => Number(v) || 0;

export function PurchaseForm({
  open,
  billId,
  onClose,
  onAddSupplier,
  onEditSupplier,
}: {
  open: boolean;
  billId: string | null;
  onClose: () => void;
  onAddSupplier: () => void;
  onEditSupplier: (id: string) => void;
}) {
  const store = useLepdo();
  const editing = billId ? store.purchaseBills.find((b) => b.id === billId) : undefined;

  const [kind, setKind] = useState<BillKind>("diamond");
  const [head, setHead] = useState({
    number: "",
    date: todayISO(),
    termsDays: "30",
    dueDate: addDays(todayISO(), 30),
    partyId: "",
    broker: "",
    supplierInvoiceNumber: "",
    usdRate: "",
    notes: "",
  });
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()]);
  const [making, setMaking] = useState<MakingLine[]>([emptyMaking()]);
  const [payMode, setPayMode] = useState<PayMode>("pending");
  const [pay, setPay] = useState({ amount: "", date: todayISO(), account: "", reference: "" });
  const [saving, setSaving] = useState(false);

  const suppliers = store.parties.filter((p) => p.type === "supplier" || p.type === "other");
  const accounts = [
    ...store.bankAccounts
      .filter((b) => b.active)
      .map((b) => ({ value: `bank:${b.id}`, label: `${b.bankName} — ${b.nickname}` })),
    ...store.cashLocations
      .filter((c) => c.active)
      .map((c) => ({ value: `cash:${c.id}`, label: `${c.name} Cash` })),
  ];
  const descriptions = [
    ...new Set(
      store.purchaseBills
        .flatMap((b) => [...(b.lines ?? []), ...(b.makingLines ?? [])])
        .map((l) => l.description.trim())
        .filter(Boolean),
    ),
  ];

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setPayMode("pending");
    setPay({ amount: "", date: todayISO(), account: "", reference: "" });
    if (editing) {
      setKind((editing.billKind ?? "diamond") as BillKind);
      setHead({
        number: editing.number,
        date: editing.date,
        termsDays: String(editing.paymentTermsDays ?? 30),
        dueDate: editing.dueDate ?? addDays(editing.date, editing.paymentTermsDays ?? 30),
        partyId: editing.partyId,
        broker: editing.brokerName ?? "",
        supplierInvoiceNumber: editing.supplierInvoiceNumber ?? "",
        usdRate: editing.usdRate ? String(editing.usdRate) : "",
        notes: editing.notes ?? "",
      });
      setLines((editing.lines ?? []).length ? [...(editing.lines ?? [])] : [emptyLine()]);
      setMaking(
        (editing.makingLines ?? []).length ? [...(editing.makingLines ?? [])] : [emptyMaking()],
      );
    } else {
      setKind("diamond");
      setHead({
        number: store.nextPurchaseBillNumber(),
        date: todayISO(),
        termsDays: "30",
        dueDate: addDays(todayISO(), 30),
        partyId: "",
        broker: "",
        supplierInvoiceNumber: "",
        usdRate: "",
        notes: "",
      });
      setLines([emptyLine()]);
      setMaking([emptyMaking()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, billId]);

  const usdRate = n(head.usdRate);

  const diamondRows = useMemo(
    () =>
      lines.map((l) => {
        const inr = round2(n(l.rateUsd) > 0 && usdRate > 0 ? n(l.rateUsd) * usdRate : n(l.rate));
        return { line: l, inr, total: round2(n(l.carat) * inr) };
      }),
    [lines, usdRate],
  );
  const makingRows = useMemo(
    () => making.map((m) => ({ line: m, total: round2(n(m.netWeight) * n(m.makingRate)) })),
    [making],
  );

  const grandTotal = round2(
    kind === "diamond"
      ? diamondRows.reduce((s, r) => s + r.total, 0)
      : makingRows.reduce((s, r) => s + r.total, 0),
  );

  const payAmount = round2(
    payMode === "paid" ? grandTotal : payMode === "pending" ? 0 : n(pay.amount),
  );
  const allocatedNow = round2(Math.min(payAmount, grandTotal));
  const advanceNow = round2(Math.max(0, payAmount - grandTotal));
  const pendingNow = round2(Math.max(0, grandTotal - allocatedNow));

  function setDate(date: string) {
    setHead((h) => ({ ...h, date, dueDate: addDays(date, n(h.termsDays)) }));
  }
  function setTerms(days: string) {
    setHead((h) => ({ ...h, termsDays: days, dueDate: addDays(h.date, n(days)) }));
  }

  function patchLine(id: string, patch: Partial<InvoiceLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function patchMaking(id: string, patch: Partial<MakingLine>) {
    setMaking((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function save(andPdf: boolean) {
    if (saving) return;
    const rowsFilled =
      kind === "diamond"
        ? diamondRows.filter((r) => r.line.description.trim() || r.total > 0)
        : makingRows.filter((r) => r.line.description.trim() || r.total > 0);
    if (!rowsFilled.length) {
      toast.error("Add at least one item with a description or amount.");
      return;
    }
    if (payMode !== "pending" && !pay.account) {
      toast.error("Select the bank or cash account for the payment.");
      return;
    }
    if ((payMode === "part" || payMode === "advance") && !(n(pay.amount) > 0)) {
      toast.error("Enter the amount paid.");
      return;
    }

    setSaving(true);
    const result = store.savePurchaseBill({
      id: editing?.id,
      number: head.number.trim(),
      partyId: head.partyId,
      date: head.date,
      dueDate: head.dueDate,
      paymentTermsDays: n(head.termsDays),
      brokerName: head.broker.trim() || undefined,
      supplierInvoiceNumber: head.supplierInvoiceNumber.trim() || undefined,
      billKind: kind,
      usdRate: kind === "diamond" && usdRate > 0 ? usdRate : undefined,
      lines:
        kind === "diamond"
          ? diamondRows.map((r) => ({
              id: r.line.id,
              description: r.line.description,
              quantity: n(r.line.quantity) || 1,
              carat: n(r.line.carat),
              rate: r.inr,
              rateUsd: n(r.line.rateUsd) || undefined,
            }))
          : [],
      makingLines:
        kind === "jewelry_making" ? makingRows.map((r) => ({ ...r.line, total: r.total })) : [],
      subtotal: grandTotal,
      total: grandTotal,
      notes: head.notes.trim() || undefined,
    });
    if (!result.ok) {
      toast.error(result.message);
      setSaving(false);
      return;
    }

    if (payMode !== "pending" && payAmount > 0 && result.id) {
      const [sourceType, accountId] = pay.account.split(":") as ["bank" | "cash", string];
      const entry = {
        date: pay.date,
        sourceType,
        accountId,
        direction: "out" as const,
        amount: payAmount,
        category: "purchase_payment" as const,
        partyId: head.partyId,
        particulars: `Purchase payment — ${head.number.trim()}`,
        reference: pay.reference || undefined,
        allocations: allocatedNow > 0 ? [{ invoiceId: result.id, amount: allocatedNow }] : [],
      };
      if (store.isLikelyDuplicate(entry)) {
        toast.error(
          "A matching payment already exists for this date, account, amount and reference.",
        );
      } else {
        const posted = store.addEntry(entry);
        if (!posted.ok) toast.error(posted.message);
      }
    }

    toast.success(
      advanceNow > 0
        ? `Bill saved · ${formatMoney(advanceNow)} kept as supplier advance.`
        : editing
          ? "Bill updated."
          : "Bill saved.",
    );

    if (andPdf) {
      const supplierName = store.parties.find((p) => p.id === head.partyId)?.name ?? "Supplier";
      downloadBillPdf(
        {
          id: result.id ?? "tmp",
          number: head.number.trim(),
          partyId: head.partyId,
          date: head.date,
          dueDate: head.dueDate,
          total: grandTotal,
          paid: allocatedNow,
          billKind: kind,
          brokerName: head.broker.trim() || undefined,
          supplierInvoiceNumber: head.supplierInvoiceNumber.trim() || undefined,
          usdRate: usdRate || undefined,
          subtotal: grandTotal,
          notes: head.notes.trim() || undefined,
          lines: kind === "diamond" ? diamondRows.map((r) => ({ ...r.line, rate: r.inr })) : [],
          makingLines:
            kind === "jewelry_making" ? makingRows.map((r) => ({ ...r.line, total: r.total })) : [],
        },
        supplierName,
      );
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={WIDE_MODAL_CLASS}>
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-navy">
            {editing ? "Edit purchase bill" : "Add purchase"}
          </DialogTitle>
          <DialogDescription>
            Totals are calculated automatically. Payments post a linked bank or cash entry.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-5 py-5">
          {/* bill type */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "diamond", label: "Diamond Purchase Invoice" },
                { id: "jewelry_making", label: "Jewelry Making Bill" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setKind(t.id)}
                className={
                  "rounded-xl border p-3 text-left text-sm font-medium transition " +
                  (kind === t.id
                    ? "border-gold bg-pu-total-bg text-pu-total"
                    : "border-border text-muted-foreground hover:bg-muted")
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* common fields */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Bill number" required>
              <Input
                value={head.number}
                onChange={(e) => setHead({ ...head, number: e.target.value })}
              />
            </FormField>
            <FormField label="Invoice date" required>
              <Input type="date" value={head.date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
            <FormField label="Payment terms (days)">
              <Input
                inputMode="decimal"
                value={head.termsDays}
                onChange={(e) => setTerms(e.target.value)}
              />
            </FormField>
            <FormField label="Due date" required hint="Auto from terms — editable">
              <Input
                type="date"
                value={head.dueDate}
                onChange={(e) => setHead({ ...head, dueDate: e.target.value })}
              />
            </FormField>
            <FormField label="Supplier" required>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1.5">
                <Select
                  value={head.partyId}
                  onValueChange={(v) => setHead({ ...head, partyId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Search / select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title="Add supplier"
                  onClick={onAddSupplier}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title="Edit supplier"
                  disabled={!head.partyId}
                  onClick={() => head.partyId && onEditSupplier(head.partyId)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </FormField>
            <FormField label="Broker">
              <ContactPicker
                kind="broker"
                value={head.broker}
                onChange={(v) => setHead({ ...head, broker: v })}
              />
            </FormField>
            <FormField label="Supplier invoice number">
              <Input
                value={head.supplierInvoiceNumber}
                onChange={(e) => setHead({ ...head, supplierInvoiceNumber: e.target.value })}
              />
            </FormField>
            {kind === "diamond" ? (
              <FormField
                label="USD conversion rate"
                hint="Optional — leave blank to enter INR rates directly"
              >
                <Input
                  inputMode="decimal"
                  value={head.usdRate}
                  onChange={(e) => setHead({ ...head, usdRate: e.target.value })}
                />
              </FormField>
            ) : null}
            <FormField label="Notes (optional)">
              <Textarea
                rows={1}
                value={head.notes}
                onChange={(e) => setHead({ ...head, notes: e.target.value })}
              />
            </FormField>
          </div>

          {/* items */}
          <div className="rounded-xl border border-border p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <p className="text-sm font-semibold text-navy">
                {kind === "diamond" ? "Diamond items" : "Jewelry making items"}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    kind === "diamond"
                      ? setLines((p) => [...p, emptyLine()])
                      : setMaking((p) => [...p, emptyMaking()])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Item
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    kind === "diamond"
                      ? setLines((p) =>
                          p.length ? [...p, { ...p[p.length - 1]!, id: uid("ln") }] : [emptyLine()],
                        )
                      : setMaking((p) =>
                          p.length
                            ? [...p, { ...p[p.length - 1]!, id: uid("mk") }]
                            : [emptyMaking()],
                        )
                  }
                >
                  <Copy className="mr-1 h-4 w-4" /> Copy This Item
                </Button>
              </div>
            </div>

            {kind === "diamond" ? (
              <div className="mt-3 space-y-2">
                <div className="hidden items-center gap-2 px-2 sm:grid sm:grid-cols-[32px_minmax(0,1fr)_80px_100px_110px_120px_40px]">
                  <ColHead label="Sr." />
                  <ColHead label="Description" />
                  <ColHead label="CT" className="text-right" />
                  <ColHead label="Price/CT USD" className="text-right" />
                  <ColHead label="Price/CT INR" className="text-right" />
                  <ColHead label="Total INR" className="text-right" />
                  <ColHead label="Act." />
                </div>
                {diamondRows.map((r, i) => (
                  <div
                    key={r.line.id}
                    className="grid grid-cols-2 items-end gap-2 rounded-lg border border-border p-2 sm:grid-cols-[32px_minmax(0,1fr)_80px_100px_110px_120px_40px] sm:items-center"
                  >
                    <span className="num text-xs text-muted-foreground sm:text-sm">{i + 1}</span>
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <CellLabel label="Description" />
                      <Combo
                        className="h-9"
                        value={r.line.description}
                        onChange={(v) => patchLine(r.line.id, { description: v })}
                        options={descriptions}
                        placeholder="Item description"
                      />
                    </div>
                    <div>
                      <CellLabel label="CT" />
                      <Input
                        className="h-9 text-right"
                        inputMode="decimal"
                        value={r.line.carat || ""}
                        onChange={(e) => patchLine(r.line.id, { carat: n(e.target.value) })}
                      />
                    </div>
                    <div>
                      <CellLabel label="Price/CT USD" />
                      <Input
                        className="h-9 text-right"
                        inputMode="decimal"
                        value={r.line.rateUsd || ""}
                        onChange={(e) => patchLine(r.line.id, { rateUsd: n(e.target.value) })}
                      />
                    </div>
                    <div>
                      <CellLabel label="Price/CT INR" />
                      <Input
                        className="h-9 text-right"
                        inputMode="decimal"
                        readOnly={n(r.line.rateUsd) > 0 && usdRate > 0}
                        value={n(r.line.rateUsd) > 0 && usdRate > 0 ? r.inr : r.line.rate || ""}
                        onChange={(e) => patchLine(r.line.id, { rate: n(e.target.value) })}
                      />
                    </div>
                    <div className="min-w-0">
                      <CellLabel label="Total INR" />
                      <p className="num truncate text-right text-sm font-semibold text-navy">
                        {formatMoney(r.total)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Delete item"
                      onClick={() =>
                        setLines((p) => (p.length > 1 ? p.filter((l) => l.id !== r.line.id) : p))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-neg" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="hidden items-center gap-2 px-2 lg:grid lg:grid-cols-[28px_minmax(0,1fr)_60px_80px_80px_90px_90px_110px_40px]">
                  <ColHead label="Sr." />
                  <ColHead label="Description" />
                  <ColHead label="Qty" className="text-right" />
                  <ColHead label="Gross WT" className="text-right" />
                  <ColHead label="Net WT" className="text-right" />
                  <ColHead label="Diamond WT" className="text-right" />
                  <ColHead label="Making Rate" className="text-right" />
                  <ColHead label="Total" className="text-right" />
                  <ColHead label="Act." />
                </div>
                {makingRows.map((r, i) => (
                  <div
                    key={r.line.id}
                    className="grid grid-cols-2 items-end gap-2 rounded-lg border border-border p-2 sm:grid-cols-3 lg:grid-cols-[28px_minmax(0,1fr)_60px_80px_80px_90px_90px_110px_40px] lg:items-center"
                  >
                    <span className="num text-xs text-muted-foreground lg:text-sm">{i + 1}</span>
                    <div className="col-span-2 min-w-0 sm:col-span-3 lg:col-span-1">
                      <CellLabel label="Description" />
                      <Combo
                        className="h-9"
                        value={r.line.description}
                        onChange={(v) => patchMaking(r.line.id, { description: v })}
                        options={descriptions}
                        placeholder="Item description"
                      />
                    </div>
                    <div>
                      <CellLabel label="Qty" />
                      <Input
                        className="h-9 text-right"
                        inputMode="decimal"
                        value={r.line.quantity || ""}
                        onChange={(e) => patchMaking(r.line.id, { quantity: n(e.target.value) })}
                      />
                    </div>
                    <div>
                      <CellLabel label="Gross WT" />
                      <Input
                        className="h-9 text-right"
                        inputMode="decimal"
                        value={r.line.grossWeight || ""}
                        onChange={(e) => patchMaking(r.line.id, { grossWeight: n(e.target.value) })}
                      />
                    </div>
                    <div>
                      <CellLabel label="Net WT" />
                      <Input
                        className="h-9 text-right"
                        inputMode="decimal"
                        value={r.line.netWeight || ""}
                        onChange={(e) => patchMaking(r.line.id, { netWeight: n(e.target.value) })}
                      />
                    </div>
                    <div>
                      <CellLabel label="Diamond WT" />
                      <Input
                        className="h-9 text-right"
                        inputMode="decimal"
                        value={r.line.diamondWeight || ""}
                        onChange={(e) =>
                          patchMaking(r.line.id, { diamondWeight: n(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <CellLabel label="Making Rate" />
                      <Input
                        className="h-9 text-right"
                        inputMode="decimal"
                        value={r.line.makingRate || ""}
                        onChange={(e) => patchMaking(r.line.id, { makingRate: n(e.target.value) })}
                      />
                    </div>
                    <div className="min-w-0">
                      <CellLabel label="Total" />
                      <p className="num truncate text-right text-sm font-semibold text-navy">
                        {formatMoney(r.total)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Delete item"
                      onClick={() =>
                        setMaking((p) => (p.length > 1 ? p.filter((m) => m.id !== r.line.id) : p))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-neg" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="num mt-3 flex justify-end">
              <div className="rounded-lg bg-pu-total-bg px-4 py-2 text-sm font-semibold text-pu-total">
                Grand Total {formatMoney(grandTotal)}
              </div>
            </div>
          </div>

          {/* payment */}
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm font-semibold text-navy">Payment</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  { id: "pending", label: "Pending" },
                  { id: "part", label: "Part Paid" },
                  { id: "paid", label: "Paid" },
                  { id: "advance", label: "Supplier Advance" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPayMode(m.id)}
                  className={
                    "rounded-lg border px-3 py-2 text-sm font-medium transition " +
                    (payMode === m.id
                      ? "border-gold bg-sl-paid-bg text-sl-paid"
                      : "border-border text-muted-foreground hover:bg-muted")
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>

            {payMode !== "pending" ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Amount paid" required>
                  <Input
                    inputMode="decimal"
                    readOnly={payMode === "paid"}
                    value={payMode === "paid" ? grandTotal : pay.amount}
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
                  <Select value={pay.account} onValueChange={(v) => setPay({ ...pay, account: v })}>
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
                <FormField label="Reference / UTR">
                  <Input
                    value={pay.reference}
                    onChange={(e) => setPay({ ...pay, reference: e.target.value })}
                  />
                </FormField>
              </div>
            ) : null}

            <div className="num mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-sl-paid-bg px-3 py-2 text-sm text-sl-paid">
                Allocated {formatMoney(allocatedNow)}
              </div>
              <div className="rounded-lg bg-sl-pending-bg px-3 py-2 text-sm text-sl-pending">
                Pending {formatMoney(pendingNow)}
              </div>
              <div className="rounded-lg bg-sl-advance-bg px-3 py-2 text-sm text-sl-advance">
                Supplier advance {formatMoney(advanceNow)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-border bg-card px-5 py-4">
          <Button disabled={saving} onClick={() => save(false)}>
            Save Bill
          </Button>
          <Button variant="outline" disabled={saving} onClick={() => save(true)}>
            Save &amp; Download PDF
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
