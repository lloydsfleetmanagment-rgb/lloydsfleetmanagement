import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Save, Siren } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDestinations, useEquipment, useMaterials, useOperatorLogs, writeAudit } from "@/lib/queries";
import { EMERGENCY_NOTIFY_EMAIL, currentShift, fmtNumber, todayISO, tonnesFor } from "@/lib/fleetiq";
import { KpiCard, Panel, SectionHeader } from "@/components/fleetiq/Cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/operator")({
  head: () => ({
    meta: [
      { title: "Operator Console — LLOYDS FLEETIQ" },
      { name: "description", content: "Log trips, loading and unloading times, and raise emergency alerts from the pit." },
      { property: "og:title", content: "Operator Console — LLOYDS FLEETIQ" },
      { property: "og:description", content: "Trip logging and emergency alerts for Surjagarh operators." },
    ],
  }),
  component: OperatorConsole,
});

function OperatorConsole() {
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const { data: equipment = [] } = useEquipment();
  const { data: materials = [] } = useMaterials();
  const { data: destinations = [] } = useDestinations();
  const { data: myLogs = [] } = useOperatorLogs({ date: todayISO(), userId: user?.id, limit: 100 });

  const [equipmentId, setEquipmentId] = useState("");
  const [material, setMaterial] = useState("");
  const [destination, setDestination] = useState("");
  const [trips, setTrips] = useState("");
  const [shift, setShift] = useState(currentShift());
  const [loadingTime, setLoadingTime] = useState("");
  const [unloadingTime, setUnloadingTime] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [invalidOpen, setInvalidOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyMsg, setEmergencyMsg] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const selectedEquipment = equipment.find((e) => e.id === equipmentId);
  const validDestinations = useMemo(
    () => destinations.filter((d) => d.material_code === material),
    [destinations, material],
  );

  // Destination list depends on material — clear invalid selections immediately.
  useEffect(() => {
    if (destination && !validDestinations.some((d) => d.code === destination)) setDestination("");
  }, [validDestinations, destination]);

  const destinationRow = destinations.find((d) => d.code === destination);
  const equipmentBlocked =
    !!destinationRow && !!selectedEquipment && !destinationRow.allowed_equipment_types.includes(selectedEquipment.equipment_type);

  useEffect(() => {
    if (equipmentBlocked) setInvalidOpen(true);
  }, [equipmentBlocked]);

  const quantity = tonnesFor(selectedEquipment?.equipment_type, Number(trips));

  // Draft auto-save so a half-finished entry survives a page reload.
  useEffect(() => {
    const raw = window.localStorage.getItem("fleetiq:draft");
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as Record<string, string>;
      setEquipmentId(d['equipmentId'] ?? "");
      setMaterial(d['material'] ?? "");
      setTrips(d['trips'] ?? "");
      setLoadingTime(d['loadingTime'] ?? "");
      setUnloadingTime(d['unloadingTime'] ?? "");
      setRemarks(d['remarks'] ?? "");
    } catch {
      /* ignore malformed draft */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      window.localStorage.setItem(
        "fleetiq:draft",
        JSON.stringify({ equipmentId, material, trips, loadingTime, unloadingTime, remarks }),
      );
    }, 600);
    return () => clearTimeout(t);
  }, [equipmentId, material, trips, loadingTime, unloadingTime, remarks]);

  const reset = () => {
    setTrips("");
    setLoadingTime("");
    setUnloadingTime("");
    setRemarks("");
    window.localStorage.removeItem("fleetiq:draft");
  };

  const save = async () => {
    if (!selectedEquipment || !material || !destination || !trips) {
      toast.error("Complete equipment, material, destination and trips");
      return;
    }
    if (equipmentBlocked) {
      setInvalidOpen(true);
      await writeAudit({
        action: "INVALID_EQUIPMENT_ATTEMPT",
        entity: "operator_logs",
        user_id: user?.id ?? null,
        employee_id: profile?.employee_id ?? null,
        employee_name: profile?.employee_name ?? null,
        details: { destination, equipment: selectedEquipment.code, equipment_type: selectedEquipment.equipment_type },
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("operator_logs").insert({
      shift,
      user_id: user?.id as string,
      employee_id: profile?.employee_id ?? null,
      employee_name: profile?.employee_name ?? null,
      equipment_id: selectedEquipment.id,
      equipment_code: selectedEquipment.code,
      equipment_type: selectedEquipment.equipment_type,
      material_code: material,
      destination_code: destination,
      trips: Number(trips),
      loading_time_min: Number(loadingTime || 0),
      unloading_time_min: Number(unloadingTime || 0),
      remarks: remarks || null,
    });
    setSaving(false);
    if (error) {
      if (error.message.includes("INVALID EQUIPMENT")) setInvalidOpen(true);
      toast.error(error.message);
      return;
    }
    await writeAudit({
      action: "OPERATOR_LOG_CREATED",
      entity: "operator_logs",
      user_id: user?.id ?? null,
      employee_id: profile?.employee_id ?? null,
      employee_name: profile?.employee_name ?? null,
      details: { equipment: selectedEquipment.code, material, destination, trips: Number(trips), quantity_t: quantity },
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
    toast.success(`Saved · ${fmtNumber(quantity)} t added to ${selectedEquipment.code}`);
    reset();
    void qc.invalidateQueries();
  };

  const raiseEmergency = async () => {
    const { error } = await supabase.from("emergency_alerts").insert({
      user_id: user?.id as string,
      employee_id: profile?.employee_id ?? null,
      employee_name: profile?.employee_name ?? null,
      login_id: profile?.email ?? user?.email ?? null,
      shift,
      equipment_code: selectedEquipment?.code ?? null,
      material_code: material || null,
      destination_code: destination || null,
      message: emergencyMsg || "Emergency assistance required",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await writeAudit({
      action: "EMERGENCY_CREATED",
      entity: "emergency_alerts",
      user_id: user?.id ?? null,
      employee_id: profile?.employee_id ?? null,
      employee_name: profile?.employee_name ?? null,
      details: { notify_email: EMERGENCY_NOTIFY_EMAIL, equipment: selectedEquipment?.code ?? null, shift },
    });
    setEmergencyOpen(false);
    setEmergencyMsg("");
    toast.success("Emergency alert sent to Admin control room");
  };

  const todayTotals = useMemo(() => {
    const t = myLogs.reduce((s, l) => s + Number(l.quantity_t), 0);
    const trips = myLogs.reduce((s, l) => s + l.trips, 0);
    return { t, trips };
  }, [myLogs]);

  return (
    <div className="mx-auto max-w-[1300px]">
      <SectionHeader
        title="Operator Console"
        subtitle={`${profile?.employee_name ?? "Operator"} · Employee ID ${profile?.employee_id ?? "—"} · ${shift} shift`}
        actions={
          <Button
            variant="destructive"
            className="animate-alarm rounded-full"
            onClick={() => setEmergencyOpen(true)}
          >
            <Siren className="mr-2 h-4 w-4" /> EMERGENCY
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="My tonnage today" value={todayTotals.t} unit="t" />
        <KpiCard label="My trips today" value={todayTotals.trips} delay={60} />
        <KpiCard label="Entries logged" value={myLogs.length} delay={120} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Panel className="p-6 lg:col-span-3">
          <h2 className="text-lg font-semibold">Trip entry</h2>
          <p className="text-sm text-muted-foreground">
            Employee ID is identified automatically from your login. Quantity is calculated for you.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input value={profile?.employee_id ?? ""} readOnly className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Employee name</Label>
              <Input value={profile?.employee_name ?? ""} readOnly />
            </div>

            <div className="space-y-2">
              <Label>Equipment</Label>
              <Select value={equipmentId} onValueChange={setEquipmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select dumper / Sany" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {equipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.code} · {e.equipment_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Shift</Label>
              <Select value={shift} onValueChange={(v) => setShift(v as typeof shift)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAY">DAY</SelectItem>
                  <SelectItem value="NIGHT">NIGHT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Material</Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger>
                  <SelectValue placeholder="Select material" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.code} value={m.code}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Destination</Label>
              <Select value={destination} onValueChange={setDestination} disabled={!material}>
                <SelectTrigger>
                  <SelectValue placeholder={material ? "Select destination" : "Select material first"} />
                </SelectTrigger>
                <SelectContent>
                  {validDestinations.map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.name}
                      {d.allowed_equipment_types.length === 1 ? ` · ${d.allowed_equipment_types[0]} only` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Actual trips</Label>
              <Input type="number" min={1} value={trips} onChange={(e) => setTrips(e.target.value)} placeholder="0" />
            </div>

            <div className="space-y-2">
              <Label>Automatic quantity</Label>
              <div className="flex h-9 items-center rounded-md border border-input bg-secondary/50 px-3 font-mono text-sm tabular-nums text-primary">
                {fmtNumber(quantity)} t
                <span className="ml-2 text-[11px] font-sans text-muted-foreground">
                  {selectedEquipment ? `${selectedEquipment.equipment_type === "DUMPER" ? 100 : 70} t / trip` : "select equipment"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Loading time (min)</Label>
              <Input type="number" min={0} value={loadingTime} onChange={(e) => setLoadingTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Unloading time (min)</Label>
              <Input type="number" min={0} value={unloadingTime} onChange={(e) => setUnloadingTime(e.target.value)} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
            </div>
          </div>

          {equipmentBlocked && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> {destination} allows SANY equipment only.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={saving || equipmentBlocked}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save entry
            </Button>
            <Button variant="secondary" onClick={reset}>
              Clear
            </Button>
            <span className="text-xs text-muted-foreground">Draft auto-saves as you type</span>
            {savedFlash && (
              <span className="animate-fade-up ml-auto inline-flex items-center gap-1.5 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" /> Saved to fleet, production &amp; summary
              </span>
            )}
          </div>
        </Panel>

        <Panel className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold">My entries today</h2>
          <div className="mt-4 space-y-2">
            {myLogs.length === 0 && <p className="text-sm text-muted-foreground">No entries logged yet for today.</p>}
            {myLogs.map((l) => (
              <div key={l.id} className="animate-fade-up rounded-xl border border-border bg-secondary/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{l.equipment_code}</span>
                  <span className="font-mono tabular-nums text-primary">{fmtNumber(Number(l.quantity_t))} t</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {l.material_code} → {l.destination_code} · {l.trips} trips · L {l.loading_time_min}m / U {l.unloading_time_min}m
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <AlertDialog open={invalidOpen} onOpenChange={setInvalidOpen}>
        <AlertDialogContent className="border-destructive/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> INVALID EQUIPMENT
            </AlertDialogTitle>
            <AlertDialogDescription>
              TH-2 and TH-3 allow SANY equipment only. Please select SANY equipment or change the destination.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDestination("")}>Change destination</AlertDialogCancel>
            <AlertDialogAction onClick={() => setEquipmentId("")}>Change equipment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={emergencyOpen} onOpenChange={setEmergencyOpen}>
        <DialogContent className="border-destructive/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Siren className="h-5 w-5" /> Confirm emergency alert
            </DialogTitle>
            <DialogDescription>
              This sends an immediate alert to the Admin dashboard with your Employee ID, equipment and location details.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={emergencyMsg}
            onChange={(e) => setEmergencyMsg(e.target.value)}
            placeholder="What is happening? (optional)"
            rows={3}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEmergencyOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void raiseEmergency()}>
              Send emergency alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
