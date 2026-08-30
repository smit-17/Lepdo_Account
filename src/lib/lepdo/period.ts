export type Preset = "today" | "week" | "month" | "fy" | "all" | "custom";

export const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "fy", label: "This Financial Year" },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom Date" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function rangeFor(
  preset: Preset,
  today: string,
  customFrom: string,
  customTo: string,
): readonly [string, string] {
  const d = new Date(today);
  if (preset === "today") return [today, today];
  if (preset === "week") {
    const day = (d.getUTCDay() + 6) % 7;
    const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
    const to = new Date(from);
    to.setUTCDate(from.getUTCDate() + 6);
    return [iso(from), iso(to)];
  }
  if (preset === "fy") {
    const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
    return [`${y}-04-01`, `${y + 1}-03-31`];
  }
  if (preset === "all") return ["0000-01-01", "9999-12-31"];
  if (preset === "custom") return [customFrom, customTo];
  const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return [iso(from), iso(to)];
}

export function periodLabel(preset: Preset): string {
  return PRESETS.find((p) => p.id === preset)?.label ?? "This Month";
}
