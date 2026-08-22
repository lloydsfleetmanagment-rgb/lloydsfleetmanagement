import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EMERGENCY_NOTIFY_EMAIL } from "@/lib/fleetiq";
import { writeAudit } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Alert = {
  id: string;
  created_at: string;
  employee_id: string | null;
  employee_name: string | null;
  login_id: string | null;
  shift: string | null;
  equipment_code: string | null;
  material_code: string | null;
  destination_code: string | null;
  message: string | null;
  status: string;
};

/** Plays a short repeating alarm tone using the Web Audio API (no assets, no hardware). */
function useAlarm() {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const start = useCallback(() => {
    try {
      ctxRef.current ??= new AudioContext();
      const ctx = ctxRef.current;
      void ctx.resume();
      const beep = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.36);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      };
      beep();
      stop();
      timerRef.current = window.setInterval(beep, 1200);
    } catch {
      /* audio unavailable — popup still shows */
    }
  }, [stop]);

  useEffect(() => stop, [stop]);
  return { start, stop };
}

export function EmergencyWatcher() {
  const { canManage, profile, user } = useAuth();
  const qc = useQueryClient();
  const [alert, setAlert] = useState<Alert | null>(null);
  const { start, stop } = useAlarm();

  useEffect(() => {
    if (!canManage) return;
    const channel = supabase
      .channel("emergency-alerts-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "emergency_alerts" }, (payload) => {
        const row = payload.new as Alert;
        setAlert(row);
        start();
        void qc.invalidateQueries({ queryKey: ["emergency_alerts"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "emergency_alerts" }, () => {
        void qc.invalidateQueries({ queryKey: ["emergency_alerts"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canManage, qc, start]);

  const close = () => {
    stop();
    setAlert(null);
  };

  const setStatus = async (status: "ACKNOWLEDGED" | "RESOLVED") => {
    if (!alert) return;
    const now = new Date().toISOString();
    const patch =
      status === "ACKNOWLEDGED"
        ? { status, acknowledged_by: user?.id ?? null, acknowledged_at: now }
        : { status, resolved_by: user?.id ?? null, resolved_at: now };
    const { error } = await supabase.from("emergency_alerts").update(patch).eq("id", alert.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await writeAudit({
      action: status === "ACKNOWLEDGED" ? "EMERGENCY_ACKNOWLEDGED" : "EMERGENCY_RESOLVED",
      entity: "emergency_alerts",
      entity_id: alert.id,
      user_id: user?.id ?? null,
      employee_id: profile?.employee_id ?? null,
      employee_name: profile?.employee_name ?? null,
      details: { notified: EMERGENCY_NOTIFY_EMAIL },
    });
    toast.success(`Alert ${status.toLowerCase()}`);
    void qc.invalidateQueries({ queryKey: ["emergency_alerts"] });
    close();
  };

  return (
    <Dialog open={!!alert} onOpenChange={(open) => (!open ? close() : null)}>
      <DialogContent className="border-destructive/50 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <span className="animate-alarm inline-flex h-8 w-8 items-center justify-center rounded-full bg-destructive/15">
              <AlertTriangle className="h-4 w-4" />
            </span>
            EMERGENCY ALERT
          </DialogTitle>
          <DialogDescription>Live alert received from the operator console.</DialogDescription>
        </DialogHeader>
        {alert && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Alert ID", alert.id.slice(0, 8).toUpperCase()],
              ["Employee ID", alert.employee_id ?? "—"],
              ["Employee Name", alert.employee_name ?? "—"],
              ["Login / User ID", alert.login_id ?? "—"],
              ["Time", new Date(alert.created_at).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })],
              ["Shift", alert.shift ?? "—"],
              ["Equipment", alert.equipment_code ?? "—"],
              ["Material", alert.material_code ?? "—"],
              ["Destination", alert.destination_code ?? "—"],
              ["Status", alert.status],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-secondary/40 p-2.5">
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 font-mono text-xs">{v}</dd>
              </div>
            ))}
            {alert.message ? (
              <div className="col-span-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                {alert.message}
              </div>
            ) : null}
          </dl>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            View later
          </Button>
          <Button variant="outline" onClick={() => void setStatus("ACKNOWLEDGED")}>
            Acknowledge
          </Button>
          <Button onClick={() => void setStatus("RESOLVED")}>Resolve</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
