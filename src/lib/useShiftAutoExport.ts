import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { exportShift, getExportFolder, previousShiftWindow, type ShiftWindow } from "./shiftExport";
import type { Shift } from "./fleetiq";

const KEY = "fleetiq:lastShiftExport";

function stamp(w: ShiftWindow) {
  return `${w.date}-${w.shift}`;
}

/**
 * When the shift rolls over (06:00 / 14:00 / 22:00 IST), the shift that just
 * ended is written as an Excel workbook into the folder the user picked on
 * their PC. History in the database is never touched.
 */
export function useShiftAutoExport(date: string, shift: Shift) {
  const busy = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || busy.current) return;
    const prev = previousShiftWindow(date, shift);
    const key = stamp(prev);
    if (localStorage.getItem(KEY) === key) return;

    busy.current = true;
    void (async () => {
      try {
        const folder = await getExportFolder();
        if (!folder) return; // no folder configured yet — nothing to auto-save
        const { rows, target } = await exportShift(prev);
        localStorage.setItem(KEY, key);
        if (target === "folder") {
          toast.success(`Shift ${prev.shift} (${prev.date}) saved`, {
            description: `${rows} entries exported to your selected folder.`,
          });
        }
      } catch (e) {
        console.error("[shift auto-export]", e);
      } finally {
        busy.current = false;
      }
    })();
  }, [date, shift]);
}
