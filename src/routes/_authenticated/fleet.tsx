import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEquipment, useTodayLogs, writeAudit, type Equipment } from "@/lib/queries";
import { EQUIPMENT_STATUSES, fmtNumber, statusTone } from "@/lib/fleetiq";
import { useShiftClock } from "@/lib/useShiftClock";
import { LoadingBlock, SectionHeader } from "@/components/fleetiq/Cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet — LLOYDS FLEETIQ" },
      { name: "description", content: "All dumpers and Sany trucks with status, location, cycles and operators." },
      { property: "og:title", content: "Fleet — LLOYDS FLEETIQ" },
      { property: "og:description", content: "Dumper and Sany fleet status board for Surjagarh." },
    ],
  }),
  component: FleetPage,
});

function FleetPage() {
  const { canManage, canDelete, isOperator, user, profile } = useAuth();
  const qc = useQueryClient();
  const { data: equipment = [], isLoading } = useEquipment();
  const { data: logs = [] } = useTodayLogs();
  const { date: shiftDate, shift } = useShiftClock();
  const [filter, setFilter] = useState<"ALL" | "DUMPER" | "SANY">("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState("DUMPER");

  const tripsToday = useMemo(() => {
    const m = new Map<string, { trips: number; tonnes: number }>();
    logs.forEach((l) => {
      const cur = m.get(l.equipment_code) ?? { trips: 0, tonnes: 0 };
      m.set(l.equipment_code, { trips: cur.trips + l.trips, tonnes: cur.tonnes + Number(l.quantity_t) });
    });
    return m;
  }, [logs]);

  // Location resets to NA at every shift start; it only shows once the operator
  // logs a destination in the current shift.
  const shiftLocation = useMemo(() => {
    const m = new Map<string, string>();
    logs
      .filter((l) => l.shift === shift && l.log_date === shiftDate)
      .slice()
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
      .forEach((l) => m.set(l.equipment_code, l.destination_code));
    return m;
  }, [logs, shift, shiftDate]);

  const list = equipment.filter(
    (e) => (filter === "ALL" || e.equipment_type === filter) && e.code.toLowerCase().includes(search.toLowerCase()),
  );

  const canEdit = (e: Equipment) => canManage || (isOperator && e.assigned_user_id === user?.id);

  const saveSelected = async (patch: Partial<Equipment>) => {
    if (!selected) return;
    const { error } = await supabase.from("equipment").update(patch).eq("id", selected.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await writeAudit({
      action: "EQUIPMENT_UPDATED",
      entity: "equipment",
      entity_id: selected.id,
      user_id: user?.id ?? null,
      employee_id: profile?.employee_id ?? null,
      employee_name: profile?.employee_name ?? null,
      details: patch as Record<string, unknown>,
    });
    toast.success("Equipment updated");
    setSelected({ ...selected, ...patch });
    void qc.invalidateQueries({ queryKey: ["equipment"] });
  };

  const addEquipment = async () => {
    const { error } = await supabase
      .from("equipment")
      .insert({ code: newCode.trim(), equipment_type: newType, capacity_t: newType === "DUMPER" ? 100 : 70 });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Equipment added");
    setAddOpen(false);
    setNewCode("");
    void qc.invalidateQueries({ queryKey: ["equipment"] });
  };

  const removeEquipment = async (id: string) => {
    const { error } = await supabase.from("equipment").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Equipment removed");
    setSelected(null);
    void qc.invalidateQueries({ queryKey: ["equipment"] });
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <SectionHeader
        title="Fleet Management"
        subtitle={`${equipment.length} units · trips logged by operators update these cards automatically`}
        actions={
          <>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search DMP-305 / SANY-42"
              className="w-52"
            />
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                <SelectItem value="DUMPER">Dumpers</SelectItem>
                <SelectItem value="SANY">Sany</SelectItem>
              </SelectContent>
            </Select>
            {canManage && (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Equipment
              </Button>
            )}
          </>
        }
      />

      {isLoading ? (
        <LoadingBlock rows={6} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((e, i) => {
            const t = tripsToday.get(e.code);
            return (
              <button
                key={e.id}
                onClick={() => setSelected(e)}
                className="surface-1 tilt-card animate-fade-up rounded-2xl p-4 text-left"
                style={{ animationDelay: `${Math.min(i, 20) * 18}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{e.code}</p>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{e.equipment_type}</p>
                  </div>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className={statusTone(e.status)}>{e.status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Location</p>
                    <p className="truncate">{shiftLocation.get(e.code) ?? "NA"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cycles today</p>
                    <p className="font-mono tabular-nums">{fmtNumber(t?.trips ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Today</p>
                    <p className="font-mono tabular-nums text-primary">{fmtNumber(t?.tonnes ?? 0)} t</p>
                  </div>
                </div>
                <p className="mt-3 truncate text-[11px] text-muted-foreground">
                  Operator: {e.operator_name ?? "—"} {e.operator_employee_id ? `(${e.operator_employee_id})` : ""}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => (!o ? setSelected(null) : null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.code}</SheetTitle>
                <SheetDescription>
                  {selected.equipment_type} · {selected.capacity_t} t per trip
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={selected.status}
                    onValueChange={(v) => void saveSelected({ status: v })}
                    disabled={!canEdit(selected)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Current location (shift {shift})</Label>
                  <Input
                    key={`${selected.id}-${shift}`}
                    defaultValue={shiftLocation.get(selected.code) ?? "NA"}
                    disabled={!canEdit(selected)}
                    onBlur={(e) => void saveSelected({ location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Textarea
                    defaultValue={selected.remarks ?? ""}
                    disabled={!canEdit(selected)}
                    onBlur={(e) => void saveSelected({ remarks: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Operator name</Label>
                  <Input
                    defaultValue={selected.operator_name ?? ""}
                    disabled={!canManage}
                    onBlur={(e) => void saveSelected({ operator_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Operator Employee ID</Label>
                  <Input
                    defaultValue={selected.operator_employee_id ?? ""}
                    disabled={!canManage}
                    onBlur={(e) => void saveSelected({ operator_employee_id: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-border bg-secondary/40 p-3">
                    <p className="text-muted-foreground">Cycles today ({shiftDate})</p>
                    <p className="font-mono text-lg tabular-nums text-primary">
                      {fmtNumber(tripsToday.get(selected.code)?.trips ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/40 p-3">
                    <p className="text-muted-foreground">Lifetime cycles</p>
                    <p className="font-mono text-lg tabular-nums">{fmtNumber(selected.cycle_count)}</p>
                  </div>
                </div>
                {!canEdit(selected) && (
                  <p className="text-xs text-muted-foreground">
                    View only — you can edit status, location and remarks for equipment assigned to you.
                  </p>
                )}
                {canDelete && (
                  <Button variant="destructive" className="w-full" onClick={() => void removeEquipment(selected.id)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete equipment
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add equipment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Equipment code</Label>
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="DMP-331" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DUMPER">DUMPER (100 t / trip)</SelectItem>
                  <SelectItem value="SANY">SANY (70 t / trip)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void addEquipment()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
