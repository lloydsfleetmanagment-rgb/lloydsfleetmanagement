import * as XLSX from "xlsx";
import { fmtTime } from "./fleetiq";

export type ExportRow = Record<string, string | number>;

export type TripLogLike = {
  log_date: string;
  logged_at: string;
  shift: string;
  employee_id?: string | null;
  employee_name?: string | null;
  equipment_code: string;
  equipment_type: string;
  excavator?: string | null;
  dig_face?: string | null;
  material_code: string;
  destination_code: string;
  trips: number;
  quantity_t: number | string;
  loading_time_min?: number | null;
  unloading_time_min?: number | null;
  remarks?: string | null;
};

/**
 * Turns operator trip logs into flat, time-ordered export rows with a running
 * trip number so each sheet reads as a chronological trip register.
 */
export function buildTripRows(
  logs: TripLogLike[],
  locationName: (code: string) => string = (c) => c,
): ExportRow[] {
  return [...logs]
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
    .map((l, i) => ({
      "S.No": i + 1,
      Date: l.log_date,
      Time: fmtTime(l.logged_at),
      Shift: l.shift,
      "Employee ID": l.employee_id ?? "",
      "Employee Name": l.employee_name ?? "",
      Equipment: l.equipment_code,
      "Equipment Type": l.equipment_type,
      Excavator: l.excavator ?? "",
      "Dig Face": l.dig_face ?? "",
      Material: l.material_code,
      Destination: l.destination_code,
      Location: locationName(l.destination_code),
      Trips: l.trips,
      "Tonnes (t)": Number(l.quantity_t),
      "Loading (min)": Number(l.loading_time_min ?? 0),
      "Unloading (min)": Number(l.unloading_time_min ?? 0),
      Remarks: l.remarks ?? "",
    }));
}


/**
 * Exports rows to an .xlsx workbook with one sheet per material plus an
 * "All Materials" summary sheet. No autofilter is applied so the sheets open
 * clean, ready to read.
 */
export function downloadMaterialWorkbook(
  fileName: string,
  rows: ExportRow[],
  materialKey = "Material",
) {
  const wb = XLSX.utils.book_new();

  const withTotals = (data: ExportRow[]): ExportRow[] => {
    if (!data.length || !("Trips" in data[0]!)) return data;
    const total: ExportRow = { "S.No": "", Date: "", Time: "", Shift: "TOTAL" };
    Object.keys(data[0]!).forEach((h) => {
      if (h === "Trips" || h === "Tonnes (t)" || h === "Quantity (t)") {
        total[h] = data.reduce((s, r) => s + Number(r[h] ?? 0), 0);
      } else if (!(h in total)) total[h] = "";
    });
    return [...data, total];
  };

  const addSheet = (name: string, rowsIn: ExportRow[]) => {
    const data = withTotals(rowsIn);
    const ws = XLSX.utils.json_to_sheet(data);
    const headers = Object.keys(data[0] ?? { Info: "" });
    ws["!cols"] = headers.map((h) => ({
      wch: Math.max(
        h.length + 2,
        ...data.map((r) => String(r[h] ?? "").length + 2),
      ),
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

  XLSX.writeFile(wb, fileName, { compression: true });
}
