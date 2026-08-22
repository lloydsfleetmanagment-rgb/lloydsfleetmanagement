import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Factory } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCrushers, useTodayLogs } from "@/lib/queries";
import { CRUSHER_STATUSES, fmtNumber, statusTone } from "@/lib/fleetiq";
import { Panel, Progress3D, SectionHeader } from "@/components/fleetiq/Cards";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crushers")({
  head: () => ({
    meta: [
      { title: "Crushers — LLOYDS FLEETIQ" },
      { name: "description", content: "TH-1 to TH-5 crusher status, feed rate, downtime and material received." },
      { property: "og:title", content: "Crushers — LLOYDS FLEETIQ" },
      { property: "og:description", content: "Crusher performance monitoring at Surjagarh." },
    ],
  }),
  component: CrushersPage,
});

function CrushersPage() {
  const { canManage } = useAuth();
  const qc = useQueryClient();
  const { data: crushers = [] } = useCrushers();
  const { data: logs = [] } = useTodayLogs();

  const received = useMemo(() => {
    const m = new Map<string, { tonnes: number; trips: number }>();
    logs.forEach((l) => {
      const cur = m.get(l.destination_code) ?? { tonnes: 0, trips: 0 };
      m.set(l.destination_code, { tonnes: cur.tonnes + Number(l.quantity_t), trips: cur.trips + l.trips });
    });
    return m;
  }, [logs]);

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("crushers").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Crusher updated");
    void qc.invalidateQueries({ queryKey: ["crushers"] });
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <SectionHeader
        title="Crusher Monitoring"
        subtitle="TH-1 to TH-5 · TH-2 and TH-3 accept SANY equipment only"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {crushers.map((c, i) => {
          const r = received.get(c.code) ?? { tonnes: 0, trips: 0 };
          return (
            <Panel key={c.id} className="animate-fade-up p-5" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{c.code}</h2>
                  <p className="text-xs text-muted-foreground">{c.name}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs ${statusTone(c.status)}`}>
                  <Factory className="h-3.5 w-3.5" /> {c.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-border bg-secondary/40 p-3">
                  <p className="text-xs text-muted-foreground">Received today</p>
                  <p className="font-mono text-lg tabular-nums text-primary">{fmtNumber(r.tonnes)} t</p>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-3">
                  <p className="text-xs text-muted-foreground">Trips in</p>
                  <p className="font-mono text-lg tabular-nums">{fmtNumber(r.trips)}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <Progress3D label="Feed vs capacity" value={r.tonnes} max={Number(c.capacity_tph) * 12} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={c.status} onValueChange={(v) => void update(c.id, { status: v })} disabled={!canManage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRUSHER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Downtime today (min)</Label>
                  <Input
                    type="number"
                    defaultValue={c.downtime_min}
                    disabled={!canManage}
                    onBlur={(e) => void update(c.id, { downtime_min: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Rated capacity (tph)</Label>
                  <Input
                    type="number"
                    defaultValue={c.capacity_tph}
                    disabled={!canManage}
                    onBlur={(e) => void update(c.id, { capacity_tph: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Remarks</Label>
                  <Input
                    defaultValue={c.remarks ?? ""}
                    disabled={!canManage}
                    onBlur={(e) => void update(c.id, { remarks: e.target.value })}
                  />
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
