import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { LoadingBlock, Panel, SectionHeader } from "@/components/fleetiq/Cards";
import { useAuditLogs, useOperatorLogs } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";
import { downloadCsv, fmtNumber, fmtTime, todayISO } from "@/lib/fleetiq";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — LLOYDS FLEETIQ" },
      { name: "description", content: "Shift reports, equipment and operator performance, and audit trail exports." },
      { property: "og:title", content: "Reports — LLOYDS FLEETIQ" },
      { property: "og:description", content: "Exportable mine performance and audit reports." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { isAdmin } = useAuth();
  const [date, setDate] = useState(todayISO());
  const { data: logs = [], isLoading } = useOperatorLogs({ date, limit: 2000 });
  const { data: audit = [] } = useAuditLogs();

  const byEquipment = useMemo(() => {
    const m = new Map<string, { trips: number; tonnes: number; load: number; unload: number; entries: number }>();
    logs.forEach((l) => {
      const cur = m.get(l.equipment_code) ?? { trips: 0, tonnes: 0, load: 0, unload: 0, entries: 0 };
      m.set(l.equipment_code, {
        trips: cur.trips + l.trips,
        tonnes: cur.tonnes + Number(l.quantity_t),
        load: cur.load + l.loading_time_min,
        unload: cur.unload + l.unloading_time_min,
        entries: cur.entries + 1,
      });
    });
    return Array.from(m, ([code, v]) => ({ code, ...v })).sort((a, b) => b.tonnes - a.tonnes);
  }, [logs]);

  const byOperator = useMemo(() => {
    const m = new Map<string, { name: string; trips: number; tonnes: number }>();
    logs.forEach((l) => {
      const key = l.employee_id ?? l.employee_name ?? "—";
      const cur = m.get(key) ?? { name: l.employee_name ?? "—", trips: 0, tonnes: 0 };
      m.set(key, { name: cur.name, trips: cur.trips + l.trips, tonnes: cur.tonnes + Number(l.quantity_t) });
    });
    return Array.from(m, ([id, v]) => ({ id, ...v })).sort((a, b) => b.tonnes - a.tonnes);
  }, [logs]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <SectionHeader
        title="Reports"
        subtitle="Shift, equipment and operator performance built from existing logs — exportable to CSV/Excel"
        actions={
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Report date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          </div>
        }
      />

      <Tabs defaultValue="equipment">
        <TabsList className="bg-secondary/60">
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="operators">Operators</TabsTrigger>
          {isAdmin && <TabsTrigger value="audit">Audit trail</TabsTrigger>}
        </TabsList>

        <TabsContent value="equipment">
          <Panel className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Equipment performance</h2>
              <Button variant="secondary" onClick={() => exportExcel()}>
                <Download className="mr-2 h-4 w-4" /> Export Excel
              </Button>
            </div>

            {isLoading ? (
              <LoadingBlock rows={5} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                      <th className="py-2">Equipment</th>
                      <th className="py-2 text-right">Entries</th>
                      <th className="py-2 text-right">Trips</th>
                      <th className="py-2 text-right">Tonnes</th>
                      <th className="py-2 text-right">Avg load (min)</th>
                      <th className="py-2 text-right">Avg unload (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byEquipment.map((e) => (
                      <tr key={e.code} className="border-t border-border">
                        <td className="py-2">{e.code}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{e.entries}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{e.trips}</td>
                        <td className="py-2 text-right font-mono tabular-nums text-primary">{fmtNumber(e.tonnes)}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{fmtNumber(e.load / e.entries, 1)}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{fmtNumber(e.unload / e.entries, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="operators">
          <Panel className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Operator performance</h2>
              <Button variant="secondary" onClick={() => downloadCsv(`fleetiq-operators-${date}.csv`, byOperator)}>
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <th className="py-2">Employee ID</th>
                  <th className="py-2">Name</th>
                  <th className="py-2 text-right">Trips</th>
                  <th className="py-2 text-right">Tonnes</th>
                </tr>
              </thead>
              <tbody>
                {byOperator.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="py-2 font-mono text-xs">{o.id}</td>
                    <td className="py-2">{o.name}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{o.trips}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-primary">{fmtNumber(o.tonnes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </TabsContent>


        {isAdmin && (
          <TabsContent value="audit">
            <Panel className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Audit trail</h2>
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                      <th className="py-2">Time</th>
                      <th className="py-2">Action</th>
                      <th className="py-2">Entity</th>
                      <th className="py-2">User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id} className="border-t border-border">
                        <td className="py-2 font-mono text-xs tabular-nums">{fmtTime(a.created_at)}</td>
                        <td className="py-2">{a.action}</td>
                        <td className="py-2 text-muted-foreground">{a.entity}</td>
                        <td className="py-2">
                          {a.employee_name ?? "—"} <span className="text-xs text-muted-foreground">{a.employee_id ?? ""}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
