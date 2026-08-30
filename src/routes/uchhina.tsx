import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Download,
  ExternalLink,
  HandCoins,
  Scale,
  Search,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, formatMoney, todayISO } from "@/lib/lepdo/format";
import { useLepdo } from "@/lib/lepdo/store";
import { periodLabel } from "@/lib/lepdo/period";
import { useShell } from "@/components/lepdo/shell-context";
import { CASH_BOOKS } from "@/lib/lepdo/cash";
import {
  UCHHINA_GIVEN,
  UCHHINA_RECEIVED_BACK,
  UCHHINA_RETURNED,
  UCHHINA_TAKEN,
  buildPersonLedgers,
  uchhinaDirection,
  uchhinaTypeLabel,
  type PersonLedger,
  type UchhinaRow,
} from "@/lib/lepdo/uchhina";
import { downloadUchhinaExcel, downloadUchhinaPdf } from "@/lib/lepdo/uchhinaReport";

export const Route = createFileRoute("/uchhina")({
  head: () => ({
    meta: [
      { title: "Uchhina — LEPDO Accounting" },
      {
        name: "description",
        content:
          "Automatic person-wise Uchhina ledger for LEPDO: money taken, money returned and outstanding balances pulled straight from bank and cash entries.",
      },
      { property: "og:title", content: "Uchhina — LEPDO Accounting" },
      {
        property: "og:description",
        content:
          "Read-only person-wise Uchhina register with running balances and CA-ready Excel and PDF reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UchhinaPage,
});

function UchhinaPage() {
  const store = useLepdo();
  const shell = useShell();
  const { from, to, preset } = shell;
  const [person, setPerson] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [source, setSource] = useState<UchhinaRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const setQuickUchhina = shell.setQuickUchhina;
  useEffect(() => {
    setQuickUchhina(() => setFormOpen(true));
    return () => setQuickUchhina(null);
  }, [setQuickUchhina]);

  const allLedgers = useMemo(
    () =>
      buildPersonLedgers(
        store.transactions,
        store.parties,
        store.bankAccounts,
        store.cashLocations,
        from,
        to,
      ),
    [store.transactions, store.parties, store.bankAccounts, store.cashLocations, from, to],
  );

  const ledgers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allLedgers.filter(
      (l) =>
        (person === "all" || l.personId === person) && (!q || l.name.toLowerCase().includes(q)),
    );
  }, [allLedgers, person, search]);

  const totals = useMemo(
    () =>
      ledgers.reduce(
        (acc, l) => ({
          given: acc.given + l.periodGiven,
          taken: acc.taken + l.periodTaken,
          stillToReceive: acc.stillToReceive + l.stillToReceive,
          stillToPay: acc.stillToPay + l.stillToPay,
          net: acc.net + l.netBalance,
        }),
        { given: 0, taken: 0, stillToReceive: 0, stillToPay: 0, net: 0 },
      ),
    [ledgers],
  );

  const doDownload = (kind: "excel" | "pdf") => {
    const meta = {
      personLabel:
        person === "all"
          ? "All Persons"
          : (allLedgers.find((l) => l.personId === person)?.name ?? "All Persons"),
      periodLabel: `${periodLabel(preset)} (${formatDate(from)} – ${formatDate(to)})`,
      given: totals.given,
      stillToReceive: totals.stillToReceive,
      taken: totals.taken,
      stillToPay: totals.stillToPay,
    };
    if (kind === "excel") downloadUchhinaExcel(ledgers, meta);
    else if (!downloadUchhinaPdf(ledgers, meta)) {
      toast.error("Allow pop-ups to generate the PDF report.");
      return;
    }
    toast.success(`Uchhina report ready — ${meta.personLabel}.`);
  };

  const cards = [
    {
      key: "given",
      label: "Total Money Given",
      value: totals.given,
      icon: ArrowUpRight,
      cls: "bg-uch-advance-bg text-uch-advance",
      period: true,
    },
    {
      key: "receive",
      label: "Still to Receive",
      value: Math.max(0, totals.stillToReceive),
      icon: HandCoins,
      cls: "bg-uch-out-bg text-uch-out",
      period: false,
    },
    {
      key: "taken",
      label: "Total Money Taken",
      value: totals.taken,
      icon: ArrowDownLeft,
      cls: "bg-uch-taken-bg text-uch-taken",
      period: true,
    },
    {
      key: "pay",
      label: "Still to Pay",
      value: Math.max(0, totals.stillToPay),
      icon: Scale,
      cls: "bg-uch-pay-bg text-uch-pay",
      period: false,
    },
  ] as const;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="hidden text-xl font-semibold tracking-tight text-navy lg:block lg:text-2xl">
          Uchhina
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={person} onValueChange={setPerson}>
            <SelectTrigger aria-label="Person filter" className="h-9 w-[170px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All Persons</SelectItem>
              {allLedgers.map((l) => (
                <SelectItem key={l.personId} value={l.personId}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search person"
              value={search}
              placeholder="Search person"
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-[180px] pl-8 text-sm"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 border-gold text-navy">
                <Download className="size-4" /> Download Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{periodLabel(preset)}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => doDownload("excel")}>Excel (.xls)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => doDownload("pdf")}>PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.key} className={cn("rounded-xl border border-border p-4", c.cls)}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold leading-tight">{c.label}</p>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card/70">
                <c.icon className="size-[18px]" />
              </span>
            </div>
            <p className="num mt-3 text-xl font-semibold">{formatMoney(c.value)}</p>
            <p className="mt-1 text-xs opacity-70">
              {c.period ? `${formatDate(from)} – ${formatDate(to)}` : `As on ${formatDate(to)}`}
            </p>
          </div>
        ))}
      </div>

      <NetBalanceCard net={totals.net} asOn={to} />

      <p className="text-xs text-muted-foreground">
        Read-only. Uchhina figures are pulled automatically from Bank and Cash entries — edit or
        delete only from the original entry.
      </p>

      {ledgers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
          No Uchhina entries yet. Record an entry from Bank Ledger or Cash Book with the category
          “Uchhina — Money Taken” or “Uchhina — Money Returned”, and the person’s ledger will appear
          here automatically.
        </div>
      ) : (
        <div className="space-y-3">
          {ledgers.map((l) => (
            <PersonSection
              key={l.personId}
              ledger={l}
              open={open[l.personId] ?? true}
              onToggle={() => setOpen((s) => ({ ...s, [l.personId]: !(s[l.personId] ?? true) }))}
              onSource={setSource}
            />
          ))}
        </div>
      )}

      <QuickUchhinaDialog open={formOpen} onClose={() => setFormOpen(false)} />

      <Dialog open={!!source} onOpenChange={(o) => !o && setSource(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy">Source entry</DialogTitle>
            <DialogDescription>
              {source?.code} — edit or void this entry from{" "}
              {source?.sourceType === "bank" ? "Bank Ledger" : "Cash Book"}.
            </DialogDescription>
          </DialogHeader>
          {source ? (
            <SourceDetails row={source} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SourceDetails({ row }: { row: UchhinaRow }) {
  const store = useLepdo();
  const tx = store.transactions.find((t) => t.id === row.id);
  const items: [string, string][] = [
    ["Date", formatDate(row.date)],
    ["Entry type", uchhinaTypeLabel(row.category)],
    ["Account", row.account],
    ["Amount", formatMoney(row.amount)],
    ["Receivable after", formatMoney(row.receivable)],
    ["Payable after", formatMoney(row.payable)],
    ["Particulars", row.particulars],
    ["Reference", tx?.reference || "—"],
    ["Notes", tx?.notes || "—"],
    ["Last updated", tx ? formatDateTime(tx.updatedAt) : "—"],
  ];
  return (
    <dl className="space-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-border pb-1.5">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="max-w-[60%] break-words text-right font-medium text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function PersonSection({
  ledger,
  open,
  onToggle,
  onSource,
}: {
  ledger: PersonLedger;
  open: boolean;
  onToggle: () => void;
  onSource: (row: UchhinaRow) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-navy">
          <ChevronDown
            className={cn("size-4 transition-transform", open ? "" : "-rotate-90")}
            aria-hidden
          />
          {ledger.name}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-xs">
          <Stat label="Given" value={ledger.given} cls="bg-uch-advance-bg text-uch-advance" />
          <Stat
            label="Received Back"
            value={ledger.receivedBack}
            cls="bg-uch-returned-bg text-uch-returned"
          />
          <Stat
            label="Still to Receive"
            value={Math.max(0, ledger.stillToReceive)}
            cls="bg-uch-out-bg text-uch-out"
          />
          <Stat label="Taken" value={ledger.taken} cls="bg-uch-taken-bg text-uch-taken" />
          <Stat
            label="Returned"
            value={ledger.returned}
            cls="bg-uch-returned-bg text-uch-returned"
          />
          <Stat
            label="Still to Pay"
            value={Math.max(0, ledger.stillToPay)}
            cls="bg-uch-pay-bg text-uch-pay"
          />
          <Stat
            label="Net Balance"
            value={Math.abs(ledger.netBalance)}
            cls={netCls(ledger.netBalance)}
          />
        </span>
      </button>

      {open ? (
        ledger.rows.length === 0 ? (
          <p className="border-t border-border px-4 py-4 text-sm text-muted-foreground">
            No entries in the selected period.
          </p>
        ) : (
          <>
            <div className="hidden border-t border-border lg:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Entry Type</th>
                    <th className="px-3 py-2 text-left font-semibold">Particulars</th>
                    <th className="px-3 py-2 text-left font-semibold">Account</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="px-3 py-2 text-right font-semibold">Receivable</th>
                    <th className="px-3 py-2 text-right font-semibold">Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.rows.map((r) => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="whitespace-nowrap px-3 py-2">{formatDate(r.date)}</td>
                      <td className="px-3 py-2">
                        <TypeBadge row={r} />
                      </td>
                      <td className="max-w-[320px] px-3 py-2 text-muted-foreground">
                        <span className="block break-words">{r.particulars}</span>
                        <button
                          type="button"
                          onClick={() => onSource(r)}
                          className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-navy underline-offset-2 hover:underline"
                        >
                          <ExternalLink className="size-3" /> View Source Entry
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {r.account}
                      </td>
                      <td
                        className={cn(
                          "num whitespace-nowrap px-3 py-2 text-right font-medium",
                          typeCls(r.category).split(" ")[1],
                        )}
                      >
                        {formatMoney(r.amount)}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right font-semibold text-uch-out">
                        {formatMoney(r.receivable)}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right font-semibold text-uch-pay">
                        {formatMoney(r.payable)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border border-t border-border lg:hidden">
              {ledger.rows.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{formatDate(r.date)}</p>
                      <p className="mt-1 break-words text-sm font-medium text-navy">
                        {r.particulars}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <TypeBadge row={r} />
                        <span className="text-xs text-muted-foreground">{r.account}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSource(r)}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-navy underline-offset-2 hover:underline"
                      >
                        <ExternalLink className="size-3" /> View Source Entry
                      </button>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={cn(
                          "num text-sm font-semibold",
                          typeCls(r.category).split(" ")[1],
                        )}
                      >
                        {formatMoney(r.amount)}
                      </span>
                      <span className="num text-xs text-muted-foreground">
                        Rec {formatMoney(r.receivable)} · Pay {formatMoney(r.payable)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )
      ) : null}
    </section>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <span className={cn("rounded-md px-2 py-1 font-medium", cls)}>
      {label} <span className="num font-semibold">{formatMoney(value)}</span>
    </span>
  );
}

function typeCls(id: UchhinaRow["category"]): string {
  switch (id) {
    case UCHHINA_GIVEN:
      return "bg-uch-advance-bg text-uch-advance";
    case UCHHINA_RECEIVED_BACK:
      return "bg-uch-returned-bg text-uch-returned";
    case UCHHINA_TAKEN:
      return "bg-uch-taken-bg text-uch-taken";
    default:
      return "bg-uch-pay-bg text-uch-pay";
  }
}

function TypeBadge({ row }: { row: UchhinaRow }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium",
        typeCls(row.category),
      )}
    >
      {uchhinaTypeLabel(row.category)}
    </span>
  );
}

function netCls(net: number): string {
  if (net > 0) return "bg-uch-out-bg text-uch-out";
  if (net < 0) return "bg-uch-pay-bg text-uch-pay";
  return "bg-muted text-muted-foreground";
}

function NetBalanceCard({ net, asOn }: { net: number; asOn: string }) {
  const label = net > 0 ? "Net Receivable — We Have to Receive" : net < 0 ? "Net Payable — We Have to Pay" : "Settled";
  return (
    <div
      className={cn(
        "rounded-xl border-2 p-4 shadow-sm",
        net > 0
          ? "border-uch-out bg-uch-out-bg text-uch-out"
          : net < 0
            ? "border-uch-pay bg-uch-pay-bg text-uch-pay"
            : "border-border bg-muted text-muted-foreground",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card/70">
            <Scale className="size-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold">Net Uchhina Balance</p>
            <p className="text-xs opacity-70">
              Still to Receive − Still to Pay · As on {formatDate(asOn)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="num text-2xl font-semibold">{formatMoney(Math.abs(net))}</p>
          <p className="text-xs font-medium">{label}</p>
        </div>
      </div>
    </div>
  );
}

const TYPES = [
  { id: UCHHINA_GIVEN, label: "Money Given" },
  { id: UCHHINA_RECEIVED_BACK, label: "Money Received Back" },
  { id: UCHHINA_TAKEN, label: "Money Taken" },
  { id: UCHHINA_RETURNED, label: "Money Returned" },
] as const;

function QuickUchhinaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useLepdo();
  const banks = store.bankAccounts.filter((b) => b.active);
  const accounts = [
    ...banks.map((b) => ({ id: b.id, label: `${b.bankName} ••${b.last4}`, sourceType: "bank" as const })),
    ...CASH_BOOKS.map((c) => ({ id: c.id, label: `${c.short} Cash`, sourceType: "cash" as const })),
  ];
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [name, setName] = useState("");
  const [type, setType] = useState<UchhinaRow["category"]>(UCHHINA_GIVEN);
  const [particulars, setParticulars] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    setAccountId((prev) => prev || accounts[0]?.id || "");
    setName("");
    setType(UCHHINA_GIVEN);
    setParticulars("");
    setAmount("");
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = () => {
    const account = accounts.find((a) => a.id === accountId);
    const value = Number(amount);
    if (!account) {
      toast.error("Select a bank or cash account.");
      return;
    }
    if (!name.trim()) {
      toast.error("Person name is required.");
      return;
    }
    if (!particulars.trim()) {
      toast.error("Particulars are required.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    const existing = store.parties.find(
      (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    const party = existing ?? store.addParty(name.trim(), "other");
    const input = {
      date,
      sourceType: account.sourceType,
      accountId: account.id,
      direction: uchhinaDirection(type) ?? "out",
      amount: value,
      category: type,
      partyId: party.id,
      particulars: particulars.trim(),
      notes: notes.trim() || undefined,
    };
    if (store.isLikelyDuplicate(input)) {
      toast.error("A matching Uchhina entry already exists for this date and amount.");
      return;
    }
    const res = store.addEntry(input);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`${uchhinaTypeLabel(type)} recorded for ${party.name}.`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-navy">Quick Uchhina</DialogTitle>
          <DialogDescription>
            Saves the matching Bank or Cash entry automatically and updates this page instantly.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="uch-date">Date</Label>
            <Input id="uch-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger aria-label="Account">
                <SelectValue placeholder="Bank or Cash" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="uch-person">Person Name</Label>
            <Input
              id="uch-person"
              list="uch-people"
              value={name}
              placeholder="e.g. Ramesh Bhai"
              onChange={(e) => setName(e.target.value)}
            />
            <datalist id="uch-people">
              {store.parties.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Transaction Type</Label>
            <Select value={type ?? ""} onValueChange={(v) => setType(v as UchhinaRow["category"])}>
              <SelectTrigger aria-label="Transaction type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="uch-part">Particulars</Label>
            <Input
              id="uch-part"
              value={particulars}
              placeholder="Purpose of the Uchhina"
              onChange={(e) => setParticulars(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="uch-amt">Amount (₹)</Label>
            <Input
              id="uch-amt"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="uch-notes">Reference / Notes (optional)</Label>
            <Textarea
              id="uch-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>
            <Wallet className="size-4" /> Save Uchhina
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
