import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Languages, Loader2, Save, Siren } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDestinations, useEquipment, useMaterials, useOperatorLogs, writeAudit } from "@/lib/queries";
import { placeEmergencyCall } from "@/lib/emergency.functions";
import { sendEmergencyEmail } from "@/lib/emergency-email.functions";
import { LANGUAGES, useI18n, type LangCode } from "@/lib/i18n";
import {
  EMERGENCY_CALL_NUMBER,
  EXCAVATOR_GROUPS,
  EMERGENCY_NOTIFY_EMAIL,
  SHIFTS,
  currentShift,
  fmtNumber,
  todayISO,
  tonnesFor,
} from "@/lib/fleetiq";
import { KpiCard, Panel, SectionHeader } from "@/components/fleetiq/Cards";
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
  const { t, lang, setLang } = useI18n();
  const qc = useQueryClient();
  const callEmergency = useServerFn(placeEmergencyCall);
  const emailEmergency = useServerFn(sendEmergencyEmail);
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
  const [shift, setShift] = useState(currentShift());
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [invalidOpen, setInvalidOpen] = useState(false);
  const [sendingEmergency, setSendingEmergency] = useState(false);
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
      excavator,
      destination_code: destination,
      trips: Number(trips),
      loading_time_min: liveLoading,
      unloading_time_min: liveUnloading,
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
      details: { equipment: selectedEquipment.code, material, excavator, destination, trips: Number(trips), quantity_t: quantity },
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
    toast.success(`${fmtNumber(quantity)} t · ${selectedEquipment.code} → ${destination}`);
    reset();
    void qc.invalidateQueries();
  };

  const raiseEmergency = async () => {
    if (sendingEmergency) return;
    setSendingEmergency(true);
    const msg = "Emergency assistance required";
    toast.warning(t("op.emergency"));
    const { data: inserted, error } = await supabase
      .from("emergency_alerts")
      .insert({
        user_id: user?.id as string,
        employee_id: profile?.employee_id ?? null,
        employee_name: profile?.employee_name ?? null,
        login_id: profile?.email ?? user?.email ?? null,
        shift,
        equipment_code: selectedEquipment?.code ?? null,
        material_code: material || null,
        destination_code: destination || null,
        message: msg,
      })
      .select("id, created_at")
      .single();
    if (error) {
      toast.error(error.message);
      setSendingEmergency(false);
      return;
    }

    // Email the full detail sheet immediately — no extra confirmation step.
    let emailStatus = "failed";
    try {
      const mail = await emailEmergency({
        data: {
          alertId: (inserted?.id ?? "").slice(0, 8).toUpperCase(),
          employeeName: profile?.employee_name ?? "Operator",
          employeeId: profile?.employee_id ?? "unknown",
          loginId: profile?.email ?? user?.email ?? "unknown",
          shift,
          equipment: selectedEquipment?.code ?? "not selected",
          material: material || "not selected",
          destination: destination || "Surjagarh mine lease",
          message: msg,
          raisedAt: new Date(inserted?.created_at ?? Date.now()).toLocaleString("en-GB", {
            timeZone: "Asia/Kolkata",
          }),
        },
      });
      emailStatus = mail.status;
    } catch {
      emailStatus = "failed";
    }

    // OmniDimension AI agent places the voice call to the emergency number.
    let callStatus = "failed";
    try {
      const res = await callEmergency({
        data: {
          employeeName: profile?.employee_name ?? "Operator",
          employeeId: profile?.employee_id ?? "unknown",
          location: destination || "Surjagarh mine lease",
          equipment: selectedEquipment?.code ?? "not selected",
          shift,
          message: msg,
        },
      });
      callStatus = res.status;
    } catch {
      callStatus = "failed";
    }

    await writeAudit({
      action: "EMERGENCY_CREATED",
      entity: "emergency_alerts",
      entity_id: inserted?.id,
      user_id: user?.id ?? null,
      employee_id: profile?.employee_id ?? null,
      employee_name: profile?.employee_name ?? null,
      details: {
        notify_email: EMERGENCY_NOTIFY_EMAIL,
        email_status: emailStatus,
        call_number: EMERGENCY_CALL_NUMBER,
        call_status: callStatus,
        equipment: selectedEquipment?.code ?? null,
        shift,
      },
    });
    setSendingEmergency(false);
    if (emailStatus === "sent") toast.success(`${t("op.emergencySent")} · ${EMERGENCY_NOTIFY_EMAIL}`);
    else toast.warning(`${t("op.emergencySent")} · email pending`);
  };


  const todayTotals = useMemo(() => {
    const tonnes = myLogs.reduce((s, l) => s + Number(l.quantity_t), 0);
    const tripCount = myLogs.reduce((s, l) => s + l.trips, 0);
    return { t: tonnes, trips: tripCount };
  }, [myLogs]);

  return (
    <div className="mx-auto max-w-[1300px]">
      <SectionHeader
        title={t("op.title")}
        subtitle={`${profile?.employee_name ?? "Operator"} · ${t("op.subtitle")} ${shift}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={lang} onValueChange={(v) => setLang(v as LangCode)}>
              <SelectTrigger className="w-[150px]">
                <Languages className="mr-2 h-4 w-4 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="destructive"
              className="animate-alarm rounded-full"
              disabled={sendingEmergency}
              onClick={() => void raiseEmergency()}
            >
              <Siren className="mr-2 h-4 w-4" /> {t("op.emergency")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label={t("op.myTonnage")} value={todayTotals.t} unit="t" />
        <KpiCard label={t("op.myTrips")} value={todayTotals.trips} delay={60} />
        <KpiCard label={t("op.entries")} value={myLogs.length} delay={120} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Panel className="p-6 lg:col-span-3">
          <h2 className="text-lg font-semibold">{t("op.tripEntry")}</h2>
          <p className="text-sm text-muted-foreground">{t("op.tripHelp")}</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("op.equipment")}</Label>
              <Select
                value={equipmentId}
                onValueChange={(v) => {
                  beginEntry();
                  setEquipmentId(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("op.selectEquipment")} />
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
              <Label>{t("op.shift")}</Label>
              <Select value={shift} onValueChange={(v) => setShift(v as typeof shift)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("op.material")}</Label>
              <Select
                value={material}
                onValueChange={(v) => {
                  beginEntry();
                  setMaterial(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("op.selectMaterial")} />
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
              <Label>{t("op.excavator")}</Label>
              <Select
                value={excavator}
                onValueChange={(v) => {
                  beginEntry();
                  setExcavator(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("op.selectExcavator")} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {EXCAVATOR_GROUPS.map((g) => (
                    <SelectGroup key={g.group}>
                      <SelectLabel>{g.group}</SelectLabel>
                      {g.items.map((x) => (
                        <SelectItem key={x} value={x}>
                          {x}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("op.destination")}</Label>
              <Select value={destination} onValueChange={pickDestination} disabled={!material}>
                <SelectTrigger>
                  <SelectValue placeholder={material ? t("op.selectDestination") : t("op.selectMaterialFirst")} />
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
              <Label>{t("op.trips")}</Label>
              <Input
                type="number"
                min={1}
                value={trips}
                onChange={(e) => {
                  beginEntry();
                  setTrips(e.target.value);
                }}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("op.quantity")}</Label>
              <div className="flex h-9 items-center rounded-md border border-input bg-secondary/50 px-3 font-mono text-sm tabular-nums text-primary">
                {fmtNumber(quantity)} t
                <span className="ml-2 font-sans text-[11px] text-muted-foreground">
                  {selectedEquipment
                    ? `${selectedEquipment.equipment_type === "DUMPER" ? 100 : 70} ${t("op.perTrip")}`
                    : t("op.selectEquipmentShort")}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("op.loading")}</Label>
              <div className="flex h-9 items-center rounded-md border border-input bg-secondary/50 px-3 font-mono text-sm tabular-nums">
                {fmtNumber(liveLoading, 1)} {t("op.min")}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("op.unloading")}</Label>
              <div className="flex h-9 items-center rounded-md border border-input bg-secondary/50 px-3 font-mono text-sm tabular-nums">
                {fmtNumber(liveUnloading, 1)} {t("op.min")}
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>{t("op.remarks")}</Label>
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

          <p className="mt-3 text-xs text-muted-foreground">{t("op.timerHint")}</p>

          {equipmentBlocked && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> {destination} — {t("op.invalidTitle")}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={saving || equipmentBlocked}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t("op.save")}
            </Button>
            <Button variant="secondary" onClick={reset}>
              {t("op.clear")}
            </Button>
            <span className="text-xs text-muted-foreground">{t("op.draft")}</span>
            {savedFlash && (
              <span className="animate-fade-up ml-auto inline-flex items-center gap-1.5 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" /> {t("op.saved")}
              </span>
            )}
          </div>
        </Panel>

        <Panel className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold">{t("op.myEntries")}</h2>
          <div className="mt-4 space-y-2">
            {myLogs.length === 0 && <p className="text-sm text-muted-foreground">{t("op.noEntries")}</p>}
            {myLogs.map((l) => (
              <div key={l.id} className="animate-fade-up rounded-xl border border-border bg-secondary/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{l.equipment_code}</span>
                  <span className="font-mono tabular-nums text-primary">{fmtNumber(Number(l.quantity_t))} t</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(l as { excavator?: string | null }).excavator
                    ? `${(l as { excavator?: string | null }).excavator} · `
                    : ""}
                  {l.material_code} → {l.destination_code} · {l.trips} · L {l.loading_time_min}m / U {l.unloading_time_min}m
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
