import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { flushQueue, queueCount } from "./offlineQueue";

/**
 * Keeps the offline trip queue in sync: flushes whenever the device regains
 * network (or every 30s while online) and refreshes all live views afterwards.
 */
export function useOfflineSync() {
  const qc = useQueryClient();
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  const sync = useCallback(async () => {
    const synced = await flushQueue();
    setPending(queueCount());
    if (synced > 0) {
      toast.success(`${synced} offline ${synced === 1 ? "entry" : "entries"} synced`);
      void qc.invalidateQueries();
    }
  }, [qc]);

  useEffect(() => {
    setOnline(navigator.onLine);
    setPending(queueCount());

    const onQueue = () => setPending(queueCount());
    const onOnline = () => {
      setOnline(true);
      void sync();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("fleetiq:queue-changed", onQueue);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const id = window.setInterval(() => {
      if (navigator.onLine) void sync();
    }, 30_000);

    void sync();

    return () => {
      window.removeEventListener("fleetiq:queue-changed", onQueue);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(id);
    };
  }, [sync]);

  return { pending, online, sync };
}
