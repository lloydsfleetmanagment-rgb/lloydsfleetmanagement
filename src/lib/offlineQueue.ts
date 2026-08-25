import { supabase } from "@/integrations/supabase/client";

/**
 * Offline-first trip logging.
 * Entries are stored in IndexedDB when the pit has no network and pushed to the
 * backend automatically as soon as connectivity returns, so they flow into
 * dashboard / fleet / production / reports like any online entry.
 *
 * Duplicate protection: every entry carries a `client_id`, which is unique in
 * the database. Re-sending the same queued entry can never create a second row.
 */

const DB_NAME = "fleetiq";
const DB_VERSION = 1;
const STORE = "operator_log_queue";
const LEGACY_KEY = "fleetiq:offline-queue";

export type QueuedLog = {
  qid: string;
  queued_at: string;
  row: Record<string, unknown>;
};

const isBrowser = () => typeof window !== "undefined" && typeof indexedDB !== "undefined";

export function newClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "qid" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

function emitChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fleetiq:queue-changed"));
}

/** Moves any entries left behind by the previous localStorage queue into IndexedDB. */
async function migrateLegacy() {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(LEGACY_KEY);
  if (!raw) return;
  window.localStorage.removeItem(LEGACY_KEY);
  try {
    const items = JSON.parse(raw) as QueuedLog[];
    for (const item of items) {
      const row = { ...(item.row as Record<string, unknown>) };
      if (!row["client_id"]) row["client_id"] = item.qid;
      await tx("readwrite", (s) => s.put({ ...item, row }));
    }
  } catch {
    /* ignore malformed legacy payloads */
  }
}

export async function readQueue(): Promise<QueuedLog[]> {
  if (!isBrowser()) return [];
  try {
    await migrateLegacy();
    const items = (await tx<QueuedLog[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedLog[]>)) ?? [];
    return items.sort((a, b) => a.queued_at.localeCompare(b.queued_at));
  } catch {
    return [];
  }
}

/** Saves one entry offline. Returns how many entries are now waiting. */
export async function enqueueLog(row: Record<string, unknown>): Promise<number> {
  if (!isBrowser()) return 0;
  const clientId = (row["client_id"] as string) || newClientId();
  const item: QueuedLog = {
    qid: clientId,
    queued_at: new Date().toISOString(),
    row: { ...row, client_id: clientId },
  };
  await tx("readwrite", (s) => s.put(item));
  emitChange();
  return queueCount();
}

export async function queueCount(): Promise<number> {
  if (!isBrowser()) return 0;
  try {
    await migrateLegacy();
    return await tx<number>("readonly", (s) => s.count());
  } catch {
    return 0;
  }
}

let flushing = false;

/** Pushes every queued entry. Returns how many synced. Keeps rows that still fail. */
export async function flushQueue(): Promise<number> {
  if (!isBrowser() || flushing) return 0;
  if (!navigator.onLine) return 0;
  const items = await readQueue();
  if (items.length === 0) return 0;

  flushing = true;
  let synced = 0;
  try {
    for (const item of items) {
      const { error } = await supabase.from("operator_logs").insert(item.row as never);
      const duplicate = error ? /duplicate key|already exists|operator_logs_client_id/i.test(error.message) : false;
      // Validation errors (bad destination/equipment) would never succeed — drop them.
      const permanent = error ? /INVALID|violates|Unknown/i.test(error.message) : false;
      if (!error || duplicate) {
        synced += duplicate ? 0 : 1;
        await tx("readwrite", (s) => s.delete(item.qid));
      } else if (permanent) {
        await tx("readwrite", (s) => s.delete(item.qid));
      }
    }
  } finally {
    flushing = false;
    emitChange();
  }
  return synced;
}
