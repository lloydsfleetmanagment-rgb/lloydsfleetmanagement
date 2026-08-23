import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { ExportRow } from "./excel";
import { SHIFTS, type Shift } from "./fleetiq";

/* ------------------------------------------------------------------ */
/* Folder handle persistence (File System Access API + IndexedDB)      */
/* ------------------------------------------------------------------ */

type DirHandle = FileSystemDirectoryHandle;

const DB_NAME = "fleetiq-export";
const STORE = "handles";
const KEY = "shift-folder";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(value: DirHandle | null) {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    if (value) tx.objectStore(STORE).put(value, KEY);
    else tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(): Promise<DirHandle | null> {
  try {
    const db = await idb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as DirHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export function folderPickingSupported() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/** Ask the user once for a folder on their PC; the choice is remembered. */
export async function pickExportFolder(): Promise<DirHandle | null> {
  if (!folderPickingSupported()) return null;
  const picker = (window as unknown as {
    showDirectoryPicker: (o?: { mode?: string }) => Promise<DirHandle>;
  }).showDirectoryPicker;
  const handle = await picker({ mode: "readwrite" });
  await idbSet(handle);
  return handle;
}

export async function clearExportFolder() {
  await idbSet(null);
}

export async function getExportFolder(requestPermission = false): Promise<DirHandle | null> {
  const handle = await idbGet();
  if (!handle) return null;
  const h = handle as DirHandle & {
    queryPermission?: (d: { mode: string }) => Promise<PermissionState>;
    requestPermission?: (d: { mode: string }) => Promise<PermissionState>;
  };
  const state = (await h.queryPermission?.({ mode: "readwrite" })) ?? "granted";
  if (state === "granted") return handle;
  if (requestPermission) {
    const asked = await h.requestPermission?.({ mode: "readwrite" });
    if (asked === "granted") return handle;
  }
  return null;
}

export async function exportFolderName() {
  const h = await idbGet();
  return h?.name ?? null;
}

/* ------------------------------------------------------------------ */
/* Workbook building + saving                                          */
/* ------------------------------------------------------------------ */

function buildWorkbook(rows: ExportRow[], materialKey = "Material") {
  const wb = XLSX.utils.book_new();
  const addSheet = (name: string, data: ExportRow[]) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const headers = Object.keys(data[0] ?? { Info: "" });
    ws["!cols"] = headers.map((h) => ({
      wch: Math.max(h.length + 2, ...data.map((r) => String(r[h] ?? "").length + 2)),
    }));
    delete (ws as { "!autofilter"?: unknown })["!autofilter"];
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };

  addSheet("All Materials", rows.length ? rows : [{ Info: "No entries" }]);

  const groups = new Map<string, ExportRow[]>();
  rows.forEach((r) => {
    const key = String(r[materialKey] ?? "UNKNOWN");
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  });
  Array.from(groups.keys())
    .sort()
    .forEach((mat) => addSheet(mat, groups.get(mat)!));

  return wb;
}

/**
 * Writes the workbook into the chosen PC folder when one is configured,
 * otherwise falls back to a normal browser download.
 */
export async function saveWorkbook(fileName: string, rows: ExportRow[]): Promise<"folder" | "download"> {
  const wb = buildWorkbook(rows);
  const folder = await getExportFolder();
  if (folder) {
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true }) as ArrayBuffer;
    const fileHandle = await folder.getFileHandle(fileName, { create: true });
    const writable = await (fileHandle as FileSystemFileHandle & {
      createWritable: () => Promise<FileSystemWritableFileStream>;
    }).createWritable();
    await writable.write(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    await writable.close();
    return "folder";
  }
  XLSX.writeFile(wb, fileName, { compression: true });
  return "download";
}

/* ------------------------------------------------------------------ */
/* Shift data                                                          */
/* ------------------------------------------------------------------ */

export type ShiftWindow = { date: string; shift: Shift };

/** The shift that just ended, given the shift that is now starting. */
export function previousShiftWindow(date: string, shift: Shift): ShiftWindow {
  const idx = SHIFTS.indexOf(shift);
  if (idx > 0) return { date, shift: SHIFTS[idx - 1]! };
  // Shift A starts the mine day at 06:00 — the previous shift is C of yesterday.
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return { date: d.toLocaleDateString("en-CA"), shift: "C" };
}

export async function fetchShiftRows({ date, shift }: ShiftWindow): Promise<ExportRow[]> {
  const { data, error } = await supabase
    .from("operator_logs")
    .select("*")
    .eq("log_date", date)
    .eq("shift", shift)
    .order("logged_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((l) => ({
    Date: l.log_date,
    Shift: l.shift,
    Time: new Date(l.logged_at).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata" }),
    "Employee ID": l.employee_id ?? "",
    "Employee Name": l.employee_name ?? "",
    Equipment: l.equipment_code,
    "Equipment Type": l.equipment_type,
    Excavator: l.excavator ?? "",
    "Dig Face": l.dig_face ?? "",
    Material: l.material_code,
    Destination: l.destination_code,
    Trips: l.trips,
    "Quantity (t)": Number(l.quantity_t),
    "Loading (min)": Number(l.loading_time_min),
    "Unloading (min)": Number(l.unloading_time_min),
    Remarks: l.remarks ?? "",
  }));
}

export function shiftFileName({ date, shift }: ShiftWindow) {
  return `FLEETIQ-shift-${shift}-${date}.xlsx`;
}

/** Exports one shift; returns where the file landed. */
export async function exportShift(win: ShiftWindow) {
  const rows = await fetchShiftRows(win);
  const target = await saveWorkbook(shiftFileName(win), rows);
  return { rows: rows.length, target };
}
