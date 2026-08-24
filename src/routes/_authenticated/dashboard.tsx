import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Layers, Truck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KpiCard, LoadingBlock, Panel, Progress3D, SectionHeader } from "@/components/fleetiq/Cards";
import { MineMap } from "@/components/fleetiq/MineMap";
import { useCrushers, useEquipment, useTodayLogs } from "@/lib/queries";
import { downloadCsv, fmtNumber } from "@/lib/fleetiq";
import { useShiftClock } from "@/lib/useShiftClock";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — LLOYDS FLEETIQ" },
      { name: "description", content: "Live production, fleet and screens plant KPIs for the Surjagarh Iron Ore Mine." },
      { property: "og:title", content: "Dashboard — LLOYDS FLEETIQ" },
      { property: "og:description", content: "Live production, fleet and screens plant KPIs for Surjagarh." },
    ],
  }),
  component: DashboardPage,
});

const DAILY_TARGET = 45000;

function hourKey(iso: string) {
  return Number(
    new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }),
  );
}

function DashboardPage() {
  const { date, shift } = useShiftClock();
  const { data: logs = [], isLoading, dataUpdatedAt } = useTodayLogs(date);
  const { data: equipment = [] } = useEquipment();
  const { data: crushers = [] } = useCrushers();
  const [shiftFilter, setShiftFilter] = useState<"ALL" | "A" | "B" | "C">("ALL");

  const stats = useMemo(() => {
    const total = logs.reduce((s, l) => s + Number(l.quantity_t), 0);
    const rom = logs.filter((l) => l.material_code === "ROM").reduce((s, l) => s + Number(l.quantity_t), 0);
    const bhq = logs.filter((l) => l.material_code === "BHQ").reduce((s, l) => s + Number(l.quantity_t), 0);
    const shale = logs.filter((l) => l.material_code === "SHALE").reduce((s, l) => s + Number(l.quantity_t), 0);
    // Active = trucks that actually logged a trip today (resets automatically each day).
    const active = new Set(logs.map((l) => l.equipment_code).filter(Boolean)).size;
    const trips = logs.reduce((s, l) => s + l.trips, 0);
    return { total, rom, bhq, shale, active, trips };
  }, [logs]);

  const lastUpdated = new Date(dataUpdatedAt || Date.now()).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });

  const hourly = useMemo(() => {
    const rows = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, "0")}:00`, ROM: 0, BHQ: 0, SHALE: 0, trips: 0 }));
    logs
      .filter((l) => shiftFilter === "ALL" || l.shift === shiftFilter)
      .forEach((l) => {
        const row = rows[hourKey(l.logged_at)];
        if (!row) return;
        const key = l.material_code as "ROM" | "BHQ" | "SHALE";
        if (key in row) row[key] += Number(l.quantity_t);
        row.trips += l.trips;
      });
    return rows;
  }, [logs, shiftFilter]);

  const shiftwise = useMemo(() => {
    return (["A", "B", "C"] as const).map((shift) => {
      const rows = logs.filter((l) => l.shift === shift);
      return {
        shift,
        rom: rows.filter((r) => r.material_code === "ROM").reduce((s, r) => s + Number(r.quantity_t), 0),
        bhq: rows.filter((r) => r.material_code === "BHQ").reduce((s, r) => s + Number(r.quantity_t), 0),
        shale: rows.filter((r) => r.material_code === "SHALE").reduce((s, r) => s + Number(r.quantity_t), 0),
        trips: rows.reduce((s, r) => s + r.trips, 0),
      };
    });
  }, [logs]);

  const crusherRom = useMemo(() => {
    return crushers.map((c) => ({
      code: c.code,
      status: c.status,
      received: logs.filter((l) => l.destination_code === c.code).reduce((s, l) => s + Number(l.quantity_t), 0),
    }));
  }, [crushers, logs]);

  // Every ROM / BHQ / SHALE trip lands against the destination the operator chose.
  const byDestination = useMemo(() => {
    const map = new Map<string, { destination: string; ROM: number; BHQ: number; SHALE: number; total: number }>();
    logs.forEach((l) => {
      const row =
        map.get(l.destination_code) ?? { destination: l.destination_code, ROM: 0, BHQ: 0, SHALE: 0, total: 0 };
      const key = l.material_code as "ROM" | "BHQ" | "SHALE";
      const qty = Number(l.quantity_t);
      if (key in row) row[key] += qty;
      row.total += qty;
      map.set(l.destination_code, row);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [logs]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <SectionHeader
        title="Mine Control Dashboard"
        subtitle={`Surjagarh Iron Ore Mine · ${date} · Shift ${shift} · auto-refreshing live from operator logs`}
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv(
                `fleetiq-hourly-rom-${date}.csv`,
                hourly.map((h) => ({ Hour: h.hour, ROM_t: h.ROM, BHQ_t: h.BHQ, SHALE_t: h.SHALE, Trips: h.trips })),
              )
            }
          >
            Export hourly ROM
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Today's Production" value={stats.total} unit="t" icon={<Activity className="h-4 w-4" />} delay={0} />
        <KpiCard label="ROM" value={stats.rom} unit="t" hint="Hematite dispatched" icon={<Layers className="h-4 w-4" />} delay={60} />
        <KpiCard label="BHQ" value={stats.bhq} unit="t" hint="Banded hematite quartzite" icon={<Layers className="h-4 w-4" />} delay={120} />
        <KpiCard label="SHALE" value={stats.shale} unit="t" hint="Waste / shale dispatch" icon={<Layers className="h-4 w-4" />} delay={180} />
        <KpiCard
          label="Active Trucks"
          value={stats.active}
          hint={`Ran today (${date}) · ${equipment.length} in fleet · updated ${lastUpdated} IST`}
          icon={<Truck className="h-4 w-4" />}
          delay={240}
        />
        <KpiCard label="Total Trips" value={stats.trips} hint="All materials today" icon={<Activity className="h-4 w-4" />} delay={300} />

      </div>


      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel className="p-6 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Hourly ROM report</h2>
              <p className="text-sm text-muted-foreground">Shift-wise and hour-wise dispatch, generated live from operator logs.</p>
            </div>
            <Tabs value={shiftFilter} onValueChange={(v) => setShiftFilter(v as typeof shiftFilter)}>
              <TabsList className="bg-secondary/60">
                <TabsTrigger value="ALL">All</TabsTrigger>
                <TabsTrigger value="A">A</TabsTrigger>
                <TabsTrigger value="B">B</TabsTrigger>
                <TabsTrigger value="C">C</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <LoadingBlock rows={4} />
          ) : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "oklch(0.6645 0.0291 262.29)" }} interval={1} />
                    <YAxis tick={{ fontSize: 10, fill: "oklch(0.6645 0.0291 262.29)" }} />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.2505 0.0128 258.37)",
                        border: "1px solid oklch(1 0 0 / 0.1)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="ROM" fill="oklch(0.778 0.1454 169.75)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="BHQ" fill="oklch(0.4029 0.0367 251.7)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="SHALE" fill="oklch(0.6645 0.0291 262.29)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                      <th className="py-2">Shift</th>
                      <th className="py-2 text-right">ROM (t)</th>
                      <th className="py-2 text-right">BHQ (t)</th>
                      <th className="py-2 text-right">Shale (t)</th>
                      <th className="py-2 text-right">Trips</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftwise.map((s) => (
                      <tr key={s.shift} className="border-t border-border font-mono tabular-nums">
                        <td className="py-2 font-sans">{s.shift}</td>
                        <td className="py-2 text-right text-primary">{fmtNumber(s.rom)}</td>
                        <td className="py-2 text-right">{fmtNumber(s.bhq)}</td>
                        <td className="py-2 text-right">{fmtNumber(s.shale)}</td>
                        <td className="py-2 text-right">{fmtNumber(s.trips)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel className="p-6">
            <h2 className="text-lg font-semibold">Progress to target</h2>
            <div className="mt-4 space-y-4">
              <Progress3D label="Total dispatch" value={stats.total} max={DAILY_TARGET} />
              <Progress3D label="ROM / Hematite" value={stats.rom} max={DAILY_TARGET * 0.7} />
              <Progress3D label="BHQ" value={stats.bhq} max={DAILY_TARGET * 0.2} />
              <Progress3D label="Shale" value={stats.shale} max={DAILY_TARGET * 0.1} />
            </div>
          </Panel>

          <Panel className="p-6">
            <h2 className="text-lg font-semibold">Screens Plant intake today</h2>
            <div className="mt-4 space-y-3">
              {crusherRom.map((c) => (
                <div key={c.code} className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
                  <span className="text-sm">{c.code}</span>
                  <span className="font-mono text-sm tabular-nums text-primary">{fmtNumber(c.received)} t</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="mt-6 p-6">
        <h2 className="text-lg font-semibold">Destination-wise dispatch (ROM · BHQ · Shale)</h2>
        <p className="text-sm text-muted-foreground">
          Every operator entry is credited to the destination selected for that material.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="py-2">Destination</th>
                <th className="py-2 text-right">ROM (t)</th>
                <th className="py-2 text-right">BHQ (t)</th>
                <th className="py-2 text-right">Shale (t)</th>
                <th className="py-2 text-right">Total (t)</th>
              </tr>
            </thead>
            <tbody>
              {byDestination.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-muted-foreground">
                    No dispatch logged today.
                  </td>
                </tr>
              )}
              {byDestination.map((d) => (
                <tr key={d.destination} className="border-t border-border font-mono tabular-nums">
                  <td className="py-2 font-sans">{d.destination}</td>
                  <td className="py-2 text-right text-primary">{fmtNumber(d.ROM)}</td>
                  <td className="py-2 text-right">{fmtNumber(d.BHQ)}</td>
                  <td className="py-2 text-right">{fmtNumber(d.SHALE)}</td>
                  <td className="py-2 text-right">{fmtNumber(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="mt-6 p-6">
        <h2 className="text-lg font-semibold">Lease overview — 348 Ha</h2>
        <p className="text-sm text-muted-foreground">Stylised mine layout with live dig-face and screens plant activity.</p>
        <MineMap logs={logs} />
      </Panel>
    </div>
  );
}
