import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, Plus, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeading } from "@/components/lepdo/bits";
import {
  Chip,
  DownloadMenu,
  EmptyState,
  Field,
  ModalShell,
  SectionCard,
  StatCard,
  TextField,
} from "@/components/lepdo/shared";
import { formatDateTime, formatMoney } from "@/lib/lepdo/format";
import { useLepdo } from "@/lib/lepdo/store";
import { DEFAULT_SETTINGS } from "@/lib/lepdo/extras";
import { EXPENSE_CATEGORIES } from "@/lib/lepdo/expense";
import type { AppSettings } from "@/lib/lepdo/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — LEPDO Accounting" },
      {
        name: "description",
        content:
          "Business profile, branding, invoice numbering, master data, accounting rules and security settings for LEPDO Accounting.",
      },
      { property: "og:title", content: "Settings — LEPDO Accounting" },
      {
        property: "og:description",
        content: "Configure business profile, branding, invoices, masters and accounting rules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Settings,
});

type TabId = "business" | "branding" | "invoice" | "masters" | "rules" | "security";

const TABS: { id: TabId; label: string }[] = [
  { id: "business", label: "Business Profile" },
  { id: "branding", label: "Branding" },
  { id: "invoice", label: "Invoice Settings" },
  { id: "masters", label: "Master Data" },
  { id: "rules", label: "Accounting Rules" },
  { id: "security", label: "Users & Security" },
];

