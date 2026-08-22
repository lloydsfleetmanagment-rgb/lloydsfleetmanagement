import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { currentShift, todayISO, type Shift } from "./fleetiq";

/**
 * Keeps the dashboard aligned with the live mine day.
 * - ticks every 30s so the current date / shift stay accurate
 * - when the shift rolls over (A→B→C every 8h) or a new day starts at 06:00,
 *   all live queries are invalidated so the view resets to the new window.
 * Historical rows are never deleted — only the view window changes.
 */
export function useShiftClock() {
  const qc = useQueryClient();
  const [state, setState] = useState<{ date: string; shift: Shift }>(() => ({
    date: todayISO(),
    shift: currentShift(),
  }));

  useEffect(() => {
    const tick = () => {
      const date = todayISO();
      const shift = currentShift();
      setState((prev) => {
        if (prev.date === date && prev.shift === shift) return prev;
        void qc.invalidateQueries();
        return { date, shift };
      });
    };
    const id = window.setInterval(tick, 30_000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [qc]);

  return state;
}
