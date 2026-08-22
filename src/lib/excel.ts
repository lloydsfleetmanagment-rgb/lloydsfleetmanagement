import * as XLSX from "xlsx";

export type ExportRow = Record<string, string | number>;

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

  const addSheet = (name: string, data: ExportRow[]) => {
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
