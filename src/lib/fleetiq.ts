export const SHIFTS = ["A", "B", "C"] as const;

/** Loading excavators / shovels available at the Surjagarh lease. */
export const EXCAVATOR_GROUPS = [
  {
    group: "1200 Diesel",
    items: ["1200 DIESEL-1", "1200 DIESEL-2", "1200 DIESEL-3"],
  },
  {
    group: "1200 EV",
    // EV 1200 machines 1–9, machine 8 is not in service
    items: [1, 2, 3, 4, 5, 6, 7, 9].map((n) => `EV 1200-${n}`),
  },
  {
    group: "2500 Class",
    items: ["2500 DIESEL MACHINE-1", "2500 SHOVEL", "EV 2500 MACHINE-1"],
  },
] as const;

export const EXCAVATORS = EXCAVATOR_GROUPS.flatMap((g) => g.items as readonly string[]);
export type Shift = (typeof SHIFTS)[number];

export const EQUIPMENT_STATUSES = ["ACTIVE", "IDLE", "BREAKDOWN", "MAINTENANCE"] as const;

export const CRUSHER_STATUSES = ["RUNNING", "IDLE", "STOPPED", "MAINTENANCE"] as const;

export const DIG_FACE_STATUSES = ["ACTIVE", "IDLE", "CLOSED"] as const;

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Fixed payloads — trips are converted to tonnes with these factors. */
export const TONNES_PER_TRIP: Record<string, number> = {
  DUMPER: 100,
  SANY: 70,
};

export const EMERGENCY_NOTIFY_EMAIL = "sweja06@gmail.com";
export const EMERGENCY_CALL_NUMBER = "+91 93460 54190";

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
  // A: 06:00–14:00 · B: 14:00–22:00 · C: 22:00–06:00
  if (hour >= 6 && hour < 14) return "A";
  if (hour >= 14 && hour < 22) return "B";
  return "C";
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
