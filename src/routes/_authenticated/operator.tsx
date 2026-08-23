import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Languages, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useShiftClock } from "@/lib/useShiftClock";
import { useOfflineSync } from "@/lib/useOfflineSync";
import { enqueueLog } from "@/lib/offlineQueue";
import { useDestinations, useEquipment, useMaterials, useOperatorLogs, writeAudit } from "@/lib/queries";
import { LANGUAGES, useI18n, type LangCode } from "@/lib/i18n";
import {
  EXCAVATOR_GROUPS,
  fmtNumber,
  todayISO,
  tonnesFor,
} from "@/lib/fleetiq";
import { KpiCard, Panel } from "@/components/fleetiq/Cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/operator")({
  head: () => ({
    meta: [
      { title: "Operator Console — LLOYDS FLEETIQ" },
      { name: "description", content: "Log trips with automatic loading and unloading times, and raise emergency alerts from the pit." },
      { property: "og:title", content: "Operator Console — LLOYDS FLEETIQ" },
      { property: "og:description", content: "Trip logging and emergency alerts for Surjagarh operators." },
    ],
  }),
  component: OperatorConsole,
});

const minutesBetween = (from: number, to: number) => Math.max(0, Math.round(((to - from) / 60000) * 10) / 10);

function OperatorConsole() {
  const { profile, user } = useAuth();
  const { t, tn, lang, setLang } = useI18n();
  const qc = useQueryClient();
  const { shift } = useShiftClock();
  const { pending, online } = useOfflineSync();
  const { data: equipment = [] } = useEquipment();
  const { data: materials = [] } = useMaterials();
  const { data: destinations = [] } = useDestinations();
  const { data: myLogs = [] } = useOperatorLogs({
    date: todayISO(),
    limit: 100,
    ...(user?.id ? { userId: user.id } : {}),
  });

  const [equipmentId, setEquipmentId] = useState("");
  const [material, setMaterial] = useState("");
  const [excavator, setExcavator] = useState("");
  const [destination, setDestination] = useState("");
  const [trips, setTrips] = useState("");
  const [remarks, setRemarks] = useState("");
  const empId = profile?.employee_id ?? "";
  const empName = profile?.employee_name ?? "";
  const [saving, setSaving] = useState(false);
  const [invalidOpen, setInvalidOpen] = useState(false);
  
  const [savedFlash, setSavedFlash] = useState(false);

  // Automatic timing: the loading clock starts the moment the operator begins
  // the entry; it stops (and the unloading clock starts) when a destination is picked.
  const startedAtRef = useRef<number | null>(null);
  const [destPickedAt, setDestPickedAt] = useState<number | null>(null);
  const [loadingMin, setLoadingMin] = useState(0);
  const [tick, setTick] = useState(Date.now());

  const beginEntry = () => {
    startedAtRef.current ??= Date.now();
  };

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const liveLoading = destPickedAt
    ? loadingMin
    : startedAtRef.current
      ? minutesBetween(startedAtRef.current, tick)
      : 0;
  const liveUnloading = destPickedAt ? minutesBetween(destPickedAt, tick) : 0;

  const selectedEquipment = equipment.find((e) => e.id === equipmentId);
  const validDestinations = useMemo(
    () => destinations.filter((d) => d.material_code === material),
    [destinations, material],
  );

  // One tab per dumper: the vehicle claimed with this employee login stays
  // assigned until the operator releases it.
  const myVehicle = useMemo(
    () => equipment.find((e) => e.assigned_user_id && e.assigned_user_id === user?.id) ?? null,
    [equipment, user?.id],
  );
  const availableEquipment = useMemo(
    () => equipment.filter((e) => !e.assigned_user_id || e.assigned_user_id === user?.id),
    [equipment, user?.id],
  );

  useEffect(() => {
    if (myVehicle && equipmentId !== myVehicle.id) setEquipmentId(myVehicle.id);
  }, [myVehicle, equipmentId]);

  const claimVehicle = async (id: string) => {
    beginEntry();
    setEquipmentId(id);
    if (!user?.id) return;
    const { error } = await supabase
      .from("equipment")
      .update({
        assigned_user_id: user.id,
        operator_employee_id: empId || null,
        operator_name: empName || null,
      })
      .eq("id", id)
      .is("assigned_user_id", null);
    if (error) {
      toast.error(t("op.vehicleTaken"));
      setEquipmentId("");
      return;
    }
    toast.success(t("op.vehicleAssigned"));
    void qc.invalidateQueries({ queryKey: ["equipment"] });
  };

  const releaseVehicle = async () => {
    if (!myVehicle) return;
    await supabase.from("equipment").update({ assigned_user_id: null }).eq("id", myVehicle.id);
    setEquipmentId("");
    toast.success(t("op.vehicleReleased"));
    void qc.invalidateQueries({ queryKey: ["equipment"] });
  };

  // Destination list depends on material — clear invalid selections immediately.
  useEffect(() => {
    if (destination && !validDestinations.some((d) => d.code === destination)) {
      setDestination("");
      setDestPickedAt(null);
    }
  }, [validDestinations, destination]);

  const destinationRow = destinations.find((d) => d.code === destination);
  const equipmentBlocked =
    !!destinationRow && !!selectedEquipment && !destinationRow.allowed_equipment_types.includes(selectedEquipment.equipment_type);

  useEffect(() => {
    if (equipmentBlocked) setInvalidOpen(true);
  }, [equipmentBlocked]);

  const quantity = tonnesFor(selectedEquipment?.equipment_type, Number(trips));

  const pickDestination = (code: string) => {
    beginEntry();
    const now = Date.now();
    setDestination(code);
    setDestPickedAt(now);
    setLoadingMin(startedAtRef.current ? minutesBetween(startedAtRef.current, now) : 0);
  };

  // Draft auto-save so a half-finished entry survives a page reload.
  useEffect(() => {
    const raw = window.localStorage.getItem("fleetiq:draft");
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as Record<string, string>;
      setEquipmentId(d['equipmentId'] ?? "");
      setMaterial(d['material'] ?? "");
      setExcavator(d['excavator'] ?? "");
      setTrips(d['trips'] ?? "");
      setRemarks(d['remarks'] ?? "");
    } catch {
      /* ignore malformed draft */
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.localStorage.setItem("fleetiq:draft", JSON.stringify({ equipmentId, material, excavator, trips, remarks }));
    }, 600);
    return () => clearTimeout(timer);
  }, [equipmentId, material, excavator, trips, remarks]);

  const reset = () => {
    setTrips("");
    setExcavator("");
    setRemarks("");
    setDestination("");
    setDestPickedAt(null);
    setLoadingMin(0);
    startedAtRef.current = null;
    window.localStorage.removeItem("fleetiq:draft");
  };

  const save = async () => {
    if (!selectedEquipment || !material || !excavator || !destination || !trips) {
      toast.error(t("op.completeFields"));
      return;
    }
    if (!empId.trim() || !empName.trim()) {
      toast.error("Your operator profile is missing an employee ID — contact the administrator");
      return;
    }
    if (equipmentBlocked) {
      setInvalidOpen(true);
      await writeAudit({
        action: "INVALID_EQUIPMENT_ATTEMPT",
        entity: "operator_logs",
        user_id: user?.id ?? null,
        employee_id: empId.trim(),
        employee_name: empName.trim(),
        details: { destination, equipment: selectedEquipment.code, equipment_type: selectedEquipment.equipment_type },
      });
      return;
    }
    setSaving(true);
    const payload = {
      shift,
      user_id: user?.id as string,
      employee_id: empId.trim(),
      employee_name: empName.trim(),
      equipment_id: selectedEquipment.id,
      equipment_code: selectedEquipment.code,
      equipment_type: selectedEquipment.equipment_type,
      material_code: material,
      excavator,
      destination_code: destination,
      trips: Number(trips),
      loading_time_min: liveLoading,
      unloading_time_min: liveUnloading,
      remarks: remarks || null,
    };

    // No network in the pit: keep the entry locally and push it automatically later.
    if (!navigator.onLine) {
      const queued = enqueueLog(payload);
      setSaving(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
      toast.success(`Saved offline · ${queued} entr${queued === 1 ? "y" : "ies"} waiting to sync`);
      reset();
      return;
    }

    const { error } = await supabase.from("operator_logs").insert(payload);
    setSaving(false);
    if (error) {
      if (error.message.includes("INVALID EQUIPMENT")) {
        setInvalidOpen(true);
        toast.error(error.message);
        return;
      }
      if (/fetch|network/i.test(error.message)) {
        const queued = enqueueLog(payload);
        toast.success(`Saved offline · ${queued} entr${queued === 1 ? "y" : "ies"} waiting to sync`);
        reset();
        return;
      }
      toast.error(error.message);
      return;
    }
    await writeAudit({
      action: "OPERATOR_LOG_CREATED",
      entity: "operator_logs",
      user_id: user?.id ?? null,
      employee_id: profile?.employee_id ?? null,
      employee_name: profile?.employee_name ?? null,
      details: { equipment: selectedEquipment.code, material, excavator, destination, trips: Number(trips), quantity_t: quantity },
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
    toast.success(`${fmtNumber(quantity)} t · ${selectedEquipment.code} → ${destination}`);
    reset();
    void qc.invalidateQueries();
  };




  const todayTotals = useMemo(() => {
    const tonnes = myLogs.reduce((s, l) => s + Number(l.quantity_t), 0);
    const tripCount = myLogs.reduce((s, l) => s + l.trips, 0);
    return { t: tonnes, trips: tripCount };
  }, [myLogs]);

  const steps: { n: number; label: string; done: boolean }[] = [
    { n: 1, label: t("op.equipment"), done: !!selectedEquipment },
    { n: 2, label: t("op.excavator"), done: !!excavator },
    { n: 3, label: t("op.material"), done: !!material },
    { n: 4, label: t("op.destination"), done: !!destination },
    { n: 5, label: t("op.trips"), done: !!trips && Number(trips) > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="mx-auto max-w-[760px] pb-24">
      {/* Simple header: who you are, which shift, and the language switch. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("op.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {empName || "Operator"} · {empId || "NA"} · {t("op.shift")} {shift}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs ${online ? "border-primary/40 text-primary" : "border-destructive/50 text-destructive"}`}
          >
            {online ? "Online" : "Offline"}
            {pending > 0 ? ` · ${pending}` : ""}
          </span>
          <Select value={lang} onValueChange={(v) => setLang(v as LangCode)}>
            <SelectTrigger className="h-11 w-[160px] text-base">
              <Languages className="mr-2 h-5 w-5 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code} className="text-base">
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* One big card, one question at a time, top to bottom. */}
      <Panel className="mt-5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("op.tripHelp")}</p>
          <span className="font-mono text-sm tabular-nums text-primary">{doneCount}/5</span>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-base">1 · {t("op.equipment")}</Label>
            {myVehicle ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("op.myVehicle")}</p>
                  <p className="font-mono text-xl text-primary">
                    {myVehicle.code} · {tn(myVehicle.equipment_type)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("op.vehicleLocked")}</p>
                </div>
                <Button variant="secondary" className="h-11" onClick={() => void releaseVehicle()}>
                  {t("op.changeVehicle")}
                </Button>
              </div>
            ) : (
              <Select value={equipmentId} onValueChange={(v) => void claimVehicle(v)}>
                <SelectTrigger className="h-14 text-base">
                  <SelectValue placeholder={t("op.pickVehicle")} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {availableEquipment.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-base">
                      {e.code} · {tn(e.equipment_type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-base">2 · {t("op.excavator")}</Label>
            <Select
              value={excavator}
              onValueChange={(v) => {
                beginEntry();
                setExcavator(v);
              }}
            >
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder={t("op.selectExcavator")} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {EXCAVATOR_GROUPS.map((g) => (
                  <SelectGroup key={g.group}>
                    <SelectLabel>{t(`exc.${g.group}`)}</SelectLabel>
                    {g.items.map((x) => (
                      <SelectItem key={x} value={x} className="text-base">
                        {x}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-base">3 · {t("op.material")}</Label>
            <Select
              value={material}
              onValueChange={(v) => {
                beginEntry();
                setMaterial(v);
              }}
            >
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder={t("op.selectMaterial")} />
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.code} value={m.code} className="text-base">
                    {t(`mat.${m.code}`) === `mat.${m.code}` ? tn(m.name) : t(`mat.${m.code}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-base">4 · {t("op.destination")}</Label>
            <Select value={destination} onValueChange={pickDestination} disabled={!material}>
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder={material ? t("op.selectDestination") : t("op.selectMaterialFirst")} />
              </SelectTrigger>
              <SelectContent>
                {validDestinations.map((d) => (
                  <SelectItem key={d.code} value={d.code} className="text-base">
                    {t(`dest.${d.code}`) === `dest.${d.code}` ? tn(d.name) : t(`dest.${d.code}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-base">5 · {t("op.trips")}</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                className="h-14 w-14 text-2xl"
                onClick={() => {
                  beginEntry();
                  setTrips(String(Math.max(0, Number(trips || 0) - 1)));
                }}
              >
                −
              </Button>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={trips}
                onChange={(e) => {
                  beginEntry();
                  setTrips(e.target.value);
                }}
                placeholder="0"
                className="h-14 flex-1 text-center font-mono text-2xl tabular-nums"
              />
              <Button
                type="button"
                variant="secondary"
                className="h-14 w-14 text-2xl"
                onClick={() => {
                  beginEntry();
                  setTrips(String(Number(trips || 0) + 1));
                }}
              >
                +
              </Button>
            </div>
            <p className="text-sm text-primary">
              {fmtNumber(quantity)} t {t("op.quantity").toLowerCase()}
            </p>
          </div>

          {/* Remarks stay optional and out of the way. */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">{t("op.remarks")}</Label>
            <Textarea
              value={remarks}
              onChange={(e) => {
                beginEntry();
                setRemarks(e.target.value);
              }}
              rows={2}
            />
          </div>
        </div>

        {equipmentBlocked && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> {destination} — {t("op.invalidTitle")}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Button
            onClick={() => void save()}
            disabled={saving || equipmentBlocked}
            className="h-14 flex-1 text-base"
          >
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            {t("op.save")}
          </Button>
          <Button variant="secondary" onClick={reset} className="h-14 px-6 text-base">
            {t("op.clear")}
          </Button>
        </div>
        {savedFlash && (
          <p className="animate-fade-up mt-3 flex items-center gap-1.5 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" /> {t("op.saved")}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {t("op.draft")} · {t("op.unloading")}: {fmtNumber(liveUnloading, 1)} {t("op.min")}
        </p>
      </Panel>

      {/* Simple day totals and last entries. */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <KpiCard label={t("op.myTrips")} value={todayTotals.trips} />
        <KpiCard label={t("op.myTonnage")} value={todayTotals.t} unit="t" delay={60} />
      </div>

      <Panel className="mt-5 p-5">
        <h2 className="text-base font-semibold">{t("op.myEntries")}</h2>
        <div className="mt-3 space-y-2">
          {myLogs.length === 0 && <p className="text-sm text-muted-foreground">{t("op.noEntries")}</p>}
          {myLogs.slice(0, 8).map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-3 text-sm">
              <span>
                {l.equipment_code} · {l.material_code} → {l.destination_code}
              </span>
              <span className="font-mono tabular-nums text-primary">
                {l.trips} · {fmtNumber(Number(l.quantity_t))} t
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <AlertDialog open={invalidOpen} onOpenChange={setInvalidOpen}>
        <AlertDialogContent className="border-destructive/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> {t("op.invalidTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("op.invalidBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDestination("")}>{t("op.changeDestination")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => setEquipmentId("")}>{t("op.changeEquipment")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

