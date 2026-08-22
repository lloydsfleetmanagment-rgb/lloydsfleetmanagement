export const SHIFTS = ["DAY", "NIGHT"] as const;
export type Shift = (typeof SHIFTS)[number];

export const EQUIPMENT_STATUSES = ["ACTIVE", "IDLE", "BREAKDOWN", "MAINTENANCE"] as const;

/** Fixed payloads — trips are converted to tonnes with these factors. */
export const TONNES_PER_TRIP: Record<string, number> = {
  DUMPER: 100,
  SANY: 70,
};

export const EMERGENCY_NOTIFY_EMAIL = "sweja06@gmail.com";

export function tonnesFor(equipmentType: string | null | undefined, trips: number) {
  return (TONNES_PER_TRIP[equipmentType ?? ""] ?? 0) * (Number.isFinite(trips) ? trips : 0);
}

export function fmtNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0);
}

export function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function currentShift(): Shift {
  const hour = Number(
    new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }),
  );
  return hour >= 7 && hour < 19 ? "DAY" : "NIGHT";
}

export function statusTone(status: string) {
  switch (status) {
    case "ACTIVE":
    case "RUNNING":
      return "text-primary";
    case "BREAKDOWN":
    case "STOPPED":
      return "text-destructive";
    case "MAINTENANCE":
      return "text-warning";
    default:
      return "text-muted-foreground";
  }
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