function Settings() {
  const store = useLepdo();
  const [tab, setTab] = useState<TabId>("business");
  const [draft, setDraft] = useState<AppSettings>(store.settings);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState(false);

  const patch = <K extends keyof AppSettings>(key: K, value: Partial<AppSettings[K]>) => {
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...value } }));
    setDirty(true);
  };

  const save = () => {
    if (saving) return;
    setSaving(true);
    try {
      store.saveSettings(draft);
      setDirty(false);
      toast.success("Settings saved. Historical records are unchanged.");
    } catch {
      toast.error("Could not save settings.");
    } finally {
      setConfirmOpen(false);
      setTimeout(() => setSaving(false), 300);
    }
  };

  const reset = () => {
    setDraft(store.settings);
    setDirty(false);
    toast.message("Unsaved changes discarded.");
  };

  if (!store.ready) {
    return <p className="p-2 text-sm text-muted-foreground">Loading settings…</p>;
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Settings" breadcrumb="LEPDO Accounting / Settings">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
            <Eye className="size-4" /> Preview
          </Button>
          <Button variant="outline" size="sm" onClick={reset} disabled={!dirty}>
            <RotateCcw className="size-4" /> Reset
          </Button>
          <Button size="sm" disabled={!dirty || saving} onClick={() => setConfirmOpen(true)}>
            <Save className="size-4" /> {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </PageHeading>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs sm:text-sm">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === "business" ? (
        <SectionCard title="Business details">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <TextField
              label="Business name"
              value={draft.business.name}
              onChange={(v) => patch("business", { name: v })}
            />
            <TextField
              label="Legal / registered name"
              value={draft.business.legalName}
              onChange={(v) => patch("business", { legalName: v })}
            />
            <TextField
              label="GSTIN"
              value={draft.business.gstin}
              onChange={(v) => patch("business", { gstin: v })}
            />
            <TextField
              label="Phone"
              value={draft.business.phone}
              onChange={(v) => patch("business", { phone: v })}
            />
            <TextField
              label="Email"
              value={draft.business.email}
              onChange={(v) => patch("business", { email: v })}
            />
            <TextField
              label="City"
              value={draft.business.city}
              onChange={(v) => patch("business", { city: v })}
            />
            <TextField
              label="State"
              value={draft.business.state}
              onChange={(v) => patch("business", { state: v })}
            />
            <TextField
              label="Financial year start (MM-DD)"
              value={draft.business.financialYearStart}
              onChange={(v) => patch("business", { financialYearStart: v })}
            />
            <TextField
              label="Default currency"
              value={draft.business.currency}
              onChange={(v) => patch("business", { currency: v })}
            />
            <Field label="Address" className="sm:col-span-2 lg:col-span-3">
              <Textarea
                rows={2}
                value={draft.business.address}
                onChange={(e) => patch("business", { address: e.target.value })}
                className="text-sm"
              />
            </Field>
          </div>
        </SectionCard>
      ) : null}

      {tab === "branding" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <SectionCard title="Branding">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField
                label="Primary colour"
                value={draft.branding.primary}
                onChange={(v) => patch("branding", { primary: v })}
              />
              <TextField
                label="Accent / pastel colour"
                value={draft.branding.accent}
                onChange={(v) => patch("branding", { accent: v })}
              />
              <TextField
                label="Font"
                value={draft.branding.font}
                onChange={(v) => patch("branding", { font: v })}
              />
              <TextField
                label="Invoice header"
                value={draft.branding.invoiceHeader}
                onChange={(v) => patch("branding", { invoiceHeader: v })}
              />
              <Field label="Invoice footer" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={draft.branding.invoiceFooter}
                  onChange={(e) => patch("branding", { invoiceFooter: e.target.value })}
                  className="text-sm"
                />
              </Field>
            </div>
          </SectionCard>
          <SectionCard title="Live preview">
            <InvoicePreview settings={draft} />
          </SectionCard>
        </div>
      ) : null}

      {tab === "invoice" ? (
        <SectionCard title="Invoice settings">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <TextField
              label="Sales prefix"
              value={draft.invoice.salesPrefix}
              onChange={(v) => patch("invoice", { salesPrefix: v })}
            />
            <TextField
              label="Sales starting number"
              type="number"
              value={draft.invoice.salesStart}
              onChange={(v) => patch("invoice", { salesStart: Number(v) || 1 })}
            />
            <TextField
              label="Purchase prefix"
              value={draft.invoice.purchasePrefix}
              onChange={(v) => patch("invoice", { purchasePrefix: v })}
            />
            <TextField
              label="Purchase starting number"
              type="number"
              value={draft.invoice.purchaseStart}
              onChange={(v) => patch("invoice", { purchaseStart: Number(v) || 1 })}
            />
            <TextField
              label="Diamond format"
              value={draft.invoice.diamondFormat}
              onChange={(v) => patch("invoice", { diamondFormat: v })}
            />
            <TextField
              label="Jewelry format"
              value={draft.invoice.jewelryFormat}
              onChange={(v) => patch("invoice", { jewelryFormat: v })}
            />
            <TextField
              label="Default due days"
              type="number"
              value={draft.invoice.defaultDueDays}
              onChange={(v) => patch("invoice", { defaultDueDays: Number(v) || 0 })}
            />
            <TextField
              label="Default tax rate %"
              type="number"
              value={draft.invoice.defaultTaxRate}
              onChange={(v) => patch("invoice", { defaultTaxRate: Number(v) || 0 })}
            />
            <TextField
              label="Default discount"
              type="number"
              value={draft.invoice.defaultDiscount}
              onChange={(v) => patch("invoice", { defaultDiscount: Number(v) || 0 })}
            />
            <TextField
              label="Default shipping"
              type="number"
              value={draft.invoice.shipping}
              onChange={(v) => patch("invoice", { shipping: Number(v) || 0 })}
            />
            <Field label="Round off totals">
              <div className="flex h-9 items-center">
                <Switch
                  checked={draft.invoice.roundOff}
                  onCheckedChange={(v) => patch("invoice", { roundOff: v })}
                />
              </div>
            </Field>
            <TextField
              label="Signature label"
              value={draft.invoice.signature}
              onChange={(v) => patch("invoice", { signature: v })}
            />
            <Field label="Terms & conditions" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={draft.invoice.terms}
                onChange={(e) => patch("invoice", { terms: e.target.value })}
                className="text-sm"
              />
            </Field>
            <Field label="Bank details">
              <Textarea
                rows={3}
                value={draft.invoice.bankDetails}
                onChange={(e) => patch("invoice", { bankDetails: e.target.value })}
                className="text-sm"
              />
            </Field>
          </div>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
              <Eye className="size-4" /> PDF / print preview
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {tab === "masters" ? <MasterData /> : null}

      {tab === "rules" ? (
        <SectionCard title="Accounting rules">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ToggleRow
              label="Duplicate protection"
              hint="Warn before saving an identical date, amount, account and reference."
              checked={draft.rules.duplicateProtection}
              onChange={(v) => patch("rules", { duplicateProtection: v })}
            />
            <ToggleRow
              label="Auto-allocate to oldest invoice"
              hint="Unallocated payments settle the oldest open invoice first."
              checked={draft.rules.autoAllocateOldest}
              onChange={(v) => patch("rules", { autoAllocateOldest: v })}
            />
            <ToggleRow
              label="Allow edit after payment"
              hint="When off, paid invoices can only be adjusted with a new entry."
              checked={draft.rules.allowEditAfterPayment}
              onChange={(v) => patch("rules", { allowEditAfterPayment: v })}
            />
            <ToggleRow
              label="Void instead of delete"
              hint="Records are never removed; voided entries stay in the audit trail."
              checked={draft.rules.voidInsteadOfDelete}
              onChange={(v) => patch("rules", { voidInsteadOfDelete: v })}
            />
            <TextField
              label="Monthly lock date"
              type="date"
              value={draft.rules.monthlyLockDate}
              onChange={(v) => patch("rules", { monthlyLockDate: v })}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Payment statuses stay automatic: Paid, Part Paid, Pending and Overdue are derived from
            invoice totals, allocations and due dates. Settings never alter or delete historical
            records.
          </p>
        </SectionCard>
      ) : null}

      {tab === "security" ? <Security draft={draft} patch={patch} /> : null}

      <ModalShell
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Save settings?"
        subtitle="Existing invoices, payments and ledgers are not changed."
        width="max-w-[460px]"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Confirm & save"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          New numbering, tax and rule defaults apply to entries created from now on. Historical
          records keep their original values.
        </p>
      </ModalShell>

      <ModalShell
        open={preview}
        onClose={() => setPreview(false)}
        title="Invoice preview"
        subtitle="Header, footer, terms and bank details as they will print"
        width="max-w-[720px]"
        footer={
          <Button variant="outline" size="sm" onClick={() => setPreview(false)}>
            Close
          </Button>
        }
      >
        <InvoicePreview settings={draft} full />
      </ModalShell>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function InvoicePreview({ settings, full }: { settings: AppSettings; full?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm">
      <div
        className="rounded-md px-3 py-2 text-sm font-semibold"
        style={{ background: settings.branding.accent, color: settings.branding.primary }}
      >
        {settings.branding.invoiceHeader || settings.business.name}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {settings.business.legalName}
        {settings.business.gstin ? ` · GSTIN ${settings.business.gstin}` : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        {[settings.business.address, settings.business.city, settings.business.state]
          .filter(Boolean)
          .join(", ")}
      </p>
      <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs">
        <p>
          Invoice no. {settings.invoice.salesPrefix}
          {String(settings.invoice.salesStart).padStart(3, "0")}
        </p>
        <p>Due in {settings.invoice.defaultDueDays} days</p>
        <p>
          Tax {settings.invoice.defaultTaxRate}% · Currency {settings.business.currency}
        </p>
      </div>
      {full ? (
        <>
          <p className="mt-3 text-xs font-semibold text-navy">Terms</p>
          <p className="whitespace-pre-line text-xs text-muted-foreground">
            {settings.invoice.terms || "—"}
          </p>
          <p className="mt-2 text-xs font-semibold text-navy">Bank details</p>
          <p className="whitespace-pre-line text-xs text-muted-foreground">
            {settings.invoice.bankDetails || "—"}
          </p>
        </>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">{settings.branding.invoiceFooter}</p>
      <p className="mt-2 text-right text-xs font-semibold text-navy">
        {settings.invoice.signature}
      </p>
    </div>
  );
}

function MasterData() {
  const store = useLepdo();
  const [bank, setBank] = useState({ bankName: "", nickname: "", last4: "", openingBalance: "" });
  const [cash, setCash] = useState({ name: "", openingBalance: "" });
  const [party, setParty] = useState("");

  const platforms = useMemo(
    () =>
      Array.from(
        new Set(store.salesInvoices.map((i) => i.platform).filter((p): p is string => !!p)),
      ),
    [store.salesInvoices],
  );

  return (
    <div className="space-y-4">
      <SectionCard title="Bank accounts">
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>Bank</TableHead>
                <TableHead>Nickname</TableHead>
                <TableHead>Last 4</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.bankAccounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.bankName}</TableCell>
                  <TableCell>{a.nickname}</TableCell>
                  <TableCell>••••{a.last4}</TableCell>
                  <TableCell className="num text-right">{formatMoney(a.openingBalance)}</TableCell>
                  <TableCell className="num text-right font-semibold">
                    {formatMoney(store.balanceOf("bank", a.id))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => store.saveBankAccount({ ...a, active: !a.active })}
                    >
                      {a.active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <TextField
            label="Bank name"
            value={bank.bankName}
            onChange={(v) => setBank({ ...bank, bankName: v })}
          />
          <TextField
            label="Nickname"
            value={bank.nickname}
            onChange={(v) => setBank({ ...bank, nickname: v })}
          />
          <TextField
            label="Last 4"
            value={bank.last4}
            onChange={(v) => setBank({ ...bank, last4: v })}
          />
          <TextField
            label="Opening balance"
            value={bank.openingBalance}
            onChange={(v) => setBank({ ...bank, openingBalance: v })}
          />
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={!bank.bankName.trim()}
              onClick={() => {
                store.saveBankAccount({
                  bankName: bank.bankName.trim(),
                  nickname: bank.nickname.trim() || bank.bankName.trim(),
                  last4: bank.last4.trim() || "0000",
                  openingBalance: Number(bank.openingBalance) || 0,
                  active: true,
                });
                setBank({ bankName: "", nickname: "", last4: "", openingBalance: "" });
                toast.success("Bank account added.");
              }}
            >
              <Plus className="size-4" /> Add account
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Cash books">
        <div className="overflow-x-auto">
          <Table className="min-w-[480px]">
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.cashLocations.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="num text-right">{formatMoney(l.openingBalance)}</TableCell>
                  <TableCell className="num text-right font-semibold">
                    {formatMoney(store.balanceOf("cash", l.id))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => store.saveCashLocation({ ...l, active: !l.active })}
                    >
                      {l.active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField
            label="Location name"
            value={cash.name}
            onChange={(v) => setCash({ ...cash, name: v })}
          />
          <TextField
            label="Opening balance"
            value={cash.openingBalance}
            onChange={(v) => setCash({ ...cash, openingBalance: v })}
          />
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={!cash.name.trim()}
              onClick={() => {
                store.saveCashLocation({
                  name: cash.name.trim(),
                  openingBalance: Number(cash.openingBalance) || 0,
                  active: true,
                });
                setCash({ name: "", openingBalance: "" });
                toast.success("Cash book added.");
              }}
            >
              <Plus className="size-4" /> Add cash book
            </Button>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Customers & suppliers">
          <div className="flex flex-wrap gap-2">
            {store.parties.map((p) => (
              <span
                key={p.id}
                className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground"
              >
                {p.name} <span className="text-muted-foreground">· {p.type}</span>
              </span>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <TextField label="New party name" value={party} onChange={setParty} />
            <div className="flex items-end">
              <Button
                disabled={!party.trim()}
                onClick={() => {
                  store.addParty(party.trim(), "other");
                  setParty("");
                  toast.success("Party added.");
                }}
              >
                <Plus className="size-4" /> Add
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Sellers & brokers">
          <p className="text-xs text-muted-foreground">
            Managed from the Sales and Purchase forms — shown here for reference.
          </p>
          <div className="mt-2 space-y-2">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Sellers</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {store.sellers.length ? (
                  store.sellers.map((s) => (
                    <Chip key={s.id} tone="blue">
                      {s.name}
                      {s.rate
                        ? ` · ${s.rateType === "percent" ? `${s.rate}%` : formatMoney(s.rate)}`
                        : ""}
                    </Chip>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">None yet</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Brokers</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {store.brokers.length ? (
                  store.brokers.map((s) => (
                    <Chip key={s.id} tone="orange">
                      {s.name}
                      {s.rate
                        ? ` · ${s.rateType === "percent" ? `${s.rate}%` : formatMoney(s.rate)}`
                        : ""}
                    </Chip>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">None yet</span>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Platforms">
          {platforms.length ? (
            <div className="flex flex-wrap gap-2">
              {platforms.map((p) => (
                <Chip key={p} tone="purple">
                  {p}
                </Chip>
              ))}
            </div>
          ) : (
            <EmptyState title="No platforms used yet" hint="Platforms come from sales invoices." />
          )}
        </SectionCard>

        <SectionCard title="Expense categories">
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((c) => (
              <Chip key={c.label} tone="yellow">
                {c.label}
              </Chip>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Security({
  draft,
  patch,
}: {
  draft: AppSettings;
  patch: <K extends keyof AppSettings>(key: K, value: Partial<AppSettings[K]>) => void;
}) {
  const store = useLepdo();
  const [restoreOpen, setRestoreOpen] = useState(false);

  const backup = () => {
    const blob = new Blob([JSON.stringify(store, replacer, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lepdo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Backup downloaded.");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Signed-in role" value={draft.security.role} tone="blue" />
        <StatCard label="Audit entries" value={String(store.auditLogs.length)} tone="purple" />
        <StatCard label="Transactions" value={String(store.transactions.length)} tone="green" />
        <StatCard
          label="Monthly lock"
          value={draft.rules.monthlyLockDate || "Not set"}
          tone="orange"
        />
      </div>

      <SectionCard title="Roles & permissions">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Role">
            <select
              value={draft.security.role}
              onChange={(e) => patch("security", { role: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {["Owner", "Accountant", "Staff", "Viewer"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Two-person approval for void">
            <div className="flex h-9 items-center">
              <Switch
                checked={draft.security.twoPersonVoid}
                onCheckedChange={(v) => patch("security", { twoPersonVoid: v })}
              />
            </div>
          </Field>
          <Field label="Password">
            <Input type="password" placeholder="••••••••" className="h-9 text-sm" />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={backup}>
            Download backup
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRestoreOpen(true)}>
            Restore / reset
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Audit log"
        actions={
          <DownloadMenu
            label="Download"
            build={() => ({
              title: "Audit Log",
              subtitle: "All create, edit, void and restore activity",
              columns: [
                { key: "at", label: "When" },
                { key: "action", label: "Action" },
                { key: "entity", label: "Entity" },
                { key: "detail", label: "Detail" },
                { key: "by", label: "By" },
              ],
              rows: store.auditLogs.map((l) => ({
                at: formatDateTime(l.at),
                action: l.action,
                entity: l.entity,
                detail: l.detail,
                by: l.by,
              })),
            })}
          />
        }
      >
        {store.auditLogs.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {store.auditLogs.slice(0, 50).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateTime(log.at)}
                    </TableCell>
                    <TableCell className="text-xs font-medium">{log.action}</TableCell>
                    <TableCell className="text-xs">{log.entity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.detail}</TableCell>
                    <TableCell className="text-xs">{log.by}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <ModalShell
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        title="Restore or reset data"
        width="max-w-[460px]"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setRestoreOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                store.resetDemoData();
                setRestoreOpen(false);
                toast.success("Data reset to the starting dataset.");
              }}
            >
              Reset data
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Download a backup first. Resetting replaces the working dataset with the starting data and
          cannot be undone.
        </p>
      </ModalShell>
    </div>
  );
}

function replacer(_key: string, value: unknown) {
  return typeof value === "function" ? undefined : value;
}

export const SETTINGS_DEFAULTS = DEFAULT_SETTINGS;
