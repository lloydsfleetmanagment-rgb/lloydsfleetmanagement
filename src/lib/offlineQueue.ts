import { supabase } from "@/integrations/supabase/client";

/**
 * Offline-first trip logging.
 * When the pit has no network, operator entries are stored in localStorage and
 * pushed to the backend automatically as soon as connectivity returns, so they
 * flow into dashboard / fleet / production / reports like any online entry.
 */

const KEY = "fleetiq:offline-queue";

export type QueuedLog = {
  qid: string;
  queued_at: string;
  row: Record<string, unknown>;
};

const isBrowser = () => typeof window !== "undefined";

export function readQueue(): QueuedLog[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedLog[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedLog[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("fleetiq:queue-changed"));
}

export function enqueueLog(row: Record<string, unknown>) {
  const items = readQueue();
  items.push({
    qid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queued_at: new Date().toISOString(),
    row,
  });
  writeQueue(items);
  return items.length;
}

export function queueCount() {
  return readQueue().length;
}

let flushing = false;

/** Pushes every queued entry. Returns how many synced. Keeps rows that still fail. */
export async function flushQueue(): Promise<number> {
  if (!isBrowser() || flushing) return 0;
  if (!navigator.onLine) return 0;
  const items = readQueue();
  if (items.length === 0) return 0;

  flushing = true;
  const remaining: QueuedLog[] = [];
  let synced = 0;
  try {
    for (const item of items) {
      const { error } = await supabase.from("operator_logs").insert(item.row as never);
      if (error) {
        // Validation errors (bad destination/equipment) would never succeed — drop them.
        const permanent = /INVALID|violates|Unknown/i.test(error.message);
        if (!permanent) remaining.push(item);
      } else {
        synced += 1;
      }
    }
  } finally {
    flushing = false;
    writeQueue(remaining);
  }
  return synced;
}
