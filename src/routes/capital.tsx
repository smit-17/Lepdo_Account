import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Landmark, MoreVertical, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, formatMoney, todayISO } from "@/lib/lepdo/format";
import { useLepdo, partyName } from "@/lib/lepdo/store";
import { useShell } from "@/components/lepdo/shell-context";
import { PageHeading } from "@/components/lepdo/bits";
import {
  StatCard,
  Chip,
  SectionCard,
  EmptyState,
  DownloadMenu,
  ModalShell,
  Field,
  TextField,
  usePaged,
  Pager,
  AuditLine,
  TONE,
} from "@/components/lepdo/shared";
import {
  buildCapitalViews,
  buildLiabilityView,
  LIABILITY_KINDS,
  LIABILITY_ENTRY_TYPES,
  liabilityKindLabel,
  liabilityTypeLabel,
  type Tone,
} from "@/lib/lepdo/extras";
import type { ExportTable } from "@/lib/lepdo/exportTable";
import type { Liability, LiabilityEntry, LiabilityKind, Transaction } from "@/lib/lepdo/types";

export const Route = createFileRoute("/capital")({
  head: () => ({
    meta: [
      { title: "Capital, Investment & Liabilities — LEPDO Accounting" },
      {
        name: "description",
        content:
          "Founder capital, investment and liability register for LEPDO — capital balances, borrowings, EMIs and interest, derived automatically from Bank and Cash entries.",
      },
      { property: "og:title", content: "Capital, Investment & Liabilities — LEPDO Accounting" },
      {
        property: "og:description",
        content: "Track founder capital, investments and liabilities with running balances and audit trail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CapitalPage,
});

function CapitalPage() {
  const store = useLepdo();
  const [tab, setTab] = useState("capital");

  if (!store.ready) {
    return (
      <div className="space-y-4 pb-8">
        <PageHeading title="Capital, Investment & Liabilities" breadcrumb="Accounting" />
        <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <PageHeading title="Capital, Investment & Liabilities" breadcrumb="Accounting" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="capital">Capital &amp; Investment</TabsTrigger>
          <TabsTrigger value="liabilities">Liabilities</TabsTrigger>
        </TabsList>
        <TabsContent value="capital" className="mt-4">
          {tab === "capital" ? <CapitalTab /> : null}
        </TabsContent>
        <TabsContent value="liabilities" className="mt-4">
          {tab === "liabilities" ? <LiabilitiesTab /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ================= Capital & Investment ================= */

function CapitalTab() {
  const store = useLepdo();
  const [source, setSource] = useState<Transaction | null>(null);

  const buckets = useMemo(
    () => buildCapitalViews(store.transactions, (id) => partyName(store.parties, id)),
    [store.transactions, store.parties],
  );

  const total = useMemo(
    () =>
      buckets.reduce(
        (acc, b) => ({
          invested: acc.invested + b.invested,
          withdrawn: acc.withdrawn + b.withdrawn,
          balance: acc.balance + b.balance,
        }),
        { invested: 0, withdrawn: 0, balance: 0 },
      ),
    [buckets],
  );

  const allRows = useMemo(
    () =>
      buckets
        .flatMap((b) => b.rows.map((t) => ({ ...t, bucketLabel: b.label })))
        .sort((a, b) => (a.date === b.date ? a.code.localeCompare(b.code) : b.date.localeCompare(a.date))),
    [buckets],
  );

  // running balance needs oldest-first computation, then reverse for display
  const withBalance = useMemo(() => {
    const asc = [...allRows].sort((a, b) =>
      a.date === b.date ? a.code.localeCompare(b.code) : a.date.localeCompare(b.date),
    );
    let bal = 0;
    const map = new Map<string, number>();
    for (const t of asc) {
      bal += t.category === "owner_investment" ? t.amount : -t.amount;
      map.set(t.id, bal);
    }
    return allRows.map((t) => ({ ...t, balance: map.get(t.id) ?? 0 }));
  }, [allRows]);

  const paged = usePaged(withBalance, 25);

  const buildExport = (): ExportTable => ({
    title: "Capital & Investment Ledger",
    subtitle: `As on ${formatDate(todayISO())}`,
    columns: [
      { key: "date", label: "Date", date: true },
      { key: "account", label: "Account / Party" },
      { key: "type", label: "Type" },
      { key: "particulars", label: "Particulars" },
      { key: "invested", label: "Invested", money: true, align: "right" },
      { key: "withdrawn", label: "Withdrawn", money: true, align: "right" },
      { key: "balance", label: "Balance", money: true, align: "right" },
    ],
    rows: withBalance.map((t) => ({
      date: t.date,
      account: `${partyName(store.parties, t.partyId)} — ${t.bucketLabel}`,
      type: t.category === "owner_investment" ? "Investment" : "Withdrawal",
      particulars: t.particulars,
      invested: t.category === "owner_investment" ? t.amount : "",
      withdrawn: t.category === "owner_drawing" ? t.amount : "",
      balance: t.balance,
    })),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {buckets.map((b) => (
          <SectionCard key={b.key} className="p-0">
            <div className={cn("rounded-xl p-4", TONE[b.tone].bg)}>
              <p className={cn("text-sm font-semibold", TONE[b.tone].text)}>{b.label}</p>
              <dl className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <dt className={TONE[b.tone].text}>Invested</dt>
                  <dd className={cn("num font-semibold", TONE[b.tone].text)}>{formatMoney(b.invested)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className={TONE[b.tone].text}>Withdrawn</dt>
                  <dd className={cn("num font-semibold", TONE[b.tone].text)}>{formatMoney(b.withdrawn)}</dd>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1">
                  <dt className={cn("font-medium", TONE[b.tone].text)}>Current Balance</dt>
                  <dd className={cn("num font-bold", TONE[b.tone].text)}>{formatMoney(b.balance)}</dd>
                </div>
              </dl>
            </div>
          </SectionCard>
        ))}
        <StatCard
          label="Total Capital"
          tone="navy"
          icon={<Landmark className="size-4" />}
          value={formatMoney(total.balance)}
          hint={`Invested ${formatMoney(total.invested)} · Withdrawn ${formatMoney(total.withdrawn)}`}
        />
      </div>

      <SectionCard
        title="Capital & Investment Entries"
        actions={<DownloadMenu build={buildExport} label="Download" />}
      >
        <p className="mb-3 text-xs text-muted-foreground">
          Read-only. These rows come from Bank/Cash entries with category Owner Investment or Owner
          Drawing — edit or void from the original entry.
        </p>
        {withBalance.length === 0 ? (
          <EmptyState
            title="No capital transactions yet"
            hint="Record an Owner Investment or Owner Drawing entry from Bank Ledger or Cash Book."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Account / Party</th>
                    <th className="px-3 py-2 text-left font-semibold">Type</th>
                    <th className="px-3 py-2 text-left font-semibold">Particulars</th>
                    <th className="px-3 py-2 text-right font-semibold">Invested</th>
                    <th className="px-3 py-2 text-right font-semibold">Withdrawn</th>
                    <th className="px-3 py-2 text-right font-semibold">Balance</th>
                    <th className="w-8 px-2 py-2" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map((t) => (
                    <tr key={t.id} className="border-t border-border align-top">
                      <td className="whitespace-nowrap px-3 py-2">{formatDate(t.date)}</td>
                      <td className="px-3 py-2">
                        {partyName(store.parties, t.partyId)}
                        <span className="block text-xs text-muted-foreground">{t.bucketLabel}</span>
                      </td>
                      <td className="px-3 py-2">
                        <Chip tone={t.category === "owner_investment" ? "green" : "red"}>
                          {t.category === "owner_investment" ? "Investment" : "Withdrawal"}
                        </Chip>
                      </td>
                      <td className="max-w-[260px] px-3 py-2 text-muted-foreground">
                        <span className="block break-words">{t.particulars}</span>
                        <button
                          type="button"
                          onClick={() => setSource(t)}
                          className="mt-0.5 text-xs font-semibold text-navy underline"
                        >
                          View source entry
                        </button>
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right">
                        {t.category === "owner_investment" ? formatMoney(t.amount) : "—"}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right">
                        {t.category === "owner_drawing" ? formatMoney(t.amount) : "—"}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right font-semibold text-navy">
                        {formatMoney(t.balance)}
                      </td>
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border lg:hidden">
              {paged.slice.map((t) => (
                <li key={t.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                      <p className="mt-0.5 text-sm font-medium text-navy">
                        {partyName(store.parties, t.partyId)} — {t.bucketLabel}
                      </p>
                      <p className="mt-0.5 break-words text-xs text-muted-foreground">{t.particulars}</p>
                      <div className="mt-1">
                        <Chip tone={t.category === "owner_investment" ? "green" : "red"}>
                          {t.category === "owner_investment" ? "Investment" : "Withdrawal"}
                        </Chip>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSource(t)}
                        className="mt-1.5 text-xs font-semibold text-navy underline"
                      >
                        View source entry
                      </button>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="num text-sm font-semibold text-foreground">
                        {formatMoney(t.amount)}
                      </span>
                      <span className="num text-xs text-muted-foreground">Bal {formatMoney(t.balance)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Pager {...paged} />
          </>
        )}
      </SectionCard>

      <Dialog open={!!source} onOpenChange={(o) => !o && setSource(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy">Source entry</DialogTitle>
            <DialogDescription>
              {source?.code} — {source?.sourceType === "bank" ? "Bank Ledger" : "Cash Book"} entry.
            </DialogDescription>
          </DialogHeader>
          {source ? (
            <dl className="space-y-2 text-sm">
              {[
                ["Date", formatDate(source.date)],
                ["Party", partyName(store.parties, source.partyId)],
                ["Amount", formatMoney(source.amount)],
                ["Particulars", source.particulars],
                ["Reference", source.reference || "—"],
                ["Notes", source.notes || "—"],
                ["Created", formatDateTime(source.createdAt)],
                ["Updated", formatDateTime(source.updatedAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-border pb-1.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="max-w-[60%] break-words text-right font-medium text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================= Liabilities ================= */

interface LiabForm {
  id: string | null;
  kind: LiabilityKind;
  name: string;
  lender: string;
  originalAmount: string;
  interestRate: string;
  emi: string;
  nextDueDate: string;
  notes: string;
}

const emptyLiabForm = (): LiabForm => ({
  id: null,
  kind: "friends_family",
  name: "",
  lender: "",
  originalAmount: "",
  interestRate: "",
  emi: "",
  nextDueDate: "",
  notes: "",
});

interface EntryForm {
  liabilityId: string;
  date: string;
  type: LiabilityEntry["type"];
  particulars: string;
  principal: string;
  interest: string;
  paidFrom: string;
}

const emptyEntryForm = (liabilityId: string): EntryForm => ({
  liabilityId,
  date: todayISO(),
  type: "principal_repaid",
  particulars: "",
  principal: "",
  interest: "",
  paidFrom: "",
});

function LiabilitiesTab() {
  const store = useLepdo();
  const shell = useShell();
  const { from, to } = shell;
  const [liabFormOpen, setLiabFormOpen] = useState(false);
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [editingLiab, setEditingLiab] = useState<Liability | null>(null);
  const [voidingLiab, setVoidingLiab] = useState<Liability | null>(null);
  const [voidingEntry, setVoidingEntry] = useState<LiabilityEntry | null>(null);
  const [sourceTx, setSourceTx] = useState<Transaction | null>(null);
  const [filterId, setFilterId] = useState<string>("all");

  const liabilities = store.liabilities.filter((l) => !l.closed || true);
  const views = useMemo(
    () => liabilities.map((l) => buildLiabilityView(l, store.liabilityEntries)),
    [liabilities, store.liabilityEntries],
  );

  const grouped = LIABILITY_KINDS.map((k) => ({
    kind: k,
    items: views.filter((v) => v.liability.kind === k.id),
  })).filter((g) => g.items.length > 0);

  const linkedTxIds = useMemo(
    () =>
      new Set(
        store.liabilityEntries.filter((e) => !e.voided && e.sourceTxId).map((e) => e.sourceTxId as string),
      ),
    [store.liabilityEntries],
  );

  const suggested = useMemo(
    () =>
      store.transactions.filter(
        (t) =>
          !t.voided &&
          (t.category === "loan_emi" || t.category === "interest") &&
          t.direction === "out" &&
          !linkedTxIds.has(t.id),
      ),
    [store.transactions, linkedTxIds],
  );

  const allRows = useMemo(() => {
    const rows: (LiabilityEntry & { balance: number; paid: number; liabName: string })[] = [];
    for (const v of views) {
      for (const r of v.rows) {
        rows.push({ ...r, liabName: v.liability.name });
      }
    }
    return rows
      .filter((r) => (filterId === "all" || r.liabilityId === filterId) && r.date >= from && r.date <= to)
      .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : b.date.localeCompare(a.date)));
  }, [views, filterId, from, to]);

  const paged = usePaged(allRows, 25);

  const buildExport = (): ExportTable => ({
    title: "Liabilities Ledger",
    subtitle: `${formatDate(from)} – ${formatDate(to)}`,
    columns: [
      { key: "date", label: "Date", date: true },
      { key: "account", label: "Account" },
      { key: "type", label: "Type" },
      { key: "particulars", label: "Particulars" },
      { key: "principal", label: "Principal", money: true, align: "right" },
      { key: "interest", label: "Interest", money: true, align: "right" },
      { key: "paid", label: "Paid", money: true, align: "right" },
      { key: "balance", label: "Balance", money: true, align: "right" },
    ],
    rows: allRows.map((r) => ({
      date: r.date,
      account: r.liabName,
      type: liabilityTypeLabel(r.type),
      particulars: r.particulars,
      principal: r.principal,
      interest: r.interest,
      paid: r.paid,
      balance: r.balance,
    })),
  });

  const importSuggested = (t: Transaction) => {
    const liabilityId = filterId !== "all" ? filterId : views[0]?.liability.id;
    if (!liabilityId) {
      toast.error("Add a liability first before importing this transaction.");
      return;
    }
    const rec = store.stamp("liabent", {
      liabilityId,
      date: t.date,
      type: (t.category === "interest" ? "interest_paid" : "principal_repaid") as LiabilityEntry["type"],
      particulars: t.particulars,
      principal: t.category === "interest" ? 0 : t.amount,
      interest: t.category === "interest" ? t.amount : 0,
      paidFrom: t.accountId,
      sourceModule: t.sourceType === "bank" ? "Bank Entry" : "Cash Entry",
      sourceTxId: t.id,
      voided: false,
    });
    store.saveRecord("liabilityEntries", rec);
    toast.success("Transaction imported into liability ledger.");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Note: borrowed money is not income, principal repayment is not an expense — only interest and
        eligible charges affect P&amp;L. Credit-card purchases keep their actual expense category.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Ledger period: {formatDate(from)} – {formatDate(to)} · outstanding balances are all-time.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-9 border-gold text-navy"
            onClick={() => setEntryFormOpen(true)}
          >
            <Plus className="size-4" /> Add Entry
          </Button>
          <Button
            className="h-9 bg-navy text-navy-foreground hover:bg-navy/90"
            onClick={() => {
              setEditingLiab(null);
              setLiabFormOpen(true);
            }}
          >
            <Plus className="size-4" /> Add Liability
          </Button>
        </div>
      </div>

      {suggested.length > 0 ? (
        <SectionCard title="Suggested from Bank/Cash Entries">
          <ul className="divide-y divide-border">
            {suggested.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-navy">{formatMoney(t.amount)} — {t.particulars}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(t.date)} · {t.category === "interest" ? "Interest" : "Loan EMI"} ·{" "}
                    {t.sourceType === "bank" ? "Bank" : "Cash"} entry {t.code}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => importSuggested(t)}>
                  Import
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {grouped.length === 0 ? (
        <EmptyState
          title="No liabilities recorded yet"
          hint="Add a liability (loan, credit card, borrowing) to start tracking it here."
        />
      ) : (
        grouped.map((g) => (
          <SectionCard key={g.kind.id} title={g.kind.label}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((v) => (
                <LiabilityCard
                  key={v.liability.id}
                  view={v}
                  tone={g.kind.tone}
                  onEdit={() => {
                    setEditingLiab(v.liability);
                    setLiabFormOpen(true);
                  }}
                  onVoid={() => setVoidingLiab(v.liability)}
                  onFilter={() => setFilterId(v.liability.id)}
                />
              ))}
            </div>
          </SectionCard>
        ))
      )}

      <SectionCard
        title="Liability Ledger"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterId} onValueChange={setFilterId}>
              <SelectTrigger aria-label="Filter liability" className="h-9 w-[180px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">All Liabilities</SelectItem>
                {store.liabilities.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DownloadMenu build={buildExport} label="Download" />
          </div>
        }
      >
        {allRows.length === 0 ? (
          <EmptyState title="No entries in the selected period." />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Account</th>
                    <th className="px-3 py-2 text-left font-semibold">Type</th>
                    <th className="px-3 py-2 text-left font-semibold">Particulars</th>
                    <th className="px-3 py-2 text-right font-semibold">Principal</th>
                    <th className="px-3 py-2 text-right font-semibold">Interest</th>
                    <th className="px-3 py-2 text-right font-semibold">Paid</th>
                    <th className="px-3 py-2 text-right font-semibold">Balance</th>
                    <th className="w-8 px-2 py-2" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map((r) => (
                    <tr
                      key={r.id}
                      className={cn("border-t border-border align-top", r.voided ? "opacity-50 line-through" : "")}
                    >
                      <td className="whitespace-nowrap px-3 py-2">{formatDate(r.date)}</td>
                      <td className="px-3 py-2">{r.liabName}</td>
                      <td className="px-3 py-2">
                        <Chip tone="grey">{liabilityTypeLabel(r.type)}</Chip>
                      </td>
                      <td className="max-w-[240px] px-3 py-2 text-muted-foreground">
                        <span className="block break-words">{r.particulars}</span>
                        <AuditLine
                          record={r}
                          sourceModule={r.sourceModule}
                          onViewSource={
                            r.sourceTxId
                              ? () => {
                                  const tx = store.transactions.find((t) => t.id === r.sourceTxId);
                                  if (tx) setSourceTx(tx);
                                }
                              : undefined
                          }
                        />
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right">
                        {r.principal ? formatMoney(r.principal) : "—"}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right">
                        {r.interest ? formatMoney(r.interest) : "—"}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right">{formatMoney(r.paid)}</td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right font-semibold text-navy">
                        {formatMoney(r.balance)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8" aria-label="Row actions">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive"
                              disabled={r.voided}
                              onClick={() => setVoidingEntry(r)}
                            >
                              Void
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border lg:hidden">
              {paged.slice.map((r) => (
                <li key={r.id} className={cn("py-3", r.voided ? "opacity-50 line-through" : "")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{formatDate(r.date)}</p>
                      <p className="mt-0.5 text-sm font-medium text-navy">{r.liabName}</p>
                      <p className="mt-0.5 break-words text-xs text-muted-foreground">{r.particulars}</p>
                      <div className="mt-1">
                        <Chip tone="grey">{liabilityTypeLabel(r.type)}</Chip>
                      </div>
                      <AuditLine
                        record={r}
                        sourceModule={r.sourceModule}
                        onViewSource={
                          r.sourceTxId
                            ? () => {
                                const tx = store.transactions.find((t) => t.id === r.sourceTxId);
                                if (tx) setSourceTx(tx);
                              }
                            : undefined
                        }
                      />
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="num text-sm font-semibold text-foreground">{formatMoney(r.paid)}</span>
                      <span className="num text-xs text-muted-foreground">Bal {formatMoney(r.balance)}</span>
                      {!r.voided ? (
                        <Button variant="ghost" size="sm" className="h-6 px-1 text-xs text-destructive" onClick={() => setVoidingEntry(r)}>
                          Void
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Pager {...paged} />
          </>
        )}
      </SectionCard>

      <LiabilityFormModal
        open={liabFormOpen}
        editing={editingLiab}
        onClose={() => {
          setLiabFormOpen(false);
          setEditingLiab(null);
        }}
      />

      <EntryFormModal
        open={entryFormOpen}
        liabilities={store.liabilities}
        defaultLiabilityId={filterId !== "all" ? filterId : (store.liabilities[0]?.id ?? "")}
        onClose={() => setEntryFormOpen(false)}
      />

      <AlertDialog open={!!voidingLiab} onOpenChange={(o) => !o && setVoidingLiab(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this liability?</AlertDialogTitle>
            <AlertDialogDescription>
              {voidingLiab
                ? `${voidingLiab.name} will be marked closed/void and excluded from totals. It stays visible for audit.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (voidingLiab) {
                  store.setRecordVoided("liabilities", voidingLiab.id, true);
                  toast.success("Liability voided.");
                }
                setVoidingLiab(null);
              }}
            >
              Void
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!voidingEntry} onOpenChange={(o) => !o && setVoidingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {voidingEntry
                ? `${formatMoney(voidingEntry.principal + voidingEntry.interest)} on ${formatDate(voidingEntry.date)} will be excluded from totals.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (voidingEntry) {
                  store.setRecordVoided("liabilityEntries", voidingEntry.id, true);
                  toast.success("Entry voided.");
                }
                setVoidingEntry(null);
              }}
            >
              Void
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!sourceTx} onOpenChange={(o) => !o && setSourceTx(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy">Source entry</DialogTitle>
            <DialogDescription>{sourceTx?.code}</DialogDescription>
          </DialogHeader>
          {sourceTx ? (
            <dl className="space-y-2 text-sm">
              {[
                ["Date", formatDate(sourceTx.date)],
                ["Amount", formatMoney(sourceTx.amount)],
                ["Particulars", sourceTx.particulars],
                ["Reference", sourceTx.reference || "—"],
                ["Created", formatDateTime(sourceTx.createdAt)],
                ["Updated", formatDateTime(sourceTx.updatedAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-border pb-1.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="max-w-[60%] break-words text-right font-medium text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LiabilityCard({
  view,
  tone,
  onEdit,
  onVoid,
  onFilter,
}: {
  view: ReturnType<typeof buildLiabilityView>;
  tone: Tone;
  onEdit: () => void;
  onVoid: () => void;
  onFilter: () => void;
}) {
  const l = view.liability;
  return (
    <div className={cn("rounded-xl border border-border p-4", TONE[tone].bg, l.closed ? "opacity-60" : "")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-semibold", TONE[tone].text)}>{l.name}</p>
          <p className={cn("text-xs opacity-80", TONE[tone].text)}>{l.lender}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Liability actions">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onFilter}>View Ledger</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onVoid}>
              Void
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <dl className={cn("mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs", TONE[tone].text)}>
        <div className="flex justify-between col-span-2">
          <dt>Original Amount</dt>
          <dd className="num font-semibold">{formatMoney(l.originalAmount)}</dd>
        </div>
        <div className="flex justify-between col-span-2">
          <dt>Repaid</dt>
          <dd className="num font-semibold">{formatMoney(view.repaid)}</dd>
        </div>
        <div className="flex justify-between col-span-2 border-t border-border/50 pt-1">
          <dt className="font-medium">Principal Outstanding</dt>
          <dd className="num font-bold">{formatMoney(view.outstanding)}</dd>
        </div>
        <div className="flex justify-between col-span-2">
          <dt>Interest Paid</dt>
          <dd className="num font-semibold">{formatMoney(view.interestPaid)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>EMI</dt>
          <dd className="num">{l.emi ? formatMoney(l.emi) : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Next Due</dt>
          <dd>{l.nextDueDate ? formatDate(l.nextDueDate) : "—"}</dd>
        </div>
      </dl>
      <div className="mt-2">
        <Chip tone={view.status === "Open" ? "green" : "grey"}>{view.status}</Chip>
      </div>
    </div>
  );
}

function LiabilityFormModal({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: Liability | null;
  onClose: () => void;
}) {
  const store = useLepdo();
  const [form, setForm] = useState<LiabForm>(emptyLiabForm());
  const [saving, setSaving] = useState(false);

  useState(() => {
    // noop placeholder to satisfy hook order; actual sync below via key
  });

  if (open && form.id !== (editing?.id ?? null) && !saving) {
    // sync form when target changes (safe: idempotent, guarded)
    const next = editing
      ? {
          id: editing.id,
          kind: editing.kind,
          name: editing.name,
          lender: editing.lender,
          originalAmount: String(editing.originalAmount),
          interestRate: editing.interestRate != null ? String(editing.interestRate) : "",
          emi: editing.emi != null ? String(editing.emi) : "",
          nextDueDate: editing.nextDueDate ?? "",
          notes: editing.notes ?? "",
        }
      : emptyLiabForm();
    if (JSON.stringify(next) !== JSON.stringify(form)) setForm(next);
  }

  const set = <K extends keyof LiabForm>(k: K, v: LiabForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("Enter a name for this liability.");
      return;
    }
    if (!form.lender.trim()) {
      toast.error("Enter the lender.");
      return;
    }
    const amount = Number(form.originalAmount) || 0;
    if (amount <= 0) {
      toast.error("Enter the original amount.");
      return;
    }
    setSaving(true);
    try {
      const rec = store.stamp("liab", {
        id: editing?.id,
        kind: form.kind,
        name: form.name.trim(),
        lender: form.lender.trim(),
        originalAmount: amount,
        interestRate: form.interestRate ? Number(form.interestRate) : undefined,
        emi: form.emi ? Number(form.emi) : undefined,
        nextDueDate: form.nextDueDate || undefined,
        notes: form.notes || undefined,
        closed: editing?.closed,
      });
      store.saveRecord("liabilities", rec);
      toast.success(editing ? "Liability updated." : "Liability added.");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={editing ? "Edit Liability" : "Add Liability"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={submit} className="bg-navy text-navy-foreground hover:bg-navy/90">
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kind">
          <Select value={form.kind} onValueChange={(v) => set("kind", v as LiabilityKind)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIABILITY_KINDS.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <TextField label="Name" value={form.name} onChange={(v) => set("name", v)} />
        <TextField label="Lender" value={form.lender} onChange={(v) => set("lender", v)} />
        <TextField
          label="Original Amount"
          type="number"
          value={form.originalAmount}
          onChange={(v) => set("originalAmount", v)}
        />
        <TextField
          label="Interest Rate %"
          type="number"
          value={form.interestRate}
          onChange={(v) => set("interestRate", v)}
        />
        <TextField label="EMI" type="number" value={form.emi} onChange={(v) => set("emi", v)} />
        <TextField
          label="Next Due Date"
          type="date"
          value={form.nextDueDate}
          onChange={(v) => set("nextDueDate", v)}
        />
        <Field label="Notes" className="sm:col-span-2">
          <Textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="text-sm"
            rows={2}
          />
        </Field>
      </div>
    </ModalShell>
  );
}

function EntryFormModal({
  open,
  liabilities,
  defaultLiabilityId,
  onClose,
}: {
  open: boolean;
  liabilities: Liability[];
  defaultLiabilityId: string;
  onClose: () => void;
}) {
  const store = useLepdo();
  const [form, setForm] = useState<EntryForm>(emptyEntryForm(defaultLiabilityId));
  const [saving, setSaving] = useState(false);

  if (open && form.liabilityId === "" && defaultLiabilityId) {
    setForm(emptyEntryForm(defaultLiabilityId));
  }

  const sources = useMemo(
    () => [
      ...store.bankAccounts.filter((b) => b.active).map((b) => ({ id: b.id, label: `${b.bankName} — ${b.nickname}` })),
      ...store.cashLocations.filter((c) => c.active).map((c) => ({ id: c.id, label: c.name })),
    ],
    [store.bankAccounts, store.cashLocations],
  );

  const set = <K extends keyof EntryForm>(k: K, v: EntryForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.liabilityId) {
      toast.error("Select a liability.");
      return;
    }
    if (!form.particulars.trim()) {
      toast.error("Enter particulars.");
      return;
    }
    const principal = Number(form.principal) || 0;
    const interest = Number(form.interest) || 0;
    if (principal <= 0 && interest <= 0) {
      toast.error("Enter principal or interest amount.");
      return;
    }
    setSaving(true);
    try {
      const rec = store.stamp("liabent", {
        liabilityId: form.liabilityId,
        date: form.date,
        type: form.type,
        particulars: form.particulars.trim(),
        principal,
        interest,
        paidFrom: form.paidFrom || undefined,
        sourceModule: "Manual",
        voided: false,
      });
      store.saveRecord("liabilityEntries", rec);
      toast.success("Entry saved.");
      onClose();
      setForm(emptyEntryForm(form.liabilityId));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Add Liability Entry"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={submit} className="bg-navy text-navy-foreground hover:bg-navy/90">
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Liability">
          <Select value={form.liabilityId} onValueChange={(v) => set("liabilityId", v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select liability" />
            </SelectTrigger>
            <SelectContent>
              {liabilities.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <TextField label="Date" type="date" value={form.date} onChange={(v) => set("date", v)} />
        <Field label="Type">
          <Select value={form.type} onValueChange={(v) => set("type", v as LiabilityEntry["type"])}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIABILITY_ENTRY_TYPES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Paid from (optional)">
          <Select value={form.paidFrom || "none"} onValueChange={(v) => set("paidFrom", v === "none" ? "" : v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <TextField label="Principal" type="number" value={form.principal} onChange={(v) => set("principal", v)} />
        <TextField label="Interest" type="number" value={form.interest} onChange={(v) => set("interest", v)} />
        <Field label="Particulars" className="sm:col-span-2">
          <Input value={form.particulars} onChange={(e) => set("particulars", e.target.value)} className="h-9 text-sm" />
        </Field>
      </div>
    </ModalShell>
  );
}
