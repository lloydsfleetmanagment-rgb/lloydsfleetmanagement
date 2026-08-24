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
    let boundaryTimer = 0;

    const tick = () => {
      const date = todayISO();
      const shift = currentShift();
      setState((prev) => {
        if (prev.date === date && prev.shift === shift) return prev;
        void qc.invalidateQueries();
        return { date, shift };
      });
    };

    /** Milliseconds until the next shift boundary (06:00 / 14:00 / 22:00 IST). */
    const msToNextShiftEnd = () => {
      const now = new Date();
      const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const mins = ist.getHours() * 60 + ist.getMinutes();
      const boundaries = [6 * 60, 14 * 60, 22 * 60, 30 * 60];
      const next = boundaries.find((b) => b > mins)!;
      const msIntoMinute = ist.getSeconds() * 1000 + ist.getMilliseconds();
      return (next - mins) * 60_000 - msIntoMinute + 1_000;
    };

    const scheduleBoundary = () => {
      boundaryTimer = window.setTimeout(() => {
        // Shift just ended — force every live query to refetch for the new window.
        void qc.invalidateQueries();
        tick();
        scheduleBoundary();
      }, msToNextShiftEnd());
    };

    scheduleBoundary();
    const id = window.setInterval(tick, 30_000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(boundaryTimer);
      window.removeEventListener("focus", onFocus);
    };
  }, [qc]);

  return state;
}
