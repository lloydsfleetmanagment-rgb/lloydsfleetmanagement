import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { KpiCard, LoadingBlock, Panel, SectionHeader } from "@/components/fleetiq/Cards";
import { useOperatorLogs } from "@/lib/queries";
import { downloadCsv, fmtNumber, fmtTime, todayISO } from "@/lib/fleetiq";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/production")({
  head: () => ({
    meta: [
      { title: "Production — LLOYDS FLEETIQ" },
      { name: "description", content: "Material-wise, destination-wise and shift-wise production tracking for Surjagarh." },
      { property: "og:title", content: "Production — LLOYDS FLEETIQ" },
      { property: "og:description", content: "Material and destination production tracking." },
    ],
  }),
  component: ProductionPage,
});

function ProductionPage() {
  const [date, setDate] = useState(todayISO());
  const [shift, setShift] = useState<"ALL" | "A" | "B" | "C">("ALL");
  const { data: logs = [], isLoading } = useOperatorLogs({ date, limit: 2000 });

  const rows = useMemo(() => logs.filter((l) => shift === "ALL" || l.shift === shift), [logs, shift]);

  const byMaterial = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.material_code, (m.get(r.material_code) ?? 0) + Number(r.quantity_t)));
    return Array.from(m, ([code, tonnes]) => ({ code, tonnes })).sort((a, b) => b.tonnes - a.tonnes);
  }, [rows]);

  const byDestination = useMemo(() => {
    const m = new Map<string, { tonnes: number; trips: number }>();
    rows.forEach((r) => {
      const cur = m.get(r.destination_code) ?? { tonnes: 0, trips: 0 };
      m.set(r.destination_code, { tonnes: cur.tonnes + Number(r.quantity_t), trips: cur.trips + r.trips });
    });
    return Array.from(m, ([code, v]) => ({ code, ...v })).sort((a, b) => b.tonnes - a.tonnes);
  }, [rows]);

  const total = rows.reduce((s, r) => s + Number(r.quantity_t), 0);
  const trips = rows.reduce((s, r) => s + r.trips, 0);

  return (
    <div className="mx-auto max-w-[1500px]">
      <SectionHeader
        title="Production Tracking"
        subtitle="Every tonne here comes from operator trip logs — no duplicate data entry."
        actions={
          <>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Shift</Label>
              <Select value={shift} onValueChange={(v) => setShift(v as typeof shift)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="A">Shift A</SelectItem>
                  <SelectItem value="B">Shift B</SelectItem>
                  <SelectItem value="C">Shift C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="secondary"
              className="self-end"
              onClick={() =>
                downloadCsv(
                  `fleetiq-production-${date}.csv`,
                  rows.map((r) => ({
                    Time: fmtTime(r.logged_at),
                    Shift: r.shift,
                    Employee: r.employee_name ?? "",
                    EmployeeID: r.employee_id ?? "",
                    Equipment: r.equipment_code,
                    Material: r.material_code,
                    Destination: r.destination_code,
                    Trips: r.trips,
                    Tonnes: r.quantity_t,
                  })),
                )
              }
            >
              Export CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Total dispatched" value={total} unit="t" />
        <KpiCard label="Total trips" value={trips} delay={60} />
        <KpiCard label="Entries" value={rows.length} delay={120} />
        <KpiCard label="Avg load" value={trips ? total / trips : 0} unit="t" digits={1} delay={180} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel className="p-6">
          <h2 className="text-lg font-semibold">Material-wise</h2>
          <div className="mt-4 space-y-3">
            {byMaterial.map((m) => (
              <div key={m.code}>
                <div className="flex justify-between text-sm">
                  <span>{m.code}</span>
                  <span className="font-mono tabular-nums text-primary">{fmtNumber(m.tonnes)} t</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${total ? (m.tonnes / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {byMaterial.length === 0 && <p className="text-sm text-muted-foreground">No production recorded.</p>}
          </div>
        </Panel>

        <Panel className="p-6">
          <h2 className="text-lg font-semibold">Destination-wise</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <th className="py-2">Destination</th>
                  <th className="py-2 text-right">Trips</th>
                  <th className="py-2 text-right">Tonnes</th>
                </tr>
              </thead>
              <tbody>
                {byDestination.map((d) => (
                  <tr key={d.code} className="border-t border-border">
                    <td className="py-2">{d.code}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{fmtNumber(d.trips)}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-primary">{fmtNumber(d.tonnes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel className="mt-6 p-6">
        <h2 className="text-lg font-semibold">Entry log</h2>
        {isLoading ? (
          <LoadingBlock rows={5} />
        ) : (
          <div className="mt-4 max-h-[460px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <th className="py-2">Time</th>
                  <th className="py-2">Shift</th>
                  <th className="py-2">Operator</th>
                  <th className="py-2">Equipment</th>
                  <th className="py-2">Material</th>
                  <th className="py-2">Destination</th>
                  <th className="py-2 text-right">Trips</th>
                  <th className="py-2 text-right">Tonnes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 font-mono text-xs tabular-nums">{fmtTime(r.logged_at)}</td>
                    <td className="py-2">{r.shift}</td>
                    <td className="py-2">
                      {r.employee_name ?? "—"}
                      <span className="ml-1 text-xs text-muted-foreground">{r.employee_id ?? ""}</span>
                    </td>
                    <td className="py-2">{r.equipment_code}</td>
                    <td className="py-2">{r.material_code}</td>
                    <td className="py-2">{r.destination_code}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{r.trips}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-primary">{fmtNumber(Number(r.quantity_t))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
